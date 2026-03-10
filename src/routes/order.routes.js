const router = require("express").Router();
const { requireAuth, requireAdmin } = require("../middleware/auth");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Product = require("../models/Product");

// create order from cart
router.post("/", requireAuth, async (req, res) => {
  const cart = await Cart.findOne({ user: req.session.user.id }).populate("items.product");
  if (!cart || cart.items.length === 0) return res.status(400).json({ message: "Cart empty" });

  // snapshot + total + reduce stock
  let total = 0;
  const items = [];

  for (const it of cart.items) {
    const p = it.product;
    if (!p || !p.isActive) return res.status(400).json({ message: "Product not available" });
    if (p.stock < it.qty) return res.status(400).json({ message: `Not enough stock for ${p.name}` });

    total += p.price * it.qty;
    items.push({
      product: p._id,
      nameSnapshot: p.name,
      priceSnapshot: p.price,
      qty: it.qty,
      imageUrlSnapshot: p.image?.url || "",
    });
  }

  // reduce stock
  for (const it of cart.items) {
    await Product.findByIdAndUpdate(it.product._id, { $inc: { stock: -it.qty } });
  }

  const order = await Order.create({
    user: req.session.user.id,
    items,
    total,
    status: "pending",
  });

  // clear cart
  cart.items = [];
  await cart.save();

  res.json(order);
});

// my orders
router.get("/me", requireAuth, async (req, res) => {
  const orders = await Order.find({ user: req.session.user.id }).sort({ createdAt: -1 });
  res.json(orders);
});

// admin: list all orders
router.get("/", requireAdmin, async (req, res) => {
  const orders = await Order.find().populate("user", "username phone").sort({ createdAt: -1 });
  res.json(orders);
});

// admin: update status
router.patch("/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body;
  const ok = ["pending", "paid", "cancelled"].includes(status);
  if (!ok) return res.status(400).json({ message: "Invalid status" });

  const order = await Order.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
  if (!order) return res.status(404).json({ message: "Not found" });
  res.json(order);
});

module.exports = router;