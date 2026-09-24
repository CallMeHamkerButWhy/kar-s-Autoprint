/**
 * Page count in the browser, so the customer sees the price before uploading.
 *
 * Same heuristic as the server, which recounts on arrival — this is only for
 * the live quote on the phone.
 */
export async function countPagesInBrowser(file: File): Promise<number> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return 1;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);

    const counts = [...text.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)]
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (counts.length > 0) return Math.max(...counts);

    const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
    return pages && pages.length > 0 ? pages.length : 1;
  } catch {
    return 1;
  }
}
