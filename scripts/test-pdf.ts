import { extractPdfText } from "../src/lib/ocr";
import { parseReceipt } from "../src/lib/parse-receipt";
import fs from "node:fs";

/** Construit un PDF minimal (texte Helvetica) pour tester l'extraction. */
function buildPdf(lines: string[]): Buffer {
  const content = [
    "BT",
    "/F1 12 Tf",
    "14 TL",
    "50 800 Td",
    ...lines.map((line) => `(${line.replace(/[()\\]/g, "\\$&")}) Tj T*`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body, "latin1");
}

const pdf = buildPdf([
  "CARREFOUR MARKET",
  "12 RUE DE LA PAIX - 75002 PARIS",
  "Date 20/11/2026",
  "TOTAL TTC 42,18",
  "TVA 20,00% 7,03",
  "CARTE BANCAIRE",
]);

async function main() {
  fs.mkdirSync(".cache/debug", { recursive: true });
  fs.writeFileSync(".cache/debug/ticket-test.pdf", pdf);
  const text = await extractPdfText(pdf);
  console.log("--- Texte extrait du PDF ---");
  console.log(text);
  console.log("--- Analyse ---");
  console.log(parseReceipt(text));
}

void main();
