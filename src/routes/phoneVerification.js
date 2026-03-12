const router = require("express").Router();
const crypto = require("crypto");
const VerificationCode = require("../models/VerificationCode.js");
const { sendWhatsAppMessage } = require("../utils/sendMessageWa.js");

function normalizeIsraeliPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

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

    const normalizedPhone = normalizeIsraeliPhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 11) {
      return res.status(400).json({ message: "Invalid phone" });
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

    const chatId = `${normalizedPhone}@c.us`;

    await sendWhatsAppMessage(
      chatId,
      `שלום ${String(name).trim()}, קוד האימות שלך הוא: ${code}\nהקוד תקף ל-10 דקות.`,
    );

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

    const normalizedPhone = String(phone).replace(/\D/g, "").startsWith("972")
      ? String(phone).replace(/\D/g, "")
      : `972${String(phone).replace(/\D/g, "").replace(/^0/, "")}`;

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

    return res.json({ success: true, verified: true });
  } catch (e) {
    console.error("VERIFY OTP ERROR:", e);
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;
