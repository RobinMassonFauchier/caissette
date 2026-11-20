import { preprocessImage, recognizeImage } from "../src/lib/ocr";
import { parseReceipt } from "../src/lib/parse-receipt";
import sharp from "sharp";

const svg = `<svg width="900" height="1200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f7f5ef"/>
  <g font-family="Consolas, monospace" font-size="27" fill="#222">
    <text x="70" y="100">CARREFOUR MARKET</text>
    <text x="70" y="140">12 RUE DE LA PAIX</text>
    <text x="70" y="180">75002 PARIS</text>
    <text x="70" y="240">Date 20/11/2026  12:34</text>
    <text x="70" y="320">PAIN        1,20</text>
    <text x="70" y="360">LAIT        2,45</text>
    <text x="70" y="400">DIVERS     38,53</text>
    <text x="70" y="480">TOTAL TTC  42,18</text>
    <text x="70" y="520">TVA 20%     7,03</text>
    <text x="70" y="600">CARTE BANCAIRE</text>
    <text x="70" y="680">MERCI DE VOTRE VISITE</text>
  </g>
</svg>`;

async function main() {
  const image = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  console.log(`Image de test : ${(image.length / 1024).toFixed(1)} Ko`);

  const started = Date.now();
  const preprocessed = await preprocessImage(image);
  await sharp(preprocessed).toFile(".cache/debug/test-ocr-preprocessed.png");
  const text = await recognizeImage(preprocessed);
  console.log(`OCR terminé en ${((Date.now() - started) / 1000).toFixed(1)} s — ${text.length} caractères`);
  console.log("--- Texte OCR ---");
  console.log(text);
  console.log("--- Analyse ---");
  console.log(parseReceipt(text));
  process.exit(0);
}

void main();
