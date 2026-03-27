const mongoose = require("mongoose");

const GalleryImageSchema = new mongoose.Schema(
  {
    image: {
      url: { type: String, required: true, trim: true },
      publicId: { type: String, required: true, trim: true },
    },
    title: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.GalleryImage ||
  mongoose.model("GalleryImage", GalleryImageSchema);
