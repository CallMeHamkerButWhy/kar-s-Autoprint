#!/usr/bin/env node
/**
 * Auto Print agent — runs on the shop computer, next to the printer.
 *
 * It does four things, in a loop:
 *   1. tells the server which printer queues this computer can see,
 *   2. claims paid jobs from the queue,
 *   3. prints each document with the OS print command,
 *   4. deletes its temporary copy and reports the result.
 *
 * No dependencies: plain Node 18+, so a shop PC only needs Node installed.
 *
 *   AUTOPRINT_SERVER=https://print.example.com \
 *   AUTOPRINT_TOKEN=agt_xxx \
 *   node agent/print-agent.mjs [--dry-run] [--once] [--printer NAME]
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const VERSION = "1.0.0";
const IS_WINDOWS = process.platform === "win32";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const CONFIG = {
  server: (option("server") ?? process.env.AUTOPRINT_SERVER ?? "http://127.0.0.1:47823")
    .replace(/\/+$/, ""),
  token: option("token") ?? process.env.AUTOPRINT_TOKEN ?? "",
  /** Restrict to specific queues; empty means "whatever this computer has". */
  printers: (option("printer") ?? process.env.AUTOPRINT_PRINTERS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
  pollMs: Number(option("poll") ?? process.env.AUTOPRINT_POLL_MS ?? 3000),
  heartbeatMs: Number(process.env.AUTOPRINT_HEARTBEAT_MS ?? 30_000),
  dryRun: flag("dry-run") || process.env.AUTOPRINT_DRY_RUN === "1",
  once: flag("once"),
};

function log(level, message, extra) {
  const stamp = new Date().toISOString().slice(11, 19);
  const line = `${stamp} ${level.padEnd(5)} ${message}`;
  if (level === "error") console.error(line, extra ?? "");
  else console.log(line, extra ?? "");
}

function authHeaders(extra = {}) {
  return { "X-Agent-Token": CONFIG.token, ...extra };
}

async function api(pathname, { method = "GET", body, raw = false } = {}) {
  const response = await fetch(`${CONFIG.server}${pathname}`, {
    method,
    headers: body
      ? authHeaders({ "content-type": "application/json" })
      : authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${method} ${pathname} → ${response.status} ${detail.slice(0, 200)}`);
  }
  if (raw) return Buffer.from(await response.arrayBuffer());
  return response.json();
}

/** Ask the operating system which printers exist. */
async function discoverPrinters() {
  if (CONFIG.printers.length > 0) return CONFIG.printers;

  try {
    if (IS_WINDOWS) {
      const { stdout } = await run("powershell", [
        "-NoProfile",
        "-Command",
        "Get-Printer | Select-Object -ExpandProperty Name",
      ]);
      return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    }

    const { stdout } = await run("lpstat", ["-a"]);
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean);
  } catch {
    log("warn", "Could not list printers on this computer");
    return [];
  }
}

function cupsOptions(document) {
  const options = [
    "-n",
    String(document.copies ?? 1),
    "-o",
    `media=${document.paperSize ?? "A4"}`,
    "-o",
    document.duplex ? "sides=two-sided-long-edge" : "sides=one-sided",
    "-o",
    "fit-to-page",
  ];
  // Greyscale keeps colour ink out of a black & white job.
  if (document.color !== "color") {
    options.push("-o", "ColorModel=Gray", "-o", "print-color-mode=monochrome");
  }
  return options;
}

/** Windows has no lp, so use a PDF printer helper when one is installed. */
async function windowsPrint(file, printer, document) {
  const helpers = [
    { bin: "PDFtoPrinter.exe", args: [file, printer] },
    { bin: "SumatraPDF.exe", args: ["-print-to", printer, "-silent", file] },
  ];

  for (const helper of helpers) {
    try {
      await run(helper.bin, helper.args, { windowsHide: true });
      return helper.bin;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  // Last resort: hand the file to the shell's registered print verb.
  const copies = Math.max(Number(document.copies ?? 1), 1);
  for (let index = 0; index < copies; index += 1) {
    await run(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Start-Process -FilePath ${JSON.stringify(file)} -Verb Print -PassThru | ` +
          "ForEach-Object { Start-Sleep -Seconds 4; $_ } | Out-Null",
      ],
      { windowsHide: true },
    );
  }
  return "powershell";
}

async function printFile(file, printer, document) {
  if (CONFIG.dryRun) {
    log(
      "info",
      `[dry run] would print ${path.basename(file)} → ${printer} ` +
        `(${document.copies}× ${document.paperSize} ${document.color})`,
    );
    return "dry-run";
  }

  if (IS_WINDOWS) return windowsPrint(file, printer, document);

  await run("lp", ["-d", printer, ...cupsOptions(document), file]);
  return "lp";
}

async function handleJob(job) {
  log("info", `Job ${job.code}: ${job.documents.length} file(s) → ${job.printerName}`);

  const workDir = await mkdtemp(path.join(tmpdir(), "autoprint-"));
  const reports = [];
  let failure = null;

  try {
    for (const document of job.documents) {
      const target = path.join(workDir, path.basename(document.fileName));
      try {
        const bytes = await api(document.downloadPath, { raw: true });
        await writeFile(target, bytes);
        const via = await printFile(target, job.printer, document);
        log("info", `  printed ${document.fileName} via ${via}`);
        reports.push({ id: document.id, ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("error", `  failed ${document.fileName}: ${message}`);
        reports.push({ id: document.id, ok: false, error: message });
        failure = failure ?? message;
      } finally {
        await rm(target, { force: true });
      }
    }
  } finally {
    // The shop's copy never outlives the print.
    await rm(workDir, { recursive: true, force: true });
    log("info", `  local files deleted for ${job.code}`);
  }

  await api(`/api/agent/jobs/${job.id}/result`, {
    method: "POST",
    body: {
      ok: failure == null,
      error: failure ?? undefined,
      documents: reports,
      localFilesDeleted: true,
    },
  });
}

async function heartbeat(printers) {
  const info = await api("/api/agent/heartbeat", {
    method: "POST",
    body: { agentVersion: VERSION, printers, host: process.env.COMPUTERNAME ?? "" },
  });
  return info;
}

async function main() {
  if (!CONFIG.token) {
    log("error", "No agent token. Set AUTOPRINT_TOKEN, or pass --token.");
    process.exit(1);
  }

  log("info", `Auto Print agent v${VERSION} → ${CONFIG.server}`);
  if (CONFIG.dryRun) log("warn", "Dry run: nothing will actually print");

  let printers = await discoverPrinters();
  log(
    "info",
    printers.length > 0
      ? `Printers on this computer: ${printers.join(", ")}`
      : "No printers found — the server will still be told this agent is alive",
  );

  try {
    const info = await heartbeat(printers);
    log("info", `Connected to ${info.shopName} (${info.shopId})`);
  } catch (error) {
    log("error", `Could not reach the server: ${error.message}`);
    if (CONFIG.once) process.exit(1);
  }

  let lastHeartbeat = Date.now();
  let lastDiscovery = Date.now();
  let backoff = 0;

  for (;;) {
    try {
      if (Date.now() - lastDiscovery > 30 * 60_000) {
        printers = await discoverPrinters();
        lastDiscovery = Date.now();
      }
      if (Date.now() - lastHeartbeat > CONFIG.heartbeatMs) {
        await heartbeat(printers);
        lastHeartbeat = Date.now();
      }

      const { jobs, paused } = await api("/api/agent/claim", {
        method: "POST",
        body: { printers, max: 2 },
      });

      if (paused) {
        log("info", `Server says printing is paused (${paused})`);
      }
      for (const job of jobs ?? []) {
        await handleJob(job);
      }

      backoff = 0;
      if (CONFIG.once) {
        log("info", "Done (--once)");
        return;
      }
      await sleep(CONFIG.pollMs);
    } catch (error) {
      backoff = Math.min(backoff === 0 ? 2000 : backoff * 2, 60_000);
      log("error", `${error.message} — retrying in ${Math.round(backoff / 1000)}s`);
      if (CONFIG.once) process.exit(1);
      await sleep(backoff);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", () => {
  log("info", "Stopping agent");
  process.exit(0);
});

main().catch((error) => {
  log("error", error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
