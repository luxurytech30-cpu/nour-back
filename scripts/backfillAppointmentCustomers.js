require("dotenv").config();

const mongoose = require("mongoose");
const Appointment = require("../src/models/Appointment");
const { normalizeCustomerPhone, upsertCustomer } = require("../src/utils/customerStore");

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Missing MONGO_URI or MONGODB_URI");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  const cursor = Appointment.find({ phone: { $ne: "" } }).cursor();
  let scanned = 0;
  let updated = 0;
  let customersTouched = 0;

  for await (const appointment of cursor) {
    scanned += 1;
    const normalizedPhone = normalizeCustomerPhone(appointment.phone);

    if (!normalizedPhone) continue;

    if (appointment.normalizedPhone !== normalizedPhone) {
      appointment.normalizedPhone = normalizedPhone;
      await appointment.save();
      updated += 1;
    }

    const customer = await upsertCustomer({
      name: appointment.customerName,
      phone: appointment.phone,
      trusted: false,
      source: "appointment",
    });

    if (customer) customersTouched += 1;
  }

  console.log(
    `Scanned ${scanned} appointments, updated ${updated}, touched ${customersTouched} customers`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
