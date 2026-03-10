const mongoose = require("mongoose");

const TimeRangeSchema = new mongoose.Schema(
  {
    start: { type: String, required: true }, // "09:00"
    end: { type: String, required: true }, // "17:00"
  },
  { _id: false },
);

const DateOverrideSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    isClosed: { type: Boolean, default: false },
    hours: { type: [TimeRangeSchema], default: [] },
    breaks: { type: [TimeRangeSchema], default: [] },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const BarberSchema = new mongoose.Schema(
  {
    // existing
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // new
    timezone: { type: String, default: "Asia/Jerusalem" },
    slotMinutes: { type: Number, default: 30 },

    weeklyHours: { type: Map, of: [TimeRangeSchema], default: {} }, // "0".."6"
    weeklyBreaks: { type: Map, of: [TimeRangeSchema], default: {} }, // "0".."6"

    overrides: { type: [DateOverrideSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Barber", BarberSchema);
