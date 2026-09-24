/**
 * Counts pages well enough to price a job, without a PDF parser.
 *
 * Reads /Count from the page tree and falls back to counting page objects.
 * Compressed object streams can hide both, so callers must tolerate a 1.
 */
export function countPdfPages(bytes: Buffer): number {
  const text = bytes.toString("latin1");

  const counts = [...text.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (counts.length > 0) return Math.max(...counts);

  const pageObjects = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return pageObjects && pageObjects.length > 0 ? pageObjects.length : 1;
}

/**
 * Builds a single page PDF from plain text lines, without pulling in a PDF
 * library. Used for the "send a test job" button and the first-run examples so
 * the whole pipeline can be exercised with a real, printable file.
 */
export function buildSimplePdf(title: string, lines: string[]): Buffer {
  const escape = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const body: string[] = [
    "BT",
    "/F1 20 Tf",
    "56 780 Td",
    `(${escape(title)}) Tj`,
    "ET",
    "0.6 w",
    "56 766 m 539 766 l S",
  ];

  let y = 730;
  for (const line of lines) {
    body.push("BT", "/F1 12 Tf", `56 ${y} Td`, `(${escape(line)}) Tj`, "ET");
    y -= 22;
    if (y < 60) break;
  }

  const content = body.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
