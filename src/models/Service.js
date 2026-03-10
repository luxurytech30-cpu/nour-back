const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true }, // haircut, beard...
    name: { type: String, required: true, trim: true }, // EN
    nameHe: { type: String, default: "", trim: true }, // HE
    price: { type: Number, required: true, min: 0 },
    durationMin: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("service", ServiceSchema);
