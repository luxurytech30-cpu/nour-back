const router = require("express").Router();
const Barber = require("../models/Barber");
const Appointment = require("../models/Appointment"); // your appointments model

const fail = (message) => ({ success: false, error: message });
const ok = (data) => ({ success: true, data });

const isDate = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

function timeToMin(t) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

function minToTime(m) {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function rangesToMinutes(ranges) {
  const out = [];
  for (const r of ranges || []) {
    const s = timeToMin(r.start);
    const e = timeToMin(r.end);
    if (s < e) out.push([s, e]);
  }
  return out;
}

function subtractRanges(base, blocks) {
  // base/blocks are arrays of [start,end] in minutes
  let result = [...base];
  for (const [bs, be] of blocks) {
    const next = [];
    for (const [s, e] of result) {
      if (be <= s || bs >= e)
        next.push([s, e]); // no overlap
      else {
        if (bs > s) next.push([s, bs]);
        if (be < e) next.push([be, e]);
      }
    }
    result = next;
  }
  return result;
}

function makeSlots(openRanges, slotMinutes) {
  const slots = [];
  for (const [s, e] of openRanges) {
    let t = s;
    while (t + slotMinutes <= e) {
      slots.push({ start: minToTime(t), end: minToTime(t + slotMinutes) });
      t += slotMinutes;
    }
  }
  return slots;
}

// GET /api/availability/:barberId?date=YYYY-MM-DD
router.get("/:barberId", async (req, res) => {
  try {
    const { barberId } = req.params;
    const { date } = req.query;
    if (!isDate(date))
      return res.status(400).json(fail("date must be YYYY-MM-DD"));

    const barber = await Barber.findById(barberId).lean();
    if (!barber) return res.status(404).json(fail("Barber not found"));

    // ✅ use service duration if provided
    const durationMin = Math.max(0, Number(req.query.durationMin || 0));
    const slotMinutes = durationMin || Number(barber.slotMinutes || 30);

    // day of week 0..6 (Sunday=0)
    const dow = new Date(`${date}T00:00:00`).getDay();
    const dayKey = String(dow);

    // apply override if exists
    const override = (barber.overrides || []).find((o) => o.date === date);

    if (override?.isClosed) {
      return res.json(ok({ date, barberId, slots: [] }));
    }

    const hours = override?.hours?.length
      ? override.hours
      : (barber.weeklyHours?.get
          ? barber.weeklyHours.get(dayKey)
          : barber.weeklyHours?.[dayKey]) || [];

    const breaks = override?.breaks?.length
      ? override.breaks
      : (barber.weeklyBreaks?.get
          ? barber.weeklyBreaks.get(dayKey)
          : barber.weeklyBreaks?.[dayKey]) || [];

    const openRanges = rangesToMinutes(hours);
    const breakRanges = rangesToMinutes(breaks);

    // booked appointments for that day
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);

    const booked = await Appointment.find({
      barberId,
      status: { $ne: "cancelled" },
      startAt: { $gte: dayStart, $lte: dayEnd },
    })
      .select("startAt endAt")
      .lean();

    const bookedRanges = booked.map((a) => {
      const s = a.startAt.getHours() * 60 + a.startAt.getMinutes();
      const e = a.endAt.getHours() * 60 + a.endAt.getMinutes();
      return [s, e];
    });

    const freeRanges = subtractRanges(openRanges, [
      ...breakRanges,
      ...bookedRanges,
    ]);
    const slots = makeSlots(freeRanges, slotMinutes);

    res.json(ok({ date, barberId, slotMinutes, slots }));
  } catch (e) {
    res.status(500).json(fail(e.message));
  }
});

module.exports = router;
