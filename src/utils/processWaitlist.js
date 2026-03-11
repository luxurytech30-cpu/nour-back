const Waitlist = require("../models/Waitlist");
const Barber = require("../models/Barber");
const Appointment = require("../models/Appointment");

function timeToMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function rangesToMinutes(ranges) {
  const out = [];
  for (const r of ranges || []) {
    if (!r?.start || !r?.end) continue;
    const s = timeToMinutes(r.start);
    const e = timeToMinutes(r.end);
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
        start: minutesToTime(t),
        end: minutesToTime(t + slotMinutes),
      });
      t += slotMinutes;
    }
  }
  return slots;
}

async function getAvailableSlotsForBarberDate(barberId, date) {
  const barber = await Barber.findById(barberId).lean();
  if (!barber) return { slots: [], slotMinutes: 30 };

  const slotMinutes = Number(barber.slotMinutes || 30);
  const dow = new Date(`${date}T00:00:00`).getDay();
  const dayKey = String(dow);

  const override = (barber.overrides || []).find((o) => o.date === date);
  if (override?.isClosed) {
    return { slots: [], slotMinutes };
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

  return {
    slotMinutes,
    slots: makeSlots(freeRanges, slotMinutes),
  };
}

async function processWaitlistForBarberDate(barberId, date) {
  const waiting = await Waitlist.find({
    barberId,
    date,
    status: "waiting",
  }).sort({ position: 1, createdAt: 1 });

  if (!waiting.length) return null;

  const availability = await getAvailableSlotsForBarberDate(barberId, date);
  const freeStarts = availability.slots.map((s) => s.start);

  if (!freeStarts.length) return null;

  for (const item of waiting) {
    let matchedTime = null;

    if (item.preferredTime && freeStarts.includes(item.preferredTime)) {
      matchedTime = item.preferredTime;
    } else if (!item.preferredTime) {
      matchedTime = freeStarts[0];
    }

    if (!matchedTime) continue;

    item.status = "notified";
    item.notifiedAt = new Date();
    item.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    item.offeredTime = matchedTime;

    await item.save();

    // here you can send WhatsApp later
    console.log(
      `[WAITLIST] notified customer ${item.customerId} for barber ${barberId} on ${date} at ${matchedTime}`,
    );

    return item;
  }

  return null;
}

module.exports = {
  processWaitlistForBarberDate,
};
