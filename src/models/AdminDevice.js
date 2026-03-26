const mongoose = require("mongoose");

const AdminDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      default: null,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    isMainAdmin: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      default: "admin",
    },
    platform: {
      type: String,
      default: "web",
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.AdminDevice ||
  mongoose.model("AdminDevice", AdminDeviceSchema);
