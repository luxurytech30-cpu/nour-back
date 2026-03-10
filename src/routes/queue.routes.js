const router = require("express").Router();
const Queue = require("../models/Queue");
const { requireAdmin } = require("../middleware/auth");

// create/get main queue (simple)
router.get("/main", async (req, res) => {
  let q = await Queue.findOne({ title: "Main Queue" }).populate("items.barber");
  if (!q) q = await Queue.create({ title: "Main Queue", items: [] });
  res.json(q);
});

// add queue item (admin)
router.post("/main/items", requireAdmin, async (req, res) => {
  const { customerName, phone, barberId, queueLizer } = req.body;
  if (!customerName) return res.status(400).json({ message: "customerName required" });

  const q = await Queue.findOne({ title: "Main Queue" });
  if (!q) return res.status(404).json({ message: "Queue not found" });

  q.items.push({
    customerName,
    phone: phone || "",
    barber: barberId || undefined,
    queueLizer: queueLizer || {},
  });

  await q.save();
  const populated = await Queue.findById(q._id).populate("items.barber");
  res.json(populated);
});

// update item status (admin)
router.patch("/main/items/:itemId", requireAdmin, async (req, res) => {
  const { status } = req.body;
  const q = await Queue.findOne({ title: "Main Queue" });
  if (!q) return res.status(404).json({ message: "Queue not found" });

  const item = q.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: "Item not found" });

  if (status) item.status = status;
  await q.save();
  res.json(q);
});

module.exports = router;