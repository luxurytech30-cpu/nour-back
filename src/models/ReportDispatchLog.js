const mongoose = require("mongoose");

const reportDispatchLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["daily", "monthly"],
      required: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ReportDispatchLog", reportDispatchLogSchema);
