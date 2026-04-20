require("dotenv").config();

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const Customer = require("../src/models/Customer");
const { connectDB } = require("../src/config/db");
const {
  cleanCustomerName,
  normalizeCustomerPhone,
  upsertCustomer,
} = require("../src/utils/customerStore");

const DEFAULT_XLSX_PATH = "c:/Users/הילאל/Downloads/nour_customers_list_v2.xlsx";

const WIN1252_REVERSE = new Map(
  Object.entries({
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  }).map(([key, value]) => [Number(key), value]),
);

function xmlDecode(value = "") {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function fixMojibake(value = "") {
  const text = String(value || "");
  if (!/[×ØÙÃÂ]/.test(text)) return text;

  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code <= 0xff) {
      bytes.push(code);
    } else if (WIN1252_REVERSE.has(code)) {
      bytes.push(WIN1252_REVERSE.get(code));
    } else {
      return text;
    }
  }

  const fixed = Buffer.from(bytes).toString("utf8");
  return fixed.includes("�") ? text : fixed;
}

function findEndOfCentralDirectory(buffer) {
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Invalid xlsx zip: missing central directory");
}

function readZipEntries(filePath) {
  const buffer = fs.readFileSync(filePath);
  const eocd = findEndOfCentralDirectory(buffer);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const entries = new Map();
  let offset = centralOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid xlsx zip: bad central directory entry");
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    let data;
    if (method === 0) {
      data = compressed;
    } else if (method === 8) {
      data = zlib.inflateRawSync(compressed);
    } else {
      throw new Error(`Unsupported zip compression method: ${method}`);
    }

    entries.set(fileName, data.toString("utf8"));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readSharedStrings(xml = "") {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => {
    const parts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(
      (part) => xmlDecode(part[1]),
    );
    return fixMojibake(parts.join(""));
  });
}

function readSheetRows(xml = "", sharedStrings = []) {
  return [...xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map(
    (rowMatch) => {
      const row = {};

      for (const cellMatch of rowMatch[2].matchAll(
        /<c[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g,
      )) {
        const col = cellMatch[1];
        const attrs = cellMatch[2];
        const valueMatch = cellMatch[3].match(/<v>([\s\S]*?)<\/v>/);
        if (!valueMatch) continue;

        const raw = xmlDecode(valueMatch[1]);
        row[col] = attrs.includes('t="s"')
          ? sharedStrings[Number(raw)] || ""
          : raw;
      }

      return row;
    },
  );
}

function extractCustomersFromXlsx(xlsxPath) {
  const entries = readZipEntries(xlsxPath);
  const sharedStrings = readSharedStrings(entries.get("xl/sharedStrings.xml"));
  const rows = readSheetRows(entries.get("xl/worksheets/sheet1.xml"), sharedStrings);
  const header = rows[0] || {};
  const phoneCol =
    Object.entries(header).find(([, value]) => String(value).toLowerCase() === "phone")?.[0] ||
    "A";
  const nameCol =
    Object.entries(header).find(([, value]) => String(value).toLowerCase() === "name")?.[0] ||
    "B";
  const byPhone = new Map();

  for (const row of rows.slice(1)) {
    const phone = String(row[phoneCol] || "").trim();
    const normalizedPhone = normalizeCustomerPhone(phone);
    if (!/^9725\d{8}$/.test(normalizedPhone)) continue;

    const localPhone = `0${normalizedPhone.slice(3)}`;
    byPhone.set(normalizedPhone, {
      name: cleanCustomerName(row[nameCol] || ""),
      phone: localPhone,
      normalizedPhone,
    });
  }

  return [...byPhone.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "he"),
  );
}

async function main() {
  const xlsxArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const xlsxPath = path.resolve(xlsxArg || DEFAULT_XLSX_PATH);
  const dryRun = process.argv.includes("--dry-run");
  const replaceImported = process.argv.includes("--replace-imported");

  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`XLSX not found: ${xlsxPath}`);
  }

  const customers = extractCustomersFromXlsx(xlsxPath);
  console.log(`Extracted ${customers.length} unique customers from xlsx`);

  if (dryRun) {
    console.log(JSON.stringify(customers.slice(0, 20), null, 2));
    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await connectDB(process.env.MONGO_URI);

  if (replaceImported) {
    const deleted = await Customer.deleteMany({
      source: { $in: ["pdf_import", "xlsx_import"] },
    });
    console.log(`Deleted ${deleted.deletedCount} previously imported customers`);
  }

  let imported = 0;
  for (const customer of customers) {
    await upsertCustomer({
      name: customer.name,
      phone: customer.phone,
      trusted: true,
      source: "xlsx_import",
      verifiedAt: new Date(),
    });
    imported += 1;
  }

  console.log(`Imported ${imported} trusted customers from xlsx`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
