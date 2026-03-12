const express = require("express");
const Service = require("../models/Service");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }

  next();
}

/**
 * PUBLIC
 * GET /api/services?active=1
 */
router.get("/", async (req, res) => {
  try {
    const onlyActive = String(req.query.active || "") === "1";
    const filter = onlyActive ? { isActive: true } : {};

    const services = await Service.find(filter).sort({
      sortOrder: 1,
      createdAt: -1,
    });

    res.json({ services });
  } catch (err) {
    res.status(500).json({ message: "Failed to list services" });
  }
});

/**
 * ADMIN
 */
router.get("/admin/all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const services = await Service.find({}).sort({
      sortOrder: 1,
      createdAt: -1,
    });

    res.json({ services });
  } catch (err) {
    res.status(500).json({ message: "Failed to list services" });
  }
});

router.post("/admin", requireAdmin, async (req, res) => {
  try {
    const { name, price, durationMin } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    if (price === undefined || durationMin === undefined) {
      return res
        .status(400)
        .json({ message: "price and durationMin are required" });
    }

    const cleanName = String(name).trim();

    const generatedKey = cleanName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u0590-\u05ff-]+/g, "");

    const created = await Service.create({
      key: generatedKey,
      name: cleanName,
      price: Number(price),
      durationMin: Number(durationMin),
      isActive: req.body.isActive ?? true,
      sortOrder: Number(req.body.sortOrder ?? 0),
      description: String(req.body.description ?? "").trim(),
    });

    res.status(201).json({ service: created });
  } catch (err) {
    console.error("CREATE SERVICE ERROR:", err);

    if (String(err?.code) === "11000") {
      return res
        .status(409)
        .json({ message: "Service name/key already exists" });
    }

    res.status(500).json({ message: "Failed to create service" });
  }
});
router.patch("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const { name, price, durationMin, isActive, sortOrder, description } =
      req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    const cleanName = String(name).trim();

    const generatedKey = cleanName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u0590-\u05ff-]+/g, "");

    const updated = await Service.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          key: generatedKey,
          name: cleanName,
          price: Number(price),
          durationMin: Number(durationMin),
          isActive: isActive ?? true,
          sortOrder: Number(sortOrder ?? 0),
          description: String(description ?? "").trim(),
        },
      },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json({ service: updated });
  } catch (err) {
    console.error("UPDATE SERVICE ERROR:", err);

    if (String(err?.code) === "11000") {
      return res
        .status(409)
        .json({ message: "Service name/key already exists" });
    }

    res.status(500).json({ message: "Failed to update service" });
  }
});

router.delete("/admin/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await Service.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: "Failed to delete service" });
  }
});

module.exports = router;
