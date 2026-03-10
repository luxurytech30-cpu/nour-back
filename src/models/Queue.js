const mongoose = require("mongoose");

const QueueLizerSchema = new mongoose.Schema(
  {
    lizer: { type: String, default: "" },
    care: { type: String, default: "" }, // (+care)
  },
  { _id: false }
);

const QueueItemSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    barber: { type: mongoose.Schema.Types.ObjectId, ref: "Barber" }, // choose barber
    status: { type: String, enum: ["waiting", "in_service", "done", "cancelled"], default: "waiting" },
    queueLizer: { type: QueueLizerSchema, default: {} },
  },
  { timestamps: true }
);

const QueueSchema = new mongoose.Schema(
  {
    title: { type: String, default: "Main Queue" },
    items: { type: [QueueItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Queue", QueueSchema);