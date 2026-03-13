const router = require("express").Router();
const Barber = require("../models/Barber");
const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
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
    if (!r?.start || !r?.end) continue;
    const s = timeToMin(r.start);
    const e = timeToMin(r.end);
    if (s < e) out.push([s, e]);
  }
  return out;
}

function subtractRanges(base, blocks) {
  let result = [...base];

  for (const [bs, be] of blocks) {
    const next = [];

    for (const [s, e] of result) {
      if (be <= s || bs >= e) {
        next.push([s, e]);
      } else {
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
      slots.push({
        start: minToTime(t),
        end: minToTime(t + slotMinutes),
      });
      t += slotMinutes;
    }
  }

  return slots;
}

function getBarberHoursForDate(barber, date) {
  const dow = new Date(`${date}T00:00:00`).getDay();
  const dayKey = String(dow);

  const override = (barber.overrides || []).find((o) => o.date === date);

  if (override?.isClosed) {
    return {
      isClosed: true,
      hours: [],
      breaks: [],
    };
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

  return {
    isClosed: false,
    hours,
    breaks,
  };
}

async function buildBarberAvailability(barber, date) {
  const slotMinutes = Number(barber.slotMinutes || 30);

  const { isClosed, hours, breaks } = getBarberHoursForDate(barber, date);

  if (isClosed) {
    return {
      barberId: String(barber._id),
      barberName: barber.name || "",
      slotMinutes,
      slots: [],
    };
  }

  const openRanges = rangesToMinutes(hours);
  const breakRanges = rangesToMinutes(breaks);

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59.999`);

  const booked = await Appointment.find({
    barberId: barber._id,
    status: { $ne: "cancelled" },
    startAt: { $gte: dayStart, $lte: dayEnd },
  })
    .select("startAt endAt")
    .lean();

  const bookedRanges = booked.map((a) => {
    const s =
      new Date(a.startAt).getHours() * 60 + new Date(a.startAt).getMinutes();
    const e =
      new Date(a.endAt).getHours() * 60 + new Date(a.endAt).getMinutes();
    return [s, e];
  });

  const freeRanges = subtractRanges(openRanges, [
    ...breakRanges,
    ...bookedRanges,
  ]);

  const slots = makeSlots(freeRanges, slotMinutes);

  return {
    barberId: String(barber._id),
    barberName: barber.name || "",
    slotMinutes,
    slots,
  };
}

// GET /api/availability/any/all?date=YYYY-MM-DD
router.get("/any/all", async (req, res) => {
  try {
    const { date } = req.query;

    if (!isDate(date)) {
      return res.status(400).json(fail("date must be YYYY-MM-DD"));
    }

    const barbers = await Barber.find({ isActive: true }).lean();

    if (!barbers.length) {
      return res.json(ok({ date, slotMinutes: 30, slots: [] }));
    }

    const allAvailability = await Promise.all(
      barbers.map((barber) => buildBarberAvailability(barber, date)),
    );

    const slotMap = new Map();

    for (const barberAvailability of allAvailability) {
      for (const slot of barberAvailability.slots) {
        const key = `${slot.start}-${slot.end}`;

        if (!slotMap.has(key)) {
          slotMap.set(key, {
            start: slot.start,
            end: slot.end,
            barbers: [],
          });
        }

        slotMap.get(key).barbers.push({
          _id: barberAvailability.barberId,
          name: barberAvailability.barberName,
        });
      }
    }

    const slots = Array.from(slotMap.values()).sort((a, b) =>
      a.start.localeCompare(b.start),
    );

    res.json(
      ok({
        date,
        slotMinutes: 30,
        slots,
      }),
    );
  } catch (e) {
    res.status(500).json(fail(e.message));
  }
});

// GET /api/availability/:barberId?date=YYYY-MM-DD
router.get("/:barberId", async (req, res) => {
  try {
    const { barberId } = req.params;
    const { date } = req.query;

    if (!isDate(date)) {
      return res.status(400).json(fail("date must be YYYY-MM-DD"));
    }

    const barber = await Barber.findById(barberId).lean();
    if (!barber) {
      return res.status(404).json(fail("Barber not found"));
    }

    const availability = await buildBarberAvailability(barber, date);

    res.json(
      ok({
        date,
        barberId,
        slotMinutes: availability.slotMinutes,
        slots: availability.slots,
      }),
    );
  } catch (e) {
    res.status(500).json(fail(e.message));
  }
});

module.exports = router;
