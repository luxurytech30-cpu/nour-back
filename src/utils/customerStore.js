const Customer = require("../models/Customer");
const { normalizeIsraeliPhone } = require("./sendMessageWa");

function normalizeCustomerPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00972")) return `972${digits.slice(5)}`;
  return normalizeIsraeliPhone(digits);
}

function cleanCustomerName(name) {
  return String(name || "").replace(/\s+/g, " ").trim();
}

function normalizeCustomerName(name) {
  return cleanCustomerName(name).toLocaleLowerCase("he-IL");
}

async function upsertCustomer({
  name = "",
  phone,
  trusted = false,
  source = "manual",
  verifiedAt = null,
  preserveExistingName = false,
}) {
  const normalizedPhone = normalizeCustomerPhone(phone);
  if (!normalizedPhone) return null;

  const cleanName = cleanCustomerName(name);
  const normalizedName = normalizeCustomerName(cleanName);
  const update = {
    $set: {
      phone: String(phone || "").trim() || normalizedPhone,
      source,
    },
    $setOnInsert: {
      normalizedPhone,
    },
  };

  if (cleanName && preserveExistingName) {
    update.$setOnInsert.name = cleanName;
    update.$setOnInsert.normalizedName = normalizedName;
  } else if (cleanName) {
    update.$set.name = cleanName;
    update.$set.normalizedName = normalizedName;
  }
  if (trusted) update.$set.trusted = true;
  if (verifiedAt) update.$set.lastVerifiedAt = verifiedAt;

  return Customer.findOneAndUpdate({ normalizedPhone }, update, {
    returnDocument: "after",
    upsert: true,
  });
}

module.exports = {
  cleanCustomerName,
  normalizeCustomerName,
  normalizeCustomerPhone,
  upsertCustomer,
};
