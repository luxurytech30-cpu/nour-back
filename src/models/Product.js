const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true },
    type: { type: String, enum: ["percent", "fixed"], default: "percent" },
    value: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    descrip: { type: String, default: "" },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    isTop: { type: Boolean, default: false },
    sales: { type: [SaleSchema], default: [] },
    copoune: { type: CouponSchema, default: {} }, // keeping your field name
    isActive: { type: Boolean, default: true },
    cate: { type: String, default: "" },
    brand: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);