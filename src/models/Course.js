const mongoose = require("mongoose");

const CourseDateSchema = new mongoose.Schema(
  {
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    zoomLink: { type: String, default: "" },
  },
  { _id: false }
);

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["online", "zoom"], required: true }, // online, zoom
    dates: { type: [CourseDateSchema], default: [] }, // with dates
    barber: { type: mongoose.Schema.Types.ObjectId, ref: "Barber" }, // + in barber
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", CourseSchema);