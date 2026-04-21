const router = require("express").Router();
const VerificationCode = require("../models/VerificationCode.js");
const Customer = require("../models/Customer.js");
const { sendWhatsAppToPhone } = require("../utils/sendMessageWa.js");
const {
  normalizeCustomerPhone,
  upsertCustomer,
} = require("../utils/customerStore.js");

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/send", async (req, res) => {
  try {
    console.log("SEND content-type:", req.headers["content-type"]);
    console.log("SEND body:", req.body);

    const body = req.body || {};
    const { name, phone } = body;

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!phone) {
      return res.status(400).json({ message: "Phone is required" });
    }

    const normalizedPhone = normalizeCustomerPhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 11) {
      return res.status(400).json({ message: "Invalid phone" });
    }

    const trustedCustomer = await Customer.findOne({
      normalizedPhone,
      trusted: true,
    }).lean();

    if (trustedCustomer) {
      await upsertCustomer({
        name: trustedCustomer.name || name,
        phone,
        trusted: true,
        source: trustedCustomer.source || "manual",
        verifiedAt: new Date(),
        preserveExistingName: true,
      });

      return res.json({
        success: true,
        verified: true,
        trusted: true,
        message: "Customer already authorized",
      });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await VerificationCode.create({
      phone: normalizedPhone,
      code,
      name: String(name).trim(),
      expiresAt,
      isUsed: false,
    });

    const sendResult = await sendWhatsAppToPhone(
      normalizedPhone,
      `שלום ${String(name).trim()}, קוד האימות שלך הוא: ${code}\nהקוד תקף ל-10 דקות.`,
    );

    console.log("OTP WhatsApp send result:", sendResult);

    return res.json({ success: true, message: "Code sent" });
  } catch (e) {
    console.error("SEND OTP ERROR:", e);
    return res.status(500).json({ message: e.message });
  }
});

router.post("/verify", async (req, res) => {
  try {
    console.log("VERIFY content-type:", req.headers["content-type"]);
    console.log("VERIFY body:", req.body);

    const body = req.body || {};
    const { phone, code } = body;

    if (!phone || !code) {
      return res.status(400).json({ message: "Phone and code are required" });
    }

    const normalizedPhone = normalizeCustomerPhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Invalid phone" });
    }

    const row = await VerificationCode.findOne({
      phone: normalizedPhone,
      code: String(code).trim(),
      isUsed: false,
    }).sort({ createdAt: -1 });

    if (!row) {
      return res.status(400).json({ message: "Invalid code" });
    }

    if (row.expiresAt < new Date()) {
      return res.status(400).json({ message: "Code expired" });
    }

    row.isUsed = true;
    row.usedAt = new Date();
    await row.save();

    await upsertCustomer({
      name: row.name || "",
      phone: normalizedPhone,
      trusted: true,
      source: "otp",
      verifiedAt: new Date(),
    });

    return res.json({ success: true, verified: true });
  } catch (e) {
    console.error("VERIFY OTP ERROR:", e);
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;
