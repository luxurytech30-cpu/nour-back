const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    normalizedName: { type: String, default: "", index: true },
    phone: { type: String, required: true, trim: true },
    normalizedPhone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    trusted: { type: Boolean, default: false, index: true },
    source: {
      type: String,
      enum: [
        "pdf_import",
        "xlsx_import",
        "admin",
        "otp",
        "appointment",
        "manual",
      ],
      default: "manual",
    },
    lastVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

CustomerSchema.index({ name: "text", phone: "text", normalizedPhone: "text" });
CustomerSchema.index(
  { normalizedName: 1, normalizedPhone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      normalizedName: { $type: "string", $gt: "" },
      normalizedPhone: { $type: "string", $gt: "" },
    },
  },
);

module.exports = mongoose.model("Customer", CustomerSchema);
