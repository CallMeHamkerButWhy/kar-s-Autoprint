import { jsonError } from "@/lib/api";
import { currentShop } from "@/lib/session";
import { getDatabase, readStoredFile, shopJobs } from "@/lib/store";

/**
 * GET /api/jobs/:id/documents/:docId — lets the counter check a document before
 * it prints. Once the job has printed the file is gone, and so is this.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/jobs/[id]/documents/[docId]">,
) {
  const { id, docId } = await ctx.params;
  const db = await getDatabase();
  const shop = await currentShop(db);
  if (!shop) return jsonError(401, "Sign in to your shop first.");

  const job = shopJobs(db, shop.id).find((item) => item.id === id);
  if (!job) return jsonError(404, "Unknown job");

  const document = job.documents.find((item) => item.id === docId);
  if (!document) return jsonError(404, "Unknown document");
  if (!document.storedFile) {
    return jsonError(410, "This file was deleted after printing");
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
      "content-disposition": `inline; filename="${document.fileName.replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}
