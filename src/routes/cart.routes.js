const router = require("express").Router();
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { requireAuth } = require("../middleware/auth");

router.get("/", requireAuth, async (req, res) => {
  const cart = await Cart.findOne({ user: req.session.user.id }).populate("items.product");
  res.json(cart || { user: req.session.user.id, items: [] });
});

router.post("/set", requireAuth, async (req, res) => {
  // body: { items: [{product, qty}] }
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ message: "items array required" });

  // minimal validation
  for (const it of items) {
    const p = await Product.findById(it.product);
    if (!p) return res.status(400).json({ message: `Invalid product ${it.product}` });
  }

  const cart = await Cart.findOneAndUpdate(
    { user: req.session.user.id },
    { $set: { items } },
    { upsert: true, new: true }
  );

  res.json(cart);
});

router.post("/clear", requireAuth, async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.session.user.id }, { $set: { items: [] } }, { upsert: true });
  res.json({ message: "cleared" });
});

module.exports = router;