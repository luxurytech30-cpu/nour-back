const router = require("express").Router();
const AdminDevice = require("../models/AdminDevice");

router.post("/register", async (req, res) => {
  try {
    const { token, platform = "web" } = req.body || {};

    if (!token) {
      return res.status(400).json({ message: "token is required" });
    }

    const doc = await AdminDevice.findOneAndUpdate(
      { token },
      {
        token,
        platform,
        enabled: true,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true },
    );

    res.json({ ok: true, doc });
  } catch (error) {
    console.error("register device token error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to register device" });
  }
});

module.exports = router;
