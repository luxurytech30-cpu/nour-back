const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, required: true, trim: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      default: null,
      index: true,
    },

    isMainAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);
