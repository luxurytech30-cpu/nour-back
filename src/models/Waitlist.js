const mongoose = require("mongoose");

const waitlistSchema = new mongoose.Schema(
  {
    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    customerName: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: String,
      required: true,
    },
    preferredTime: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    position: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["waiting", "notified", "accepted", "expired", "cancelled"],
      default: "waiting",
    },
    offeredTime: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Waitlist", waitlistSchema);
