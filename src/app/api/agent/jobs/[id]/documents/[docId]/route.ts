import { authFailure, checkAgentToken, jsonError } from "@/lib/api";
import { getDatabase, readStoredFile } from "@/lib/store";

/** GET /api/agent/jobs/:id/documents/:docId — bytes for one claimed document. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/agent/jobs/[id]/documents/[docId]">,
) {
  const db = await getDatabase();
  const auth = checkAgentToken(request, db);
  if (auth !== "ok") return authFailure(auth, "agent token");

  const { id, docId } = await ctx.params;
  const job = db.jobs.find((item) => item.id === id);
  if (!job) return jsonError(404, "Unknown job");

  const document = job.documents.find((item) => item.id === docId);
  if (!document) return jsonError(404, "Unknown document");
  if (!document.storedFile) {
    return jsonError(410, "This document was already printed and deleted");
  }

  let bytes: Buffer;
  try {
    bytes = await readStoredFile(document.storedFile);
  } catch {
    return jsonError(410, "The file is no longer on the server");
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": document.contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `attachment; filename="${document.fileName.replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}
