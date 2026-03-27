const router = require("express").Router();
const AdminDevice = require("../models/AdminDevice");
// const { requireAuth } = require("../middleware/requireAuth");

router.post("/register", async (req, res) => {
  try {
    const {
      token,
      platform = "web",
      barberId = null,
      isMainAdmin = false,
      role = "",
    } = req.body || {};

    if (!token) {
      return res.status(400).json({ message: "token is required" });
    }

    const userId = req.user?._id || req.user?.id || null;

    const doc = await AdminDevice.findOneAndUpdate(
      { token },
      {
        $set: {
          token,
          platform,
          enabled: true,
          lastSeenAt: new Date(),
          userId,
          barberId: barberId || req.user?.barberId || null,
          isMainAdmin:
            typeof isMainAdmin === "boolean"
              ? isMainAdmin
              : !!req.user?.isMainAdmin,
          role: role || req.user?.role || "",
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
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
