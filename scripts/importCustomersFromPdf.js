require("dotenv").config();

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { connectDB } = require("../src/config/db");
const { normalizeCustomerPhone, upsertCustomer } = require("../src/utils/customerStore");

const DEFAULT_PDF_PATH = "c:/Users/הילאל/Downloads/nour_barber.pdf";

function decodePdfGlyph(code) {
  if (code >= 0x13 && code <= 0x1c) return String(code - 0x13);
  if (code === 0x03) return " ";
  if (code === 0x08) return "(";
  if (code === 0x0b) return ")";
  if (code === 0x0f) return ",";
  if (code === 0x10) return "-";
  if (code === 0x31) return ".";
  return String.fromCharCode(code - 3);
}

function decodeHexText(hex) {
  let text = "";
  for (let i = 0; i < hex.length; i += 4) {
    text += decodePdfGlyph(parseInt(hex.slice(i, i + 4), 16));
  }
  return text;
}

function extractPdfText(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  let offset = 0;
  let text = "";

  while ((offset = buffer.indexOf(Buffer.from("stream\n"), offset)) >= 0) {
    const streamStart = offset + 7;
    const streamEnd = buffer.indexOf(Buffer.from("\nendstream"), streamStart);
    if (streamEnd < 0) break;

    try {
      const inflated = zlib.inflateSync(buffer.subarray(streamStart, streamEnd));
      const stream = inflated.toString("latin1");

      for (const match of stream.matchAll(/<([0-9A-Fa-f]+)>/g)) {
        text += decodeHexText(match[1]);
      }
      text += "\n";
    } catch (error) {
      // Some streams are not Flate encoded text streams.
    }

    offset = streamEnd + 10;
  }

  return text;
}

function extractCustomers(text) {
  const candidates = text.match(/(?:00972|972|0)[\d\s-]{8,18}/g) || [];
  const byPhone = new Map();

  for (const candidate of candidates) {
    const normalizedPhone = normalizeCustomerPhone(candidate);
    if (!/^9725\d{8}$/.test(normalizedPhone)) continue;

    const localPhone = normalizedPhone.startsWith("972")
      ? `0${normalizedPhone.slice(3)}`
      : normalizedPhone;

    byPhone.set(normalizedPhone, {
      name: "",
      phone: localPhone,
      normalizedPhone,
    });
  }

  return [...byPhone.values()].sort((a, b) =>
    a.normalizedPhone.localeCompare(b.normalizedPhone),
  );
}

async function main() {
  const pdfArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const pdfPath = path.resolve(pdfArg || DEFAULT_PDF_PATH);
  const dryRun = process.argv.includes("--dry-run");

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const customers = extractCustomers(extractPdfText(pdfPath));
  console.log(`Extracted ${customers.length} unique customer phones`);

  if (dryRun) {
    console.log(JSON.stringify(customers.slice(0, 20), null, 2));
    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await connectDB(process.env.MONGO_URI);

  let imported = 0;
  for (const customer of customers) {
    await upsertCustomer({
      name: customer.name,
      phone: customer.phone,
      trusted: true,
      source: "pdf_import",
      verifiedAt: new Date(),
    });
    imported += 1;
  }

  console.log(`Imported ${imported} trusted customers`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
