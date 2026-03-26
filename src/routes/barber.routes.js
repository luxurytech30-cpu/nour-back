const router = require("express").Router();
const Barber = require("../models/Barber");
const User = require("../models/User");
const { requireAdmin } = require("../middleware/admin");
const { requireAuth } = require("../middleware/auth");

const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

function getDefaultWeeklyHours() {
  return {
    0: [{ start: "09:00", end: "18:00" }],
    1: [{ start: "09:00", end: "18:00" }],
    2: [{ start: "09:00", end: "18:00" }],
    3: [{ start: "09:00", end: "18:00" }],
    4: [{ start: "09:00", end: "18:00" }],
    5: [{ start: "09:00", end: "14:00" }],
    6: [],
  };
}

function getDefaultWeeklyBreaks() {
  return {
    0: [{ start: "13:00", end: "13:30" }],
    1: [{ start: "13:00", end: "13:30" }],
    2: [{ start: "13:00", end: "13:30" }],
    3: [{ start: "13:00", end: "13:30" }],
    4: [{ start: "13:00", end: "13:30" }],
    5: [],
    6: [],
  };
}

function uploadBufferToCloudinary(fileBuffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

function parseMaybeJSON(v) {
  if (v === undefined || v === null) return v;
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return v;
  if (!(s.startsWith("{") || s.startsWith("["))) return v;
  try {
    return JSON.parse(s);
  } catch {
    return v;
  }
}

function toBool(v, def = undefined) {
  if (v === undefined || v === null || v === "") return def;
  if (typeof v === "boolean") return v;
  return String(v) === "true";
}

function toNum(v, def = undefined) {
  if (v === undefined || v === null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function pickBody(req) {
  const b = { ...(req.body || {}) };

  b.weeklyHours = parseMaybeJSON(b.weeklyHours);
  b.weeklyBreaks = parseMaybeJSON(b.weeklyBreaks);
  b.overrides = parseMaybeJSON(b.overrides);

  if ("isActive" in b) b.isActive = toBool(b.isActive, true);
  if ("slotMinutes" in b) b.slotMinutes = toNum(b.slotMinutes, 30);
  if ("isMainAdmin" in b) b.isMainAdmin = toBool(b.isMainAdmin, false);

  if (typeof b.name === "string") b.name = b.name.trim();
  if (typeof b.phone === "string") b.phone = b.phone.trim();
  if (typeof b.timezone === "string") b.timezone = b.timezone.trim();
  if (typeof b.username === "string") b.username = b.username.trim();
  if (typeof b.password === "string") b.password = b.password.trim();

  return b;
}

// ---------- GET list ----------
router.get("/", async (req, res) => {
  try {
    const all = String(req.query.all || "false") === "true";
    const activeOnly = String(req.query.activeOnly || "false") === "true";

    const filter = {};
    if (!all) filter.isActive = true;
    if (activeOnly) filter.isActive = true;

    const list = await Barber.find(filter).sort({ createdAt: -1 }).lean();

    const barberIds = list.map((b) => b._id);
    const linkedUsers = await User.find({ barberId: { $in: barberIds } })
      .select("_id username phone role barberId isMainAdmin")
      .lean();

    const userMap = new Map(linkedUsers.map((u) => [String(u.barberId), u]));

    const enriched = list.map((barber) => ({
      ...barber,
      linkedUser: userMap.get(String(barber._id)) || null,
    }));

    res.json(enriched);
  } catch (e) {
    console.error("GET /api/barbers ERROR:", e);
    res.status(500).json({ message: e.message });
  }
});

// ---------- GET one ----------
router.get("/:id", async (req, res) => {
  try {
    const barber = await Barber.findById(req.params.id).lean();
    if (!barber) return res.status(404).json({ message: "Not found" });

    const linkedUser = await User.findOne({ barberId: barber._id })
      .select("_id username phone role barberId isMainAdmin")
      .lean();

    res.json({
      ...barber,
      linkedUser: linkedUser || null,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ---------- CREATE (admin) ----------
router.post(
  "/",
  requireAuth,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const b = pickBody(req);

      if (!b.name) {
        return res.status(400).json({ message: "Name is required" });
      }

      if (!b.username) {
        return res.status(400).json({ message: "Username is required" });
      }

      if (!b.password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const existingUsername = await User.findOne({
        username: b.username,
      }).lean();
      if (existingUsername) {
        return res.status(400).json({ message: "שם המשתמש כבר קיים" });
      }

      if (req.file) {
        const up = await uploadBufferToCloudinary(
          req.file.buffer,
          "nour/barbers",
        );
        b.image = {
          url: up.secure_url,
          publicId: up.public_id,
        };
      }

      const createdBarber = await Barber.create({
        name: b.name,
        phone: b.phone || "",
        isActive: b.isActive ?? true,
        image: b.image || undefined,
        weeklyHours: b.weeklyHours || getDefaultWeeklyHours(),
        weeklyBreaks: b.weeklyBreaks || getDefaultWeeklyBreaks(),
        overrides: Array.isArray(b.overrides) ? b.overrides : [],
        slotMinutes: b.slotMinutes || 30,
        timezone: b.timezone || "Asia/Jerusalem",
      });

      const createdUser = await User.create({
        name: b.name,
        username: b.username,
        password: b.password,
        phone: b.phone || "",
        role: "admin",
        barberId: createdBarber._id,
        isMainAdmin: !!b.isMainAdmin,
      });

      res.json({
        barber: createdBarber,
        user: {
          _id: createdUser._id,
          name: createdUser.name,
          username: createdUser.username,
          phone: createdUser.phone,
          role: createdUser.role,
          barberId: createdUser.barberId,
          isMainAdmin: createdUser.isMainAdmin,
        },
      });
    } catch (e) {
      console.error("POST /api/barbers ERROR:", e);
      res.status(500).json({ message: e.message });
    }
  },
);

// ---------- UPDATE (admin) ----------
router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const b = pickBody(req);

      const barber = await Barber.findById(req.params.id);
      if (!barber) return res.status(404).json({ message: "Not found" });

      if (b.username) {
        const existingUsername = await User.findOne({
          username: b.username,
          barberId: { $ne: barber._id },
        }).lean();

        if (existingUsername) {
          return res.status(400).json({ message: "שם המשתמש כבר קיים" });
        }
      }

      if (req.file) {
        if (barber.image?.publicId) {
          try {
            await cloudinary.uploader.destroy(barber.image.publicId);
          } catch (err) {
            console.error("Failed to delete old Cloudinary image:", err);
          }
        }

        const up = await uploadBufferToCloudinary(
          req.file.buffer,
          "nour/barbers",
        );
        b.image = {
          url: up.secure_url,
          publicId: up.public_id,
        };
      }

      if (typeof b.name !== "undefined") barber.name = b.name;
      if (typeof b.phone !== "undefined") barber.phone = b.phone;
      if (typeof b.isActive !== "undefined") barber.isActive = b.isActive;
      if (typeof b.slotMinutes !== "undefined")
        barber.slotMinutes = b.slotMinutes;
      if (typeof b.timezone !== "undefined") barber.timezone = b.timezone;
      if (typeof b.weeklyHours !== "undefined")
        barber.weeklyHours = b.weeklyHours;
      if (typeof b.weeklyBreaks !== "undefined")
        barber.weeklyBreaks = b.weeklyBreaks;
      if (typeof b.overrides !== "undefined") barber.overrides = b.overrides;
      if (typeof b.image !== "undefined") barber.image = b.image;

      await barber.save();

      let linkedUser = await User.findOne({ barberId: barber._id });

      if (linkedUser) {
        if (typeof b.name !== "undefined") linkedUser.name = b.name;
        if (typeof b.phone !== "undefined") linkedUser.phone = b.phone;
        if (typeof b.username !== "undefined" && b.username)
          linkedUser.username = b.username;
        if (typeof b.password !== "undefined" && b.password)
          linkedUser.password = b.password;
        if (typeof b.isMainAdmin !== "undefined") {
          linkedUser.isMainAdmin = !!b.isMainAdmin;
        }

        linkedUser.role = "admin";
        linkedUser.barberId = barber._id;

        await linkedUser.save();
      } else if (b.username && b.password) {
        linkedUser = await User.create({
          name: barber.name,
          username: b.username,
          password: b.password,
          phone: barber.phone || "",
          role: "admin",
          barberId: barber._id,
          isMainAdmin: !!b.isMainAdmin,
        });
      }

      res.json({
        barber,
        user: linkedUser
          ? {
              _id: linkedUser._id,
              name: linkedUser.name,
              username: linkedUser.username,
              phone: linkedUser.phone,
              role: linkedUser.role,
              barberId: linkedUser.barberId,
              isMainAdmin: linkedUser.isMainAdmin,
            }
          : null,
      });
    } catch (e) {
      console.error("PATCH /api/barbers/:id ERROR:", e);
      res.status(500).json({ message: e.message });
    }
  },
);

// ---------- DELETE (admin) ----------
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const barber = await Barber.findById(req.params.id);
    if (!barber) return res.status(404).json({ message: "Not found" });

    if (barber.image?.publicId) {
      try {
        await cloudinary.uploader.destroy(barber.image.publicId);
      } catch {}
    }

    await User.deleteMany({ barberId: barber._id });
    await barber.deleteOne();

    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
