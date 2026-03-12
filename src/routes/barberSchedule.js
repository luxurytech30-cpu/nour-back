const router = require("express").Router();
const Barber = require("../models/Barber");
const { requireAdmin } = require("../middleware/admin");

// -------- helpers ----------
const ok = (data) => ({ success: true, data });
const fail = (message) => ({ success: false, error: message });

const isTime = (t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
const isDate = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

function normalizeRanges(ranges) {
  const arr = Array.isArray(ranges) ? ranges : [];
  for (const r of arr) {
    if (!isTime(r.start) || !isTime(r.end)) {
      throw new Error("Invalid time format HH:mm");
    }
  }
  return arr;
}

function normalizeMap(mapLike) {
  const out = {};
  const src = mapLike || {};
  for (const k of Object.keys(src)) {
    const day = String(k);
    if (!/^[0-6]$/.test(day)) continue;
    out[day] = normalizeRanges(src[k]);
  }
  return out;
}

function upsertOverride(overrides = [], patch) {
  const next = Array.isArray(overrides) ? [...overrides] : [];
  const idx = next.findIndex((x) => x.date === patch.date);

  if (idx >= 0) next[idx] = { ...next[idx], ...patch };
  else next.push(patch);

  return next.sort((a, b) => a.date.localeCompare(b.date));
}

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

// ---------- PUBLIC READ ----------
router.get("/:barberId", async (req, res) => {
  try {
    const b = await Barber.findById(req.params.barberId).lean();
    if (!b) return res.status(404).json(fail("Barber not found"));

    res.json(
      ok({
        barberId: b._id,
        timezone: b.timezone,
        slotMinutes: b.slotMinutes,
        weeklyHours: b.weeklyHours || {},
        weeklyBreaks: b.weeklyBreaks || {},
        overrides: b.overrides || [],
      }),
    );
  } catch (e) {
    res.status(500).json(fail(e.message));
  }
});

// ---------- ADMIN: set weekly hours ----------
router.put("/:barberId/weekly-hours", requireAdmin, async (req, res) => {
  try {
    const weeklyHours = normalizeMap(req.body.weeklyHours);
    const b = await Barber.findByIdAndUpdate(
      req.params.barberId,
      { $set: { weeklyHours } },
      { new: true },
    ).lean();

    if (!b) return res.status(404).json(fail("Barber not found"));
    res.json(ok(b.weeklyHours));
  } catch (e) {
    res.status(400).json(fail(e.message));
  }
});

// ---------- ADMIN: set weekly breaks ----------
router.put("/:barberId/weekly-breaks", requireAdmin, async (req, res) => {
  try {
    const weeklyBreaks = normalizeMap(req.body.weeklyBreaks);
    const b = await Barber.findByIdAndUpdate(
      req.params.barberId,
      { $set: { weeklyBreaks } },
      { new: true },
    ).lean();

    if (!b) return res.status(404).json(fail("Barber not found"));
    res.json(ok(b.weeklyBreaks));
  } catch (e) {
    res.status(400).json(fail(e.message));
  }
});

// ---------- ADMIN: set FULL weekly schedule ----------
router.put("/:barberId/weekly-schedule", requireAdmin, async (req, res) => {
  try {
    const weeklyHours = normalizeMap(req.body.weeklyHours || {});
    const weeklyBreaks = normalizeMap(req.body.weeklyBreaks || {});
    const slotMinutes = Number(req.body.slotMinutes || 30);
    const timezone = String(req.body.timezone || "Asia/Jerusalem");

    if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) {
      return res
        .status(400)
        .json(fail("slotMinutes must be a positive number"));
    }

    const barber = await Barber.findByIdAndUpdate(
      req.params.barberId,
      {
        $set: {
          weeklyHours,
          weeklyBreaks,
          slotMinutes,
          timezone,
        },
      },
      { new: true },
    ).lean();

    if (!barber) return res.status(404).json(fail("Barber not found"));

    res.json(
      ok({
        barberId: barber._id,
        weeklyHours: barber.weeklyHours || {},
        weeklyBreaks: barber.weeklyBreaks || {},
        slotMinutes: barber.slotMinutes,
        timezone: barber.timezone,
        overrides: barber.overrides || [],
      }),
    );
  } catch (e) {
    res.status(400).json(fail(e.message));
  }
});

// ---------- ADMIN: reset default schedule ----------
router.put(
  "/:barberId/reset-default-schedule",
  requireAdmin,
  async (req, res) => {
    try {
      const barber = await Barber.findByIdAndUpdate(
        req.params.barberId,
        {
          $set: {
            weeklyHours: getDefaultWeeklyHours(),
            weeklyBreaks: getDefaultWeeklyBreaks(),
            slotMinutes: 30,
            timezone: "Asia/Jerusalem",
          },
        },
        { new: true },
      ).lean();

      if (!barber) return res.status(404).json(fail("Barber not found"));

      res.json(
        ok({
          barberId: barber._id,
          weeklyHours: barber.weeklyHours || {},
          weeklyBreaks: barber.weeklyBreaks || {},
          slotMinutes: barber.slotMinutes,
          timezone: barber.timezone,
          overrides: barber.overrides || [],
        }),
      );
    } catch (e) {
      res.status(500).json(fail(e.message));
    }
  },
);

// ---------- ADMIN: block a full date ----------
router.post("/:barberId/block-date", requireAdmin, async (req, res) => {
  try {
    const { date, note = "" } = req.body;
    if (!isDate(date)) {
      return res.status(400).json(fail("date must be YYYY-MM-DD"));
    }

    const barber = await Barber.findById(req.params.barberId);
    if (!barber) return res.status(404).json(fail("Barber not found"));

    barber.overrides = upsertOverride(barber.overrides, {
      date,
      isClosed: true,
      hours: [],
      breaks: [],
      note,
    });

    await barber.save();
    res.json(ok(barber.overrides));
  } catch (e) {
    res.status(500).json(fail(e.message));
  }
});

// ---------- ADMIN: set custom hours/breaks for a specific date ----------
router.post("/:barberId/override-date", requireAdmin, async (req, res) => {
  try {
    const {
      date,
      isClosed = false,
      hours = [],
      breaks = [],
      note = "",
    } = req.body;

    if (!isDate(date)) {
      return res.status(400).json(fail("date must be YYYY-MM-DD"));
    }

    const patch = {
      date,
      isClosed: !!isClosed,
      hours: normalizeRanges(hours),
      breaks: normalizeRanges(breaks),
      note: String(note || ""),
    };

    const barber = await Barber.findById(req.params.barberId);
    if (!barber) return res.status(404).json(fail("Barber not found"));

    barber.overrides = upsertOverride(barber.overrides, patch);
    await barber.save();

    res.json(ok(barber.overrides));
  } catch (e) {
    res.status(400).json(fail(e.message));
  }
});

// ---------- ADMIN: remove override ----------
router.delete(
  "/:barberId/override-date/:date",
  requireAdmin,
  async (req, res) => {
    try {
      const date = req.params.date;
      if (!isDate(date)) {
        return res.status(400).json(fail("date must be YYYY-MM-DD"));
      }

      const barber = await Barber.findById(req.params.barberId);
      if (!barber) return res.status(404).json(fail("Barber not found"));

      barber.overrides = (barber.overrides || []).filter(
        (o) => o.date !== date,
      );

      await barber.save();
      res.json(ok(barber.overrides));
    } catch (e) {
      res.status(500).json(fail(e.message));
    }
  },
);

module.exports = router;
