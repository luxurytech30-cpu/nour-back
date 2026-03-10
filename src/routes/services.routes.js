const express = require("express");
const Service = require("../models/Service");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
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

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    if (price === undefined || durationMin === undefined) {
      return res
        .status(400)
        .json({ message: "price and durationMin are required" });
    }

    const generatedKey = String(name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "");

    const created = await Service.create({
      key: generatedKey,
      name: String(name).trim(),
      nameHe: String(req.body.nameHe ?? "").trim(),
      price: Number(price),
      durationMin: Number(durationMin),
      isActive: req.body.isActive ?? true,
      sortOrder: Number(req.body.sortOrder ?? 0),
      description: String(req.body.description ?? "").trim(),
    });

    res.status(201).json({ service: created });
  } catch (err) {
    if (String(err?.code) === "11000") {
      return res
        .status(409)
        .json({ message: "Service name/key already exists" });
    }
    res.status(500).json({ message: "Failed to create service" });
  }
});

router.patch("/admin/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const allowed = [
      "key",
      "name",
      "nameHe",
      "price",
      "durationMin",
      "isActive",
      "sortOrder",
      "description",
    ];

    const updates = {};

    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    if (updates.key !== undefined)
      updates.key = String(updates.key).trim().toLowerCase();
    if (updates.name !== undefined) updates.name = String(updates.name).trim();
    if (updates.nameHe !== undefined)
      updates.nameHe = String(updates.nameHe).trim();
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.durationMin !== undefined)
      updates.durationMin = Number(updates.durationMin);
    if (updates.sortOrder !== undefined)
      updates.sortOrder = Number(updates.sortOrder);
    if (updates.description !== undefined)
      updates.description = String(updates.description).trim();

    const updated = await Service.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json({ service: updated });
  } catch (err) {
    if (String(err?.code) === "11000") {
      return res.status(409).json({ message: "Service key already exists" });
    }
    res.status(400).json({ message: "Failed to update service" });
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
