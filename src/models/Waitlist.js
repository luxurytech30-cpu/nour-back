const mongoose = require("mongoose");

const waitlistSchema = new mongoose.Schema(
  {
    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },

    preferredTime: {
      type: String,
      default: null,
    },

    phone: {
      type: String,
      default: "",
    },

    notes: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["waiting", "notified", "accepted", "expired", "cancelled"],
      default: "waiting",
      index: true,
    },

    position: {
      type: Number,
      default: 0,
    },

    notifiedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

waitlistSchema.index(
  { barberId: 1, date: 1, status: 1, position: 1 },
  { name: "waitlist_queue_idx" },
);

module.exports = mongoose.model("Waitlist", waitlistSchema);
