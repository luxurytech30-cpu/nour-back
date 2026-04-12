const router = require("express").Router();
const mongoose = require("mongoose");
const AdminDevice = require("../models/AdminDevice");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { resolveUserBarberId } = require("../utils/resolveUserBarberId");

router.post("/register", requireAuth, async (req, res) => {
  try {
    const {
      token,
      barberId: bodyBarberId = null,
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

    const resolvedBarberId = await resolveUserBarberId(currentUser);
    const targetBarberId =
      currentUser.barberId ||
      resolvedBarberId ||
      (mongoose.isValidObjectId(bodyBarberId) ? bodyBarberId : null);

    console.log("ADMIN DEVICE REGISTER:", {
      userId: userId ? String(userId) : null,
      username: currentUser.username || null,
      userBarberId: currentUser.barberId ? String(currentUser.barberId) : null,
      bodyBarberId,
      resolvedBarberId: resolvedBarberId ? String(resolvedBarberId) : null,
      targetBarberId: targetBarberId ? String(targetBarberId) : null,
      isMainAdmin: !!currentUser.isMainAdmin,
      tokenPreview: token ? `${token.slice(0, 20)}...` : null,
      platform,
    });

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
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    );

    console.log("ADMIN DEVICE SAVED:", {
      deviceId: String(doc._id),
      userId: doc.userId ? String(doc.userId) : null,
      barberId: doc.barberId ? String(doc.barberId) : null,
      enabled: doc.enabled,
      tokenPreview: doc.token ? `${doc.token.slice(0, 20)}...` : null,
      updatedAt: doc.updatedAt,
    });

    res.json({ ok: true, doc });
  } catch (error) {
    console.error("register device token error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to register device" });
  }
});

module.exports = router;
