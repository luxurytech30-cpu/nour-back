// routes/adminDevices.js
const router = require("express").Router();
const AdminDevice = require("../models/AdminDevice");
const { requireAuth } = require("../middleware/auth");
console.log("X in REGISTER ");
router.post("/register", requireAuth, async (req, res) => {
  try {
    console.log("YYYYYY in REGISTER ");
    const { token, platform = "web" } = req.body;

    if (!token) {
      return res.status(400).json({ message: "token is required" });
    }

    await AdminDevice.findOneAndUpdate(
      { token },
      {
        userId: req.user._id,
        token,
        platform,
        enabled: true,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true },
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("register device token error:", error);
    res.status(500).json({ message: "Failed to register device" });
  }
});

module.exports = router;
