const router = require("express").Router();
const Barber = require("../models/Barber");
const { requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload"); // must export multer middleware
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const isAdmin = (req) => req.session?.user?.role === "admin";
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
  // supports JSON body and multipart/form-data (strings)
  const b = { ...(req.body || {}) };

  // parse JSON strings if sent as formData
  b.weeklyHours = parseMaybeJSON(b.weeklyHours);
  b.weeklyBreaks = parseMaybeJSON(b.weeklyBreaks);
  b.overrides = parseMaybeJSON(b.overrides);

  // cast primitives
  if ("isActive" in b) b.isActive = toBool(b.isActive, true);
  if ("slotMinutes" in b) b.slotMinutes = toNum(b.slotMinutes, 30);

  // trim
  if (typeof b.name === "string") b.name = b.name.trim();
  if (typeof b.phone === "string") b.phone = b.phone.trim();
  if (typeof b.timezone === "string") b.timezone = b.timezone.trim();

  return b;
}

// ---------- GET list ----------
router.get("/", async (req, res) => {
  try {
    console.log("IN get BARBERS");
    const all = String(req.query.all || "false") === "true";
    const activeOnly = String(req.query.activeOnly || "false") === "true";

    // If all=true => admin only
    if (all && !isAdmin(req)) {
      return res.status(403).json({ message: "Admin only" });
    }

    const filter = {};
    if (!all) {
      // public default => only active (or if activeOnly requested)
      filter.isActive = true;
    }
    if (activeOnly) filter.isActive = true;

    const list = await Barber.find(filter).sort({ createdAt: -1 }).lean();
    console.log("LIST: ", list);
    res.json(list);
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
    res.json(barber);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ---------- CREATE (admin) ----------
// expects optional file field name: "image"
router.post("/", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const b = pickBody(req);

    if (!b.name) return res.status(400).json({ message: "Name is required" });

    // if image uploaded -> store on cloudinary
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

    const created = await Barber.create({
      ...b,
      weeklyHours: b.weeklyHours || getDefaultWeeklyHours(),
      weeklyBreaks: b.weeklyBreaks || getDefaultWeeklyBreaks(),
      slotMinutes: b.slotMinutes || 30,
      timezone: b.timezone || "Asia/Jerusalem",
    });
    res.json(created);
  } catch (e) {
    console.error("POST /api/barbers ERROR:", e);
    res.status(500).json({ message: e.message });
  }
});

// ---------- UPDATE (admin) ----------
router.patch("/:id", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const b = pickBody(req);

    const barber = await Barber.findById(req.params.id);
    if (!barber) return res.status(404).json({ message: "Not found" });
    console.log("req.file:", req.file);
    // if new image uploaded -> delete old then upload new
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

    Object.assign(barber, b);
    await barber.save();

    res.json(barber);
  } catch (e) {
    console.error("PATCH /api/barbers/:id ERROR:", e);
    res.status(500).json({ message: e.message });
  }
});

// ---------- DELETE (admin) ----------
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const barber = await Barber.findById(req.params.id);
    if (!barber) return res.status(404).json({ message: "Not found" });

    if (barber.image?.publicId) {
      try {
        await cloudinary.uploader.destroy(barber.image.publicId);
      } catch {}
    }

    await barber.deleteOne();
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
