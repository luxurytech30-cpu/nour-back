require("dotenv").config();

const mongoose = require("mongoose");
const Customer = require("../src/models/Customer");
const {
  normalizeCustomerName,
  normalizeCustomerPhone,
} = require("../src/utils/customerStore");

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Missing MONGO_URI or MONGODB_URI");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  const cursor = Customer.find({}).cursor();
  let scanned = 0;
  let updated = 0;
  const seenNamePhone = new Set();

  for await (const customer of cursor) {
    scanned += 1;

    const normalizedPhone = normalizeCustomerPhone(customer.phone);
    const normalizedName = normalizeCustomerName(customer.name);
    const key = `${normalizedName}|${normalizedPhone}`;

    if (normalizedName && normalizedPhone && seenNamePhone.has(key)) {
      console.warn(
        `Duplicate customer name+phone found: ${customer.name} ${customer.phone} (${customer._id})`,
      );
      continue;
    }

    if (normalizedName && normalizedPhone) {
      seenNamePhone.add(key);
    }

    let changed = false;
    if (normalizedPhone && customer.normalizedPhone !== normalizedPhone) {
      customer.normalizedPhone = normalizedPhone;
      changed = true;
    }

    if (customer.normalizedName !== normalizedName) {
      customer.normalizedName = normalizedName;
      changed = true;
    }

    if (changed) {
      await customer.save();
      updated += 1;
    }
  }

  await Customer.syncIndexes();
  console.log(`Scanned ${scanned} customers, updated ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
