const router = require("express").Router();
const AdminDevice = require("../models/AdminDevice");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { resolveUserBarberId } = require("../utils/resolveUserBarberId");

router.post("/register", requireAuth, async (req, res) => {
  try {
    const {
      token,
      platform = "web",
      role = "",
    } = req.body || {};

    if (!token) {
      return res.status(400).json({ message: "token is required" });
    }

    const userId = req.user?._id || req.user?.id || null;
    const currentUser = userId ? await User.findById(userId).lean() : null;

    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const targetBarberId = await resolveUserBarberId(currentUser);

    const doc = await AdminDevice.findOneAndUpdate(
      { token },
      {
        $set: {
          token,
          platform,
          enabled: true,
          lastSeenAt: new Date(),
          userId,
          barberId: targetBarberId,
          isMainAdmin: !!currentUser.isMainAdmin,
          role: currentUser.role || role || "",
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
