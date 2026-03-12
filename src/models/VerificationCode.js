const mongoose = require("mongoose");

const verificationCodeSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    name: { type: String, default: "" },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("VerificationCode", verificationCodeSchema);
