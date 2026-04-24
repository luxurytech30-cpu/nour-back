// const router = require("express").Router();
// const mongoose = require("mongoose");

// const Waitlist = require("../models/Waitlist");
// const Appointment = require("../models/Appointment");
// const Barber = require("../models/Barber");
// const Service = require("../models/Service");

// const ok = (data) => ({ success: true, data });
// const fail = (message) => ({ success: false, message });

// function isDate(d) {
//   return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
// }

// function isTime(t) {
//   return t == null || (typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
// }

// function isObjectId(v) {
//   return mongoose.Types.ObjectId.isValid(v);
// }

// async function reindexWaitlist(barberId, date) {
//   const rows = await Waitlist.find({
//     barberId,
//     date,
//     status: "waiting",
//   }).sort({ createdAt: 1, _id: 1 });

//   for (let i = 0; i < rows.length; i++) {
//     const nextPos = i + 1;
//     if (rows[i].position !== nextPos) {
//       rows[i].position = nextPos;
//       await rows[i].save();
//     }
//   }
// }

// async function getNextWaitingItem(barberId, date) {
//   return Waitlist.findOne({
//     barberId,
//     date,
//     status: "waiting",
//   }).sort({ position: 1, createdAt: 1 });
// }

// // POST /api/waitlist
// // join waitlist
// router.post("/", async (req, res) => {
//   try {
//     const {
//       barberId,
//       serviceId,
//       customerId,
//       customerName = "",
//       date,
//       preferredTime = null,
//       phone = "",
//       notes = "",
//     } = req.body;

//     if (!barberId || !serviceId || !date) {
//       return res.status(400).json(fail("Missing required fields"));
//     }

//     if (!customerId && !String(customerName).trim()) {
//       return res.status(400).json(fail("customerName is required"));
//     }

//     if (!String(phone).trim()) {
//       return res.status(400).json(fail("phone is required"));
//     }

//     if (!isObjectId(barberId)) {
//       return res.status(400).json(fail("Invalid barberId"));
//     }

//     if (!isObjectId(serviceId)) {
//       return res.status(400).json(fail("Invalid serviceId"));
//     }

//     if (customerId && !isObjectId(customerId)) {
//       return res.status(400).json(fail("Invalid customerId"));
//     }

//     if (!isDate(date)) {
//       return res.status(400).json(fail("date must be YYYY-MM-DD"));
//     }

//     if (!isTime(preferredTime)) {
//       return res.status(400).json(fail("preferredTime must be HH:mm"));
//     }

//     const [barber, service] = await Promise.all([
//       Barber.findById(barberId).select("_id name isActive").lean(),
//       Service.findById(serviceId).select("_id name active").lean(),
//     ]);

//     if (!barber) {
//       return res.status(404).json(fail("Barber not found"));
//     }

//     if (!service) {
//       return res.status(404).json(fail("Service not found"));
//     }

//     const cleanPhone = String(phone || "").trim();

//     const existingActiveAppointmentQuery = {
//       status: { $nin: ["done", "cancelled", "no_show"] },
//       $or: [],
//     };

//     if (customerId) {
//       existingActiveAppointmentQuery.$or.push({ createdByUserId: customerId });
//     }

//     if (cleanPhone) {
//       existingActiveAppointmentQuery.$or.push({ phone: cleanPhone });
//     }

//     if (existingActiveAppointmentQuery.$or.length > 0) {
//       const existingActiveAppointment = await Appointment.findOne(
//         existingActiveAppointmentQuery,
//       ).lean();

//       if (existingActiveAppointment) {
//         return res
//           .status(400)
//           .json(fail("כבר קיים תור פעיל, אי אפשר להצטרף לרשימת ההמתנה"));
//       }
//     }

//     const duplicateFilter = {
//       barberId,
//       date,
//       status: { $in: ["waiting", "notified"] },
//     };

//     if (customerId) {
//       duplicateFilter.customerId = customerId;
//     } else {
//       duplicateFilter.phone = cleanPhone;
//     }

//     const existing = await Waitlist.findOne(duplicateFilter);

//     if (existing) {
//       return res
//         .status(400)
//         .json(fail("אתה כבר ברשימת ההמתנה של הספר בתאריך הזה"));
//     }

//     const activeCount = await Waitlist.countDocuments({
//       barberId,
//       date,
//       status: "waiting",
//     });

//     if (activeCount >= 3) {
//       return res
//         .status(400)
//         .json(fail("רשימת ההמתנה מלאה עבור הספר בתאריך הזה"));
//     }

//     const item = await Waitlist.create({
//       barberId,
//       serviceId,
//       customerId: customerId || null,
//       customerName: String(customerName || "").trim(),
//       date,
//       preferredTime,
//       phone: cleanPhone,
//       notes: String(notes || "").trim(),
//       position: activeCount + 1,
//       status: "waiting",
//     });

//     return res.json(ok(item));
//   } catch (e) {
//     console.error("POST /api/waitlist error:", e);
//     return res.status(500).json(fail(e.message));
//   }
// });

// // GET /api/waitlist?barberId=...&date=...
// router.get("/", async (req, res) => {
//   try {
//     const { barberId, date, customerId, status } = req.query;

//     const filter = {};

//     if (barberId) {
//       if (!isObjectId(barberId)) {
//         return res.status(400).json(fail("Invalid barberId"));
//       }
//       filter.barberId = barberId;
//     }

//     if (customerId) {
//       if (!isObjectId(customerId)) {
//         return res.status(400).json(fail("Invalid customerId"));
//       }
//       filter.customerId = customerId;
//     }

//     if (date) {
//       if (!isDate(date)) {
//         return res.status(400).json(fail("date must be YYYY-MM-DD"));
//       }
//       filter.date = date;
//     }

//     if (status) {
//       filter.status = status;
//     } else {
//       filter.status = { $in: ["waiting", "notified"] };
//     }

//     const items = await Waitlist.find(filter)
//       .populate("barberId", "name")
//       .populate("serviceId", "name")
//       .populate("customerId", "name phone email")
//       .sort({ date: 1, position: 1, createdAt: 1 })
//       .lean();

//     return res.json(ok(items));
//   } catch (e) {
//     console.error("GET /api/waitlist error:", e);
//     return res.status(500).json(fail(e.message));
//   }
// });

// // DELETE /api/waitlist/:id
// // leave waitlist
// router.delete("/:id", async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!isObjectId(id)) {
//       return res.status(400).json(fail("Invalid waitlist id"));
//     }

//     const item = await Waitlist.findById(id);
//     if (!item) {
//       return res.status(404).json(fail("Waitlist item not found"));
//     }

//     item.status = "cancelled";
//     item.position = 0;
//     await item.save();

//     await reindexWaitlist(item.barberId, item.date);

//     return res.json(ok({ deleted: true }));
//   } catch (e) {
//     console.error("DELETE /api/waitlist/:id error:", e);
//     return res.status(500).json(fail(e.message));
//   }
// });

// // POST /api/waitlist/:id/accept
// // accept waitlist offer
// router.post("/:id/accept", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { time = null } = req.body;

//     if (!isObjectId(id)) {
//       return res.status(400).json(fail("Invalid waitlist id"));
//     }

//     if (!isTime(time)) {
//       return res.status(400).json(fail("time must be HH:mm"));
//     }

//     const item = await Waitlist.findById(id);
//     if (!item) {
//       return res.status(404).json(fail("Waitlist item not found"));
//     }

//     if (item.status !== "notified") {
//       return res.status(400).json(fail("Offer is not active"));
//     }

//     if (item.expiresAt && item.expiresAt < new Date()) {
//       item.status = "expired";
//       item.position = 0;
//       await item.save();
//       await reindexWaitlist(item.barberId, item.date);
//       return res.status(400).json(fail("Offer expired"));
//     }

//     const appointmentTime = item.offeredTime || item.preferredTime || time;

//     if (!appointmentTime) {
//       return res
//         .status(400)
//         .json(fail("No appointment time available for this waitlist offer"));
//     }

//     const alreadyBooked = await Appointment.findOne({
//       barberId: item.barberId,
//       date: item.date,
//       time: appointmentTime,
//       status: { $nin: ["cancelled"] },
//     }).lean();

//     if (alreadyBooked) {
//       return res.status(400).json(fail("This time is no longer available"));
//     }

//     const appointment = await Appointment.create({
//       customerId: item.customerId,
//       barberId: item.barberId,
//       serviceId: item.serviceId,
//       date: item.date,
//       time: appointmentTime,
//       status: "confirmed",
//       source: "waitlist",
//     });

//     item.status = "accepted";
//     item.position = 0;
//     await item.save();

//     await reindexWaitlist(item.barberId, item.date);

//     return res.json(ok({ appointment, waitlist: item }));
//   } catch (e) {
//     console.error("POST /api/waitlist/:id/accept error:", e);
//     return res.status(500).json(fail(e.message));
//   }
// });

// // POST /api/waitlist/:id/expire
// // manually expire current offer
// router.post("/:id/expire", async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!isObjectId(id)) {
//       return res.status(400).json(fail("Invalid waitlist id"));
//     }

//     const item = await Waitlist.findById(id);
//     if (!item) {
//       return res.status(404).json(fail("Waitlist item not found"));
//     }

//     item.status = "expired";
//     item.position = 0;
//     await item.save();

//     await reindexWaitlist(item.barberId, item.date);

//     const nextItem = await getNextWaitingItem(item.barberId, item.date);

//     return res.json(
//       ok({
//         expired: true,
//         nextWaitlistId: nextItem?._id || null,
//       }),
//     );
//   } catch (e) {
//     console.error("POST /api/waitlist/:id/expire error:", e);
//     return res.status(500).json(fail(e.message));
//   }
// });

// module.exports = router;

const router = require("express").Router();
const mongoose = require("mongoose");
const crypto = require("crypto");

const Waitlist = require("../models/Waitlist");
const Appointment = require("../models/Appointment");
const Barber = require("../models/Barber");
const Service = require("../models/Service");
const BarberBookingLock = require("../models/BarberBookingLock");
const { processWaitlistForBarberDate } = require("../utils/processWaitlist");
const {
  sendWhatsAppToPhone,
  normalizeIsraeliPhone,
} = require("../utils/sendMessageWa");
const { normalizeCustomerPhone } = require("../utils/customerStore");
const {
  BLOCKING_CUSTOMER_STATUSES,
  buildCustomerFutureAppointmentQuery,
} = require("../utils/appointmentRules");

const ok = (data) => ({ success: true, data });
const fail = (message) => ({ success: false, message });

const ADMIN_WHATSAPP_PHONE = process.env.ADMIN_WHATSAPP_PHONE || "0543596761";

function isDate(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isTime(t) {
  return t == null || (typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
}

function isObjectId(v) {
  return mongoose.Types.ObjectId.isValid(v);
}

function generateManageToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generateBookingCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withBarberBookingLock(barberId, work) {
  const normalizedBarberId =
    typeof barberId === "object" && barberId?._id
      ? String(barberId._id)
      : String(barberId || "");

  const ownerToken = crypto.randomBytes(16).toString("hex");
  const startedAt = Date.now();

  while (true) {
    try {
      await BarberBookingLock.create({
        barberId: normalizedBarberId,
        ownerToken,
        expiresAt: new Date(Date.now() + 15000),
      });
      break;
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      await BarberBookingLock.deleteOne({
        barberId: normalizedBarberId,
        expiresAt: { $lte: new Date() },
      });

      if (Date.now() - startedAt > 5000) {
        throw createHttpError(
          409,
          "מישהו בדיוק תופס את התור הזה עכשיו. נסה שוב בעוד רגע.",
        );
      }

      await sleep(80);
    }
  }

  try {
    return await work();
  } finally {
    await BarberBookingLock.deleteOne({
      barberId: normalizedBarberId,
      ownerToken,
    }).catch((error) =>
      console.error("Failed to release waitlist barber lock:", error.message),
    );
  }
}

function makeStartEnd(date, time, slotMinutes = 30) {
  const startAt = new Date(`${date}T${time}:00`);
  const endAt = new Date(startAt);
  endAt.setMinutes(endAt.getMinutes() + slotMinutes);
  return { startAt, endAt };
}

async function reindexWaitlist(barberId, date) {
  const rows = await Waitlist.find({
    barberId,
    date,
    status: "waiting",
  }).sort({ createdAt: 1, _id: 1 });

  for (let i = 0; i < rows.length; i++) {
    const nextPos = i + 1;
    if (rows[i].position !== nextPos) {
      rows[i].position = nextPos;
      await rows[i].save();
    }
  }
}

async function getNextWaitingItem(barberId, date) {
  return Waitlist.findOne({
    barberId,
    date,
    status: "waiting",
  }).sort({ position: 1, createdAt: 1 });
}

async function notifyWaitlistJoined(item, barber, service) {
  try {
    const customerName = item.customerName || "לקוח";
    const barberName = barber?.name || "הספר";
    const serviceName = service?.name || "השירות";

    const adminMessage = `הצטרפות לרשימת המתנה 🕒
לקוח: ${customerName}
טלפון: ${item.phone || "-"}
ספר: ${barberName}
שירות: ${serviceName}
תאריך: ${item.date}
שעה מועדפת: ${item.preferredTime || "לא נבחרה"}`;

    const customerMessage = `היי ${customerName},
נרשמת בהצלחה לרשימת ההמתנה 🕒

ספר: ${barberName}
שירות: ${serviceName}
תאריך: ${item.date}
שעה מועדפת: ${item.preferredTime || "לא נבחרה"}

נעדכן אותך אם יתפנה תור.`;

    await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, adminMessage);

    if (normalizeIsraeliPhone(item.phone)) {
      await sendWhatsAppToPhone(item.phone, customerMessage);
    }
  } catch (err) {
    console.error("notifyWaitlistJoined error:", err.message);
  }
}

async function notifyWaitlistAccepted(item, appointment, barber, service) {
  try {
    const customerName = item.customerName || "לקוח";
    const barberName = barber?.name || "הספר";
    const serviceName = service?.name || "השירות";
    const bookingCode = appointment.bookingCode || "-";

    const dateText = appointment.startAt
      ? new Date(appointment.startAt).toLocaleDateString("he-IL")
      : item.date;

    const timeText = appointment.startAt
      ? new Date(appointment.startAt).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : item.offeredTime || item.preferredTime || "-";

    const adminMessage = `המתנה התקבלה ✅
לקוח: ${customerName}
טלפון: ${item.phone || "-"}
ספר: ${barberName}
שירות: ${serviceName}
תאריך: ${dateText}
שעה: ${timeText}
קוד הזמנה: ${bookingCode}`;

    const customerMessage = `היי ${customerName},
התור מרשימת ההמתנה אושר בהצלחה ✅

ספר: ${barberName}
שירות: ${serviceName}
תאריך: ${dateText}
שעה: ${timeText}
קוד הזמנה: ${bookingCode}`;

    await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, adminMessage);

    if (normalizeIsraeliPhone(item.phone)) {
      await sendWhatsAppToPhone(item.phone, customerMessage);
    }
  } catch (err) {
    console.error("notifyWaitlistAccepted error:", err.message);
  }
}

// POST /api/waitlist
router.post("/", async (req, res) => {
  try {
    const {
      barberId,
      serviceId,
      customerId,
      customerName = "",
      date,
      preferredTime = null,
      phone = "",
      notes = "",
    } = req.body;

    if (!barberId || !serviceId || !date) {
      return res.status(400).json(fail("Missing required fields"));
    }

    if (!customerId && !String(customerName).trim()) {
      return res.status(400).json(fail("customerName is required"));
    }

    if (!String(phone).trim()) {
      return res.status(400).json(fail("phone is required"));
    }

    if (!isObjectId(barberId)) {
      return res.status(400).json(fail("Invalid barberId"));
    }

    if (!isObjectId(serviceId)) {
      return res.status(400).json(fail("Invalid serviceId"));
    }

    if (customerId && !isObjectId(customerId)) {
      return res.status(400).json(fail("Invalid customerId"));
    }

    if (!isDate(date)) {
      return res.status(400).json(fail("date must be YYYY-MM-DD"));
    }

    if (!isTime(preferredTime)) {
      return res.status(400).json(fail("preferredTime must be HH:mm"));
    }

    const [barber, service] = await Promise.all([
      Barber.findById(barberId).select("_id name isActive slotMinutes").lean(),
      Service.findById(serviceId).select("_id name active").lean(),
    ]);

    if (!barber) {
      return res.status(404).json(fail("Barber not found"));
    }

    if (!service) {
      return res.status(404).json(fail("Service not found"));
    }

    const cleanPhone = String(phone || "").trim();
    const normalizedPhone = normalizeCustomerPhone(cleanPhone);

    const existingActiveAppointmentQuery = buildCustomerFutureAppointmentQuery({
      customerId,
      phone: cleanPhone,
      normalizedPhone,
      now: new Date(),
      statuses: BLOCKING_CUSTOMER_STATUSES,
    });

    if (existingActiveAppointmentQuery.$or.length > 0) {
      const existingActiveAppointment = await Appointment.findOne(
        existingActiveAppointmentQuery,
      ).lean();

      if (existingActiveAppointment) {
        return res
          .status(400)
          .json(fail("כבר קיים תור פעיל, אי אפשר להצטרף לרשימת ההמתנה"));
      }
    }

    const duplicateFilter = {
      barberId,
      date,
      status: { $in: ["waiting", "notified"] },
    };

    if (customerId) {
      duplicateFilter.customerId = customerId;
    } else {
      duplicateFilter.phone = cleanPhone;
    }

    const existing = await Waitlist.findOne(duplicateFilter);

    if (existing) {
      return res
        .status(400)
        .json(fail("אתה כבר ברשימת ההמתנה של הספר בתאריך הזה"));
    }

    const activeCount = await Waitlist.countDocuments({
      barberId,
      date,
      status: "waiting",
    });

    if (activeCount >= 3) {
      return res
        .status(400)
        .json(fail("רשימת ההמתנה מלאה עבור הספר בתאריך הזה"));
    }

    const item = await Waitlist.create({
      barberId,
      serviceId,
      customerId: customerId || null,
      customerName: String(customerName || "").trim(),
      date,
      preferredTime,
      phone: cleanPhone,
      notes: String(notes || "").trim(),
      position: activeCount + 1,
      status: "waiting",
    });

    notifyWaitlistJoined(item, barber, service).catch((err) =>
      console.error("notifyWaitlistJoined error:", err.message),
    );

    return res.json(ok(item));
  } catch (e) {
    console.error("POST /api/waitlist error:", e);
    return res.status(500).json(fail(e.message));
  }
});

// GET /api/waitlist?barberId=...&date=...
router.get("/", async (req, res) => {
  try {
    const { barberId, date, customerId, status } = req.query;

    const filter = {};

    if (barberId) {
      if (!isObjectId(barberId)) {
        return res.status(400).json(fail("Invalid barberId"));
      }
      filter.barberId = barberId;
    }

    if (customerId) {
      if (!isObjectId(customerId)) {
        return res.status(400).json(fail("Invalid customerId"));
      }
      filter.customerId = customerId;
    }

    if (date) {
      if (!isDate(date)) {
        return res.status(400).json(fail("date must be YYYY-MM-DD"));
      }
      filter.date = date;
    }

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ["waiting", "notified"] };
    }

    const items = await Waitlist.find(filter)
      .populate("barberId", "name")
      .populate("serviceId", "name")
      .populate("customerId", "name phone email")
      .sort({ date: 1, position: 1, createdAt: 1 })
      .lean();

    return res.json(ok(items));
  } catch (e) {
    console.error("GET /api/waitlist error:", e);
    return res.status(500).json(fail(e.message));
  }
});

// DELETE /api/waitlist/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res.status(400).json(fail("Invalid waitlist id"));
    }

    const item = await Waitlist.findById(id);
    if (!item) {
      return res.status(404).json(fail("Waitlist item not found"));
    }

    item.status = "cancelled";
    item.position = 0;
    await item.save();

    await reindexWaitlist(item.barberId, item.date);

    return res.json(ok({ deleted: true }));
  } catch (e) {
    console.error("DELETE /api/waitlist/:id error:", e);
    return res.status(500).json(fail(e.message));
  }
});

// POST /api/waitlist/:id/accept
router.post("/:id/accept", async (req, res) => {
  try {
    const { id } = req.params;
    const { time = null } = req.body;

    if (!isObjectId(id)) {
      return res.status(400).json(fail("Invalid waitlist id"));
    }

    if (!isTime(time)) {
      return res.status(400).json(fail("time must be HH:mm"));
    }

    const item = await Waitlist.findById(id);
    if (!item) {
      return res.status(404).json(fail("Waitlist item not found"));
    }

    if (item.status !== "notified") {
      return res.status(400).json(fail("Offer is not active"));
    }

    if (item.expiresAt && item.expiresAt < new Date()) {
      item.status = "expired";
      item.position = 0;
      await item.save();
      await reindexWaitlist(item.barberId, item.date);

      processWaitlistForBarberDate(item.barberId, item.date).catch((err) =>
        console.error("processWaitlistForBarberDate error:", err.message),
      );

      return res.status(400).json(fail("Offer expired"));
    }

    const appointmentTime = item.offeredTime || item.preferredTime || time;

    if (!appointmentTime) {
      return res
        .status(400)
        .json(fail("No appointment time available for this waitlist offer"));
    }

    const barber = await Barber.findById(item.barberId).lean();
    if (!barber) {
      return res.status(404).json(fail("Barber not found"));
    }

    const service = await Service.findById(item.serviceId).lean();
    if (!service) {
      return res.status(404).json(fail("Service not found"));
    }

    const slotMinutes = Number(barber.slotMinutes || 30);
    const { startAt, endAt } = makeStartEnd(
      item.date,
      appointmentTime,
      slotMinutes,
    );

    const appointment = await withBarberBookingLock(item.barberId, async () => {
      const alreadyBooked = await Appointment.findOne({
        barberId: item.barberId,
        status: { $ne: "cancelled" },
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      }).lean();

      if (alreadyBooked) {
        throw createHttpError(400, "השעה הזו כבר לא זמינה.");
      }

      return Appointment.create({
        barberId: item.barberId,
        startAt,
        endAt,
        customerName: item.customerName || "לקוח",
        phone: item.phone || "",
        service: service.name || "",
        notes: item.notes || "",
        status: "booked",
        source: "waitlist",
        manageToken: generateManageToken(),
        bookingCode: generateBookingCode(),
        clientCanEdit: true,
        clientEditCutoffMinutes: 120,
        createdByUserId: item.customerId || null,
      });
    });

    item.status = "accepted";
    item.position = 0;
    await item.save();

    await reindexWaitlist(item.barberId, item.date);

    notifyWaitlistAccepted(item, appointment, barber, service).catch((err) =>
      console.error("notifyWaitlistAccepted error:", err.message),
    );

    return res.json(ok({ appointment, waitlist: item }));
  } catch (e) {
    console.error("POST /api/waitlist/:id/accept error:", e);
    return res.status(e.status || 500).json(fail(e.message));
  }
});

// POST /api/waitlist/:id/expire
router.post("/:id/expire", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res.status(400).json(fail("Invalid waitlist id"));
    }

    const item = await Waitlist.findById(id);
    if (!item) {
      return res.status(404).json(fail("Waitlist item not found"));
    }

    item.status = "expired";
    item.position = 0;
    await item.save();

    await reindexWaitlist(item.barberId, item.date);

    processWaitlistForBarberDate(item.barberId, item.date).catch((err) =>
      console.error("processWaitlistForBarberDate error:", err.message),
    );

    const nextItem = await getNextWaitingItem(item.barberId, item.date);

    return res.json(
      ok({
        expired: true,
        nextWaitlistId: nextItem?._id || null,
      }),
    );
  } catch (e) {
    console.error("POST /api/waitlist/:id/expire error:", e);
    return res.status(500).json(fail(e.message));
  }
});

module.exports = router;
