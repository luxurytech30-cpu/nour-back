const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema(
  {
    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
      index: true,
    },

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },

    customerName: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },

    service: { type: String, default: "" },
    notes: { type: String, default: "" },

    status: {
      type: String,
      enum: [
        "booked",
        "checked_in",
        "in_service",
        "done",
        "cancelled",
        "no_show",
      ],
      default: "booked",
      index: true,
    },

    // public self-management without login
    manageToken: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },

    bookingCode: {
      type: String,
      default: null,
      index: true,
    },

    clientCanEdit: {
      type: Boolean,
      default: true,
    },

    // 2 hours = 120 minutes
    clientEditCutoffMinutes: {
      type: Number,
      default: 120,
      min: 0,
    },

    // session user who created it (if logged in admin/user)
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelledAt: { type: Date, default: null },
    cancelledByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

AppointmentSchema.index({ barberId: 1, startAt: 1 });
AppointmentSchema.index({ barberId: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model("Appointment", AppointmentSchema);
