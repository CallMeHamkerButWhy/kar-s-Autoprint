"use client";

import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { CodeBlock } from "@/components/code-block";
import { useDashboardData } from "@/components/dashboard-provider";
import { PageHeader } from "@/components/page-header";
import { SecretField } from "@/components/secret-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrigin } from "@/hooks/use-origin";

export default function QrPage() {
  const { data, refresh } = useDashboardData();
  const origin = useOrigin();
  const [rotating, setRotating] = useState(false);

  const shop = data?.shop;
  const customerUrl = shop ? `${origin}/print/${shop.id}` : "";

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy — select the text instead");
    }
  };

  const rotateAgentToken = async () => {
    setRotating(true);
    try {
      const response = await fetch("/api/settings/rotate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential: "agentToken" }),
      });
      if (!response.ok) throw new Error();
      toast.success("New agent token issued — the old computer is disconnected");
      await refresh();
    } catch {
      toast.error("Could not issue a new token");
    } finally {
      setRotating(false);
    }
  };

  if (!shop) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader
          title="QR & agent"
          description="Your counter QR code and the print agent that runs on the shop computer."
        />
      </div>
    );
  }

  const agentCommand = (platform: "windows" | "unix") => {
    const lines =
      platform === "windows"
        ? [
            `set AUTOPRINT_SERVER=${origin}`,
            `set AUTOPRINT_TOKEN=${shop.agentToken}`,
            "node agent\\print-agent.mjs",
          ]
        : [
            `export AUTOPRINT_SERVER="${origin}"`,
            `export AUTOPRINT_TOKEN="${shop.agentToken}"`,
            "node agent/print-agent.mjs",
          ];
    return lines.join("\n");
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="QR & agent"
        description="Stick the QR on your counter, and keep the print agent running on the computer your printer is plugged into."
      />

      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="size-4" />
              Your shop QR
            </CardTitle>
            <CardDescription>
              A customer scans this, uploads from their phone, and the print comes
              out at your counter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center rounded-xl border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/shop/${shop.id}/qr`}
                alt={`QR code for ${shop.name}`}
                className="size-52"
              />
            </div>
            <div className="space-y-1 text-center">
              <p className="font-medium">{shop.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{shop.id}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                render={
                  <a href={`/api/shop/${shop.id}/qr`} download={`${shop.id}-qr.svg`} />
                }
              >
                <Download className="size-4" />
                Download QR
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copy(customerUrl, "Customer link")}
              >
                <Copy className="size-4" />
                Copy link
              </Button>
              <Button
                size="sm"
                render={<Link href={`/print/${shop.id}`} target="_blank" />}
              >
                <ExternalLink className="size-4" />
                Open as customer
              </Button>
            </div>
            <p className="text-center font-mono text-xs break-all text-muted-foreground">
              {customerUrl}
            </p>
            {/^https?:\/\/(localhost|127\.)/.test(origin) ? (
              <Alert>
                <TriangleAlert />
                <AlertTitle>This QR only works on this computer</AlertTitle>
                <AlertDescription>
                  A customer&apos;s phone cannot open a localhost address. Put the
                  server on your shop network or a public URL, then set{" "}
                  <code className="font-mono">AUTOPRINT_PUBLIC_URL</code> so the QR
                  points there.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Print agent</CardTitle>
            <CardDescription>
              The agent is the only piece that touches your printer. It asks the
              server for jobs, prints them, then deletes the file from this
              computer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={
                data?.agentOnline
                  ? "flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              }
            >
              {data?.agentOnline ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              )}
              <div>
                <p className="font-medium">
                  {data?.agentOnline
                    ? `Agent is connected${data.agentVersion ? ` (v${data.agentVersion})` : ""}`
                    : "Agent is not connected"}
                </p>
                <p className="text-xs">
                  {data?.agentOnline
                    ? `${data.stats.printersOnline} of ${data.stats.printersTotal} printers reachable right now.`
                    : "Run the commands below on the shop computer. Nothing prints until it connects."}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Agent token</p>
              <SecretField
                value={shop.agentToken}
                onRotate={() => void rotateAgentToken()}
                rotating={rotating}
              />
              <p className="text-xs text-muted-foreground">
                Rotating this disconnects the computer that is using the old token.
              </p>
            </div>

            <Separator />

            <Tabs defaultValue="unix">
              <TabsList>
                <TabsTrigger value="unix">macOS / Linux</TabsTrigger>
                <TabsTrigger value="windows">Windows</TabsTrigger>
              </TabsList>
              <TabsContent value="unix" className="space-y-2">
                <CodeBlock code={agentCommand("unix")} language="bash" />
                <p className="text-xs text-muted-foreground">
                  Printing uses <code className="font-mono">lp</code> from CUPS,
                  which is already on macOS and most Linux systems.
                </p>
              </TabsContent>
              <TabsContent value="windows" className="space-y-2">
                <CodeBlock code={agentCommand("windows")} language="cmd" />
                <p className="text-xs text-muted-foreground">
                  On Windows the agent prints through PowerShell, so no extra
                  tools are needed.
                </p>
              </TabsContent>
            </Tabs>

            <p className="text-xs text-muted-foreground">
              Add <code className="font-mono">--dry-run</code> to watch the whole
              flow without using paper.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Send jobs from your own website</CardTitle>
            <CardDescription>
              Already taking the upload and the payment on your site? Post the
              document here and it prints. This is the same queue the QR flow uses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">API key</p>
              <SecretField value={shop.apiKey} />
            </div>

            <Tabs defaultValue="curl">
              <TabsList>
                <TabsTrigger value="curl">curl</TabsTrigger>
                <TabsTrigger value="node">Node</TabsTrigger>
                <TabsTrigger value="php">PHP</TabsTrigger>
              </TabsList>
              <TabsContent value="curl">
                <CodeBlock
                  language="bash"
                  code={`curl -X POST ${origin}/api/v1/print-jobs \\
  -H "X-API-Key: ${shop.apiKey}" \\
  -F "file=@invoice.pdf" \\
  -F "copies=1" \\
  -F "color=bw" \\
  -F "paperSize=A4" \\
  -F "customerName=Ravi" \\
  -F "paid=true"`}
                />
              </TabsContent>
              <TabsContent value="node">
                <CodeBlock
                  language="javascript"
                  code={`const form = new FormData();
form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "invoice.pdf");
form.append("copies", "1");
form.append("color", "bw");
form.append("paperSize", "A4");
form.append("customerName", "Ravi");
form.append("paid", "true");

const res = await fetch("${origin}/api/v1/print-jobs", {
  method: "POST",
  headers: { "X-API-Key": "${shop.apiKey}" },
  body: form,
});

const { job } = await res.json();
console.log(job.code, job.status);`}
                />
              </TabsContent>
              <TabsContent value="php">
                <CodeBlock
                  language="php"
                  code={`$ch = curl_init("${origin}/api/v1/print-jobs");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["X-API-Key: ${shop.apiKey}"],
  CURLOPT_POSTFIELDS => [
    "file" => new CURLFile("/path/invoice.pdf", "application/pdf", "invoice.pdf"),
    "copies" => "1",
    "color" => "bw",
    "paperSize" => "A4",
    "paid" => "true",
  ],
]);
$job = json_decode(curl_exec($ch), true);`}
                />
              </TabsContent>
            </Tabs>

            <p className="text-xs text-muted-foreground">
              JSON works too — send{" "}
              <code className="font-mono">documentUrl</code> or{" "}
              <code className="font-mono">fileBase64</code> instead of a file part.
              Poll <code className="font-mono">GET /api/orders/&lt;id&gt;</code> for
              the status.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
