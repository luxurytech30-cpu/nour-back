// const Waitlist = require("../models/Waitlist");
// const Barber = require("../models/Barber");
// const Appointment = require("../models/Appointment");
// const Service = require("../models/Service");
// const { sendWhatsAppToPhone } = require("./sendMessageWa");

// function timeToMinutes(t) {
//   const [h, m] = String(t).split(":").map(Number);
//   return h * 60 + m;
// }

// function minutesToTime(total) {
//   const hh = String(Math.floor(total / 60)).padStart(2, "0");
//   const mm = String(total % 60).padStart(2, "0");
//   return `${hh}:${mm}`;
// }

// function rangesToMinutes(ranges) {
//   const out = [];
//   for (const r of ranges || []) {
//     if (!r?.start || !r?.end) continue;
//     const s = timeToMinutes(r.start);
//     const e = timeToMinutes(r.end);
//     if (s < e) out.push([s, e]);
//   }
//   return out;
// }

// function subtractRanges(base, blocks) {
//   let result = [...base];

//   for (const [bs, be] of blocks) {
//     const next = [];
//     for (const [s, e] of result) {
//       if (be <= s || bs >= e) {
//         next.push([s, e]);
//       } else {
//         if (bs > s) next.push([s, bs]);
//         if (be < e) next.push([be, e]);
//       }
//     }
//     result = next;
//   }

//   return result;
// }

// function makeSlots(openRanges, slotMinutes) {
//   const slots = [];
//   for (const [s, e] of openRanges) {
//     let t = s;
//     while (t + slotMinutes <= e) {
//       slots.push({
//         start: minutesToTime(t),
//         end: minutesToTime(t + slotMinutes),
//       });
//       t += slotMinutes;
//     }
//   }
//   return slots;
// }

// async function getAvailableSlotsForBarberDate(barberId, date) {
//   const barber = await Barber.findById(barberId).lean();
//   if (!barber) return { slots: [], slotMinutes: 30 };

//   const slotMinutes = Number(barber.slotMinutes || 30);
//   const dow = new Date(`${date}T00:00:00`).getDay();
//   const dayKey = String(dow);

//   const override = (barber.overrides || []).find((o) => o.date === date);
//   if (override?.isClosed) {
//     return { slots: [], slotMinutes };
//   }

//   const hours = override?.hours?.length
//     ? override.hours
//     : (barber.weeklyHours?.get
//         ? barber.weeklyHours.get(dayKey)
//         : barber.weeklyHours?.[dayKey]) || [];

//   const breaks = override?.breaks?.length
//     ? override.breaks
//     : (barber.weeklyBreaks?.get
//         ? barber.weeklyBreaks.get(dayKey)
//         : barber.weeklyBreaks?.[dayKey]) || [];

//   const openRanges = rangesToMinutes(hours);
//   const breakRanges = rangesToMinutes(breaks);

//   const dayStart = new Date(`${date}T00:00:00`);
//   const dayEnd = new Date(`${date}T23:59:59.999`);

//   const booked = await Appointment.find({
//     barberId,
//     status: { $ne: "cancelled" },
//     startAt: { $gte: dayStart, $lte: dayEnd },
//   })
//     .select("startAt endAt")
//     .lean();

//   const bookedRanges = booked.map((a) => {
//     const s = a.startAt.getHours() * 60 + a.startAt.getMinutes();
//     const e = a.endAt.getHours() * 60 + a.endAt.getMinutes();
//     return [s, e];
//   });

//   const freeRanges = subtractRanges(openRanges, [
//     ...breakRanges,
//     ...bookedRanges,
//   ]);

//   return {
//     slotMinutes,
//     slots: makeSlots(freeRanges, slotMinutes),
//   };
// }

// async function notifyWaitlistOffer(item, barberId, date, matchedTime) {
//   try {
//     if (!item?.phone) return;

//     const [barber, service] = await Promise.all([
//       Barber.findById(barberId).select("name").lean(),
//       Service.findById(item.serviceId).select("name").lean(),
//     ]);

//     const barberName = barber?.name || "הספר";
//     const serviceName = service?.name || "השירות";
//     const customerName = item.customerName || "לקוח";

//     const expiresText = item.expiresAt
//       ? new Date(item.expiresAt).toLocaleString("he-IL", {
//           year: "numeric",
//           month: "2-digit",
//           day: "2-digit",
//           hour: "2-digit",
//           minute: "2-digit",
//         })
//       : "בהקדם";

//     const message = `שלום ${customerName},
// התפנה לך תור ✅

// ספר: ${barberName}
// שירות: ${serviceName}
// תאריך: ${date}
// שעה: ${matchedTime}

// נא לאשר לפני: ${expiresText}`;

//     await sendWhatsAppToPhone(item.phone, message);

//     console.log(
//       `[WAITLIST] WhatsApp sent to ${item.phone} for barber ${barberName} on ${date} at ${matchedTime}`,
//     );
//   } catch (err) {
//     console.error("notifyWaitlistOffer error:", err.message);
//   }
// }

// async function processWaitlistForBarberDate(barberId, date) {
//   const waiting = await Waitlist.find({
//     barberId,
//     date,
//     status: "waiting",
//   }).sort({ position: 1, createdAt: 1 });

//   if (!waiting.length) return null;

//   const availability = await getAvailableSlotsForBarberDate(barberId, date);
//   const freeStarts = availability.slots.map((s) => s.start);

//   if (!freeStarts.length) return null;

//   for (const item of waiting) {
//     let matchedTime = null;

//     if (item.preferredTime && freeStarts.includes(item.preferredTime)) {
//       matchedTime = item.preferredTime;
//     } else if (!item.preferredTime) {
//       matchedTime = freeStarts[0];
//     }

//     if (!matchedTime) continue;

//     item.status = "notified";
//     item.notifiedAt = new Date();
//     item.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
//     item.offeredTime = matchedTime;

//     await item.save();

//     await notifyWaitlistOffer(item, barberId, date, matchedTime);

//     console.log(
//       `[WAITLIST] notified customer ${item.customerId || item.phone} for barber ${barberId} on ${date} at ${matchedTime}`,
//     );

//     return item;
//   }

//   return null;
// }

// module.exports = {
//   processWaitlistForBarberDate,
// };
const Waitlist = require("../models/Waitlist");
const Barber = require("../models/Barber");
const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
const { sendWhatsAppToPhone } = require("./sendMessageWa");

const ADMIN_WHATSAPP_PHONE = process.env.ADMIN_WHATSAPP_PHONE || "0543596761";

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

async function reindexWaitlist(barberId, date) {
  const rows = await Waitlist.find({
    barberId,
    date,
    status: "waiting",
  }).sort({ position: 1, createdAt: 1, _id: 1 });

  for (let i = 0; i < rows.length; i++) {
    const nextPos = i + 1;
    if (rows[i].position !== nextPos) {
      rows[i].position = nextPos;
      await rows[i].save();
    }
  }
}

async function expireOldNotifiedItems(barberId, date) {
  const now = new Date();

  const expiredItems = await Waitlist.find({
    barberId,
    date,
    status: "notified",
    expiresAt: { $lt: now },
  });

  if (!expiredItems.length) return;

  for (const item of expiredItems) {
    item.status = "expired";
    item.position = 0;
    await item.save();
  }

  await reindexWaitlist(barberId, date);
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

async function notifyWaitlistOffer(item, barberId, date, matchedTime) {
  try {
    if (!item?.phone) return;

    const [barber, service] = await Promise.all([
      Barber.findById(barberId).select("name").lean(),
      Service.findById(item.serviceId).select("name").lean(),
    ]);

    const barberName = barber?.name || "הספר";
    const serviceName = service?.name || "השירות";
    const customerName = item.customerName || "לקוח";

    const expiresText = item.expiresAt
      ? new Date(item.expiresAt).toLocaleString("he-IL", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "בהקדם";

    const customerMessage = `שלום ${customerName},
התפנה לך תור ✅

ספר: ${barberName}
שירות: ${serviceName}
תאריך: ${date}
שעה: ${matchedTime}

נא לאשר לפני: ${expiresText}`;

    const adminMessage = `נשלחה הצעת המתנה 📩
לקוח: ${customerName}
טלפון: ${item.phone}
ספר: ${barberName}
שירות: ${serviceName}
תאריך: ${date}
שעה: ${matchedTime}
תוקף עד: ${expiresText}`;

    await sendWhatsAppToPhone(item.phone, customerMessage);
    await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, adminMessage);

    console.log(
      `[WAITLIST] WhatsApp sent to ${item.phone} for barber ${barberName} on ${date} at ${matchedTime}`,
    );
  } catch (err) {
    console.error("notifyWaitlistOffer error:", err.message);
  }
}

async function processWaitlistForBarberDate(barberId, date) {
  await expireOldNotifiedItems(barberId, date);

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

    const existingActiveOffer = await Waitlist.findOne({
      barberId,
      date,
      status: "notified",
      offeredTime: matchedTime,
      expiresAt: { $gt: new Date() },
      _id: { $ne: item._id },
    }).lean();

    if (existingActiveOffer) {
      continue;
    }

    item.status = "notified";
    item.notifiedAt = new Date();
    item.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    item.offeredTime = matchedTime;

    await item.save();

    await notifyWaitlistOffer(item, barberId, date, matchedTime);

    console.log(
      `[WAITLIST] notified customer ${item.customerId || item.phone} for barber ${barberId} on ${date} at ${matchedTime}`,
    );

    return item;
  }

  return null;
}

module.exports = {
  processWaitlistForBarberDate,
};
