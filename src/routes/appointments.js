const router = require("express").Router();
const crypto = require("crypto");
const Appointment = require("../models/Appointment");
const Barber = require("../models/Barber");
const { requireAuth } = require("../middleware/auth");
const { validateAppointmentAgainstSchedule } = require("../utils/schedule");
const {
  sendWhatsAppToPhone,
  normalizeIsraeliPhone,
} = require("../utils/sendMessageWa");
const { processWaitlistForBarberDate } = require("../utils/processWaitlist");
const { sendPushToRelevantAdmins } = require("../utils/sendPushToAdmins");

console.log("✅ appointments routes file loaded");

const isAdmin = (req) => req.user?.role === "admin";
const ADMIN_WHATSAPP_PHONE = process.env.ADMIN_WHATSAPP_PHONE || "0543596761";

function generateManageToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generateBookingCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatAppointmentDateTime(startAt, endAt) {
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;

  const date = start ? start.toLocaleDateString("he-IL") : "-";

  const time = start
    ? `${start.toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      })}${
        end
          ? ` - ${end.toLocaleTimeString("he-IL", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : ""
      }`
    : "-";

  return { date, time };
}
async function getAppointmentBarberName(appointment) {
  try {
    if (!appointment?.barberId) return "-";

    if (
      typeof appointment.barberId === "object" &&
      appointment.barberId?.name
    ) {
      return appointment.barberId.name;
    }

    const barber = await Barber.findById(appointment.barberId)
      .select("name")
      .lean();

    return barber?.name || "-";
  } catch (err) {
    console.error("getAppointmentBarberName error:", err.message);
    return "-";
  }
}

function getAppointmentBarberId(appointment) {
  if (!appointment?.barberId) return null;

  if (typeof appointment.barberId === "object" && appointment.barberId?._id) {
    return appointment.barberId._id;
  }

  return appointment.barberId;
}
function getDateOnlyFromStartAt(startAt) {
  if (!startAt) return "";
  return new Date(startAt).toISOString().slice(0, 10);
}

function triggerWaitlistForAppointment(appointment) {
  const barberId =
    typeof appointment?.barberId === "object"
      ? appointment?.barberId?._id
      : appointment?.barberId;

  const date = getDateOnlyFromStartAt(appointment?.startAt);

  if (!barberId || !date) return;

  processWaitlistForBarberDate(barberId, date).catch((err) =>
    console.error("processWaitlistForBarberDate error:", err.message),
  );
}

function canClientManageAppointment(appointment) {
  if (!appointment) return false;
  if (!appointment.clientCanEdit) return false;
  if (appointment.status === "cancelled") return false;
  if (appointment.status === "done") return false;
  if (appointment.status === "no_show") return false;

  const cutoffMinutes = Number(appointment.clientEditCutoffMinutes || 180);
  const now = new Date();
  const diffMs = new Date(appointment.startAt).getTime() - now.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes >= cutoffMinutes;
}

function buildDayRange(date) {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59.999`);
  return { dayStart, dayEnd };
}

async function validateBarberScheduleOrFail(barberId, startAt, endAt) {
  const barber = await Barber.findById(barberId).lean();
  if (!barber) {
    return { ok: false, status: 404, message: "Barber not found" };
  }

  const scheduleCheck = validateAppointmentAgainstSchedule(
    barber,
    new Date(startAt),
    new Date(endAt),
  );

  if (!scheduleCheck.ok) {
    return { ok: false, status: 400, message: scheduleCheck.message };
  }

  return { ok: true, barber };
}

async function findOverlap({ barberId, startAt, endAt, excludeId = null }) {
  const query = {
    barberId,
    status: { $ne: "cancelled" },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Appointment.findOne(query).lean();
}

async function notifyAppointmentCreated(appointment) {
  try {
    const { date, time } = formatAppointmentDateTime(
      appointment.startAt,
      appointment.endAt,
    );

    const customerPhone = normalizeIsraeliPhone(appointment.phone);
    const bookingCode = appointment.bookingCode || "-";
    const customerName = appointment.customerName || "לקוח";
    const service = appointment.service || "-";
    const barberName = await getAppointmentBarberName(appointment);
    const barberId = getAppointmentBarberId(appointment);

    const adminMessage = `תור חדש נקבע ✅
לקוח: ${customerName}
טלפון: ${appointment.phone || "-"}
ספר: ${barberName}
שירות: ${service}
תאריך: ${date}
שעה: ${time}
קוד הזמנה: ${bookingCode}`;

    const customerMessage = `היי ${customerName},
התור שלך נקבע בהצלחה ✅

ספר: ${barberName}
שירות: ${service}
תאריך: ${date}
שעה: ${time}
קוד הזמנה: ${bookingCode}`;

    await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, adminMessage);

    await sendPushToRelevantAdmins({
      title: "תור חדש נקבע",
      body: `${customerName} • ${barberName} • ${service} • ${time}`,
      barberId,
      data: {
        type: "appointment_created",
        appointmentId: String(appointment._id),
      },
    });

    if (customerPhone) {
      await sendWhatsAppToPhone(customerPhone, customerMessage);
    }
  } catch (err) {
    console.error("notifyAppointmentCreated error:", err.message);
  }
}

async function notifyAppointmentUpdated(appointment) {
  try {
    const { date, time } = formatAppointmentDateTime(
      appointment.startAt,
      appointment.endAt,
    );

    const customerPhone = normalizeIsraeliPhone(appointment.phone);
    const bookingCode = appointment.bookingCode || "-";
    const customerName = appointment.customerName || "לקוח";
    const service = appointment.service || "-";
    const barberName = await getAppointmentBarberName(appointment);
    const barberId = getAppointmentBarberId(appointment);

    const adminMessage = `תור עודכן ✏️
לקוח: ${customerName}
טלפון: ${appointment.phone || "-"}
ספר: ${barberName}
שירות: ${service}
תאריך: ${date}
שעה: ${time}
קוד הזמנה: ${bookingCode}
סטטוס: ${appointment.status || "-"}`;

    const customerMessage = `היי ${customerName},
התור שלך עודכן ✏️

ספר: ${barberName}
שירות: ${service}
תאריך: ${date}
שעה: ${time}
קוד הזמנה: ${bookingCode}`;

    await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, adminMessage);

    await sendPushToRelevantAdmins({
      title: "תור עודכן",
      body: `${customerName} • ${barberName} • ${service} • ${time}`,
      barberId,
      data: {
        type: "appointment_updated",
        appointmentId: String(appointment._id),
      },
    });

    if (customerPhone) {
      await sendWhatsAppToPhone(customerPhone, customerMessage);
    }
  } catch (err) {
    console.error("notifyAppointmentUpdated error:", err.message);
  }
}

async function notifyAppointmentCancelled(appointment) {
  try {
    const { date, time } = formatAppointmentDateTime(
      appointment.startAt,
      appointment.endAt,
    );

    const customerPhone = normalizeIsraeliPhone(appointment.phone);
    const bookingCode = appointment.bookingCode || "-";
    const customerName = appointment.customerName || "לקוח";
    const service = appointment.service || "-";
    const barberName = await getAppointmentBarberName(appointment);
    const barberId = getAppointmentBarberId(appointment);

    const adminMessage = `תור בוטל ❌
לקוח: ${customerName}
טלפון: ${appointment.phone || "-"}
ספר: ${barberName}
שירות: ${service}
תאריך: ${date}
שעה: ${time}
קוד הזמנה: ${bookingCode}`;

    const customerMessage = `היי ${customerName},
התור שלך בוטל ❌

ספר: ${barberName}
שירות: ${service}
תאריך: ${date}
שעה: ${time}
קוד הזמנה: ${bookingCode}`;

    await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, adminMessage);

    await sendPushToRelevantAdmins({
      title: "תור התבטל",
      body: `${customerName} • ${barberName} • ${service} • ${time}`,
      barberId,
      data: {
        type: "appointment_cancelled",
        appointmentId: String(appointment._id),
      },
    });

    if (customerPhone) {
      await sendWhatsAppToPhone(customerPhone, customerMessage);
    }
  } catch (err) {
    console.error("notifyAppointmentCancelled error:", err.message);
  }
}

async function notifyAppointmentDeleted(appointment) {
  try {
    const { date, time } = formatAppointmentDateTime(
      appointment.startAt,
      appointment.endAt,
    );

    const customerPhone = normalizeIsraeliPhone(appointment.phone);
    const bookingCode = appointment.bookingCode || "-";
    const customerName = appointment.customerName || "לקוח";
    const service = appointment.service || "-";
    const barberName = await getAppointmentBarberName(appointment);
    const barberId = getAppointmentBarberId(appointment);

    const adminMessage = `תור נמחק 🗑️
לקוח: ${customerName}
טלפון: ${appointment.phone || "-"}
ספר: ${barberName}
שירות: ${service}
תאריך: ${date}
שעה: ${time}
קוד הזמנה: ${bookingCode}`;

    const customerMessage = `היי ${customerName},
התור שלך נמחק ממערכת ההזמנות 🗑️

ספר: ${barberName}
שירות: ${service}
תאריך: ${date}
שעה: ${time}
קוד הזמנה: ${bookingCode}`;

    await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, adminMessage);

    await sendPushToRelevantAdmins({
      title: "תור נמחק",
      body: `${customerName} • ${barberName} • ${service} • ${time}`,
      barberId,
      data: {
        type: "appointment_deleted",
        appointmentId: String(appointment._id),
      },
    });

    if (customerPhone) {
      await sendWhatsAppToPhone(customerPhone, customerMessage);
    }
  } catch (err) {
    console.error("notifyAppointmentDeleted error:", err.message);
  }
}

// GET /api/appointments?date=YYYY-MM-DD&barberId=...&status=...
router.get("/", requireAuth, async (req, res) => {
  try {
    const q = {};
    const { barberId, date, status } = req.query;

    if (barberId) q.barberId = barberId;
    if (status) q.status = status;

    if (date) {
      const { dayStart, dayEnd } = buildDayRange(date);
      q.startAt = { $gte: dayStart, $lte: dayEnd };
    }

    if (!isAdmin(req)) {
      if (!req.user?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      q.createdByUserId = req.user._id;
    }

    const list = await Appointment.find(q)
      .sort({ startAt: 1 })
      .populate("barberId", "name")
      .lean();

    const appointments = list.map((a) => {
      const barberObj =
        a.barberId && typeof a.barberId === "object" ? a.barberId : null;

      return {
        _id: String(a._id),
        barberId: barberObj?._id ? String(barberObj._id) : "",
        barber: barberObj
          ? {
              _id: barberObj._id ? String(barberObj._id) : "",
              name: barberObj.name || "",
            }
          : null,
        date: a.startAt ? new Date(a.startAt).toISOString().slice(0, 10) : null,
        time: a.startAt
          ? new Date(a.startAt).toISOString().slice(11, 16)
          : null,
        startAt: a.startAt,
        endAt: a.endAt,
        status: a.status,
        notes: a.notes || "",
        customer: {
          name: a.customerName || "",
          phone: a.phone || "",
        },
        service: {
          name: a.service || "",
        },
        bookingCode: a.bookingCode || null,
        manageToken: a.manageToken || null,
      };
    });

    return res.json({ appointments });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/appointments
router.post("/", async (req, res) => {
  try {
    const {
      barberId,
      startAt,
      endAt,
      customerName,
      phone,
      service,
      notes,
      customerId,
      serviceId,
      date,
      time,
    } = req.body;

    let finalBarberId = barberId;
    let finalStartAt = startAt;
    let finalEndAt = endAt;
    let finalCustomerName = customerName ? String(customerName).trim() : "";
    let finalPhone = phone ? String(phone).trim() : "";
    let finalService = service ? String(service).trim() : "";

    if (!finalStartAt && !finalEndAt && date && time && finalBarberId) {
      const start = new Date(`${date}T${time}:00`);
      if (Number.isNaN(start.getTime())) {
        return res.status(400).json({ message: "Invalid date/time" });
      }

      const barber = await Barber.findById(finalBarberId).lean();
      if (!barber) {
        return res.status(404).json({ message: "Barber not found" });
      }

      const slotMinutes = Number(barber.slotMinutes || 30);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + slotMinutes);

      finalStartAt = start;
      finalEndAt = end;
    }

    if (!finalService && serviceId) {
      const Service = require("../models/Service");
      const serviceDoc = await Service.findById(serviceId).lean();
      if (serviceDoc) {
        finalService = serviceDoc.name || "";
      }
    }

    if (!finalCustomerName && customerId) {
      finalCustomerName = "לקוח";
    }

    if (!finalBarberId || !finalStartAt || !finalEndAt) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (!finalCustomerName) {
      return res.status(400).json({ message: "customerName is required" });
    }

    if (!finalPhone) {
      return res.status(400).json({ message: "phone is required" });
    }

    const s = new Date(finalStartAt);
    const e = new Date(finalEndAt);

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (!(s < e)) {
      return res.status(400).json({ message: "Invalid time range" });
    }

    const scheduleCheck = await validateBarberScheduleOrFail(
      finalBarberId,
      s,
      e,
    );

    if (!scheduleCheck.ok) {
      return res
        .status(scheduleCheck.status)
        .json({ message: scheduleCheck.message });
    }

    const overlap = await findOverlap({
      barberId: finalBarberId,
      startAt: s,
      endAt: e,
    });

    if (overlap) {
      return res.status(409).json({ message: "Time already booked" });
    }

    const existingActiveAppointmentQuery = {
      status: { $nin: ["done", "cancelled", "no_show"] },
      $or: [],
    };

    if (customerId) {
      existingActiveAppointmentQuery.$or.push({ createdByUserId: customerId });
    }

    if (finalPhone) {
      existingActiveAppointmentQuery.$or.push({ phone: finalPhone });
    }

    if (!existingActiveAppointmentQuery.$or.length) {
      return res.status(400).json({ message: "Missing customer identity" });
    }

    const existingActiveAppointment = await Appointment.findOne(
      existingActiveAppointmentQuery,
    ).lean();

    if (existingActiveAppointment) {
      return res.status(400).json({
        message:
          "כבר קיים תור פעיל. אי אפשר לקבוע תור נוסף לפני סיום או ביטול התור הקיים.",
      });
    }

    const appointment = await Appointment.create({
      barberId: finalBarberId,
      startAt: s,
      endAt: e,
      customerName: finalCustomerName,
      phone: finalPhone,
      service: finalService,
      notes: notes ? String(notes).trim() : "",
      status: "booked",
      manageToken: generateManageToken(),
      bookingCode: generateBookingCode(),
      clientCanEdit: true,
      clientEditCutoffMinutes: 180,
      createdByUserId: req.user?._id || customerId || null,
    });

    notifyAppointmentCreated(appointment).catch((err) =>
      console.error("notifyAppointmentCreated error:", err.message),
    );

    return res.status(201).json({
      appointmentId: appointment._id,
      bookingCode: appointment.bookingCode,
      manageToken: appointment.manageToken,
      message: "Appointment booked successfully",
    });
  } catch (e) {
    console.error("CREATE APPOINTMENT ERROR:", e);
    res.status(500).json({ message: e.message });
  }
});

// GET /api/appointments/public/:token
router.get("/public/:token", async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      manageToken: req.params.token,
    }).populate("barberId", "name");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    return res.json({
      _id: appointment._id,
      barberId: appointment.barberId,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      customerName: appointment.customerName,
      phone: appointment.phone,
      service: appointment.service,
      notes: appointment.notes,
      status: appointment.status,
      bookingCode: appointment.bookingCode,
      canManage: canClientManageAppointment(appointment),
      cutoffMinutes: appointment.clientEditCutoffMinutes,
    });
  } catch (err) {
    console.error("GET PUBLIC APPOINTMENT ERROR:", err);
    res.status(500).json({ message: "Failed to load appointment" });
  }
});

// DELETE /api/appointments/public/:token
router.delete("/public/:token", async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      manageToken: req.params.token,
    });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (!canClientManageAppointment(appointment)) {
      return res.status(403).json({
        message: "You can only cancel at least 2 hours before the appointment",
      });
    }

    appointment.status = "cancelled";
    appointment.cancelledAt = new Date();
    appointment.cancelledByUserId = null;

    await appointment.save();

    notifyAppointmentCancelled(appointment).catch((err) =>
      console.error("notifyAppointmentCancelled error:", err.message),
    );

    triggerWaitlistForAppointment(appointment);

    return res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    console.error("DELETE PUBLIC APPOINTMENT ERROR:", err);
    res.status(500).json({ message: "Failed to cancel appointment" });
  }
});

// PATCH /api/appointments/public/:token
router.patch("/public/:token", async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      manageToken: req.params.token,
    });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (!canClientManageAppointment(appointment)) {
      return res.status(403).json({
        message: "You can only change at least 2 hours before the appointment",
      });
    }

    const oldBarberId = appointment.barberId;
    const oldStartAt = appointment.startAt;

    const { barberId, startAt, endAt, service, notes, customerName, phone } =
      req.body;

    const nextBarberId = barberId ?? appointment.barberId;
    const nextStartAt = startAt
      ? new Date(startAt)
      : new Date(appointment.startAt);
    const nextEndAt = endAt ? new Date(endAt) : new Date(appointment.endAt);

    if (
      Number.isNaN(nextStartAt.getTime()) ||
      Number.isNaN(nextEndAt.getTime())
    ) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (!(nextStartAt < nextEndAt)) {
      return res.status(400).json({ message: "Invalid time range" });
    }

    const scheduleCheck = await validateBarberScheduleOrFail(
      nextBarberId,
      nextStartAt,
      nextEndAt,
    );
    if (!scheduleCheck.ok) {
      return res
        .status(scheduleCheck.status)
        .json({ message: scheduleCheck.message });
    }

    const overlap = await findOverlap({
      barberId: nextBarberId,
      startAt: nextStartAt,
      endAt: nextEndAt,
      excludeId: appointment._id,
    });

    if (overlap) {
      return res.status(409).json({ message: "Time already booked" });
    }

    appointment.barberId = nextBarberId;
    appointment.startAt = nextStartAt;
    appointment.endAt = nextEndAt;
    appointment.service = service ?? appointment.service;
    appointment.notes = notes ?? appointment.notes;
    appointment.customerName = customerName ?? appointment.customerName;
    appointment.phone = phone ?? appointment.phone;

    await appointment.save();

    notifyAppointmentUpdated(appointment).catch((err) =>
      console.error("notifyAppointmentUpdated error:", err.message),
    );

    processWaitlistForBarberDate(
      typeof oldBarberId === "object" ? oldBarberId._id : oldBarberId,
      new Date(oldStartAt).toISOString().slice(0, 10),
    ).catch((err) =>
      console.error("processWaitlistForBarberDate error:", err.message),
    );

    return res.json({
      message: "Appointment updated successfully",
      appointmentId: appointment._id,
      bookingCode: appointment.bookingCode,
      manageToken: appointment.manageToken,
      manageUrl: `${process.env.CLIENT_URL}/manage-appointment?token=${appointment.manageToken}`,
    });
  } catch (err) {
    console.error("PATCH PUBLIC APPOINTMENT ERROR:", err);
    res.status(500).json({ message: "Failed to update appointment" });
  }
});

// PATCH /api/appointments/:id
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Not found" });

    const admin = isAdmin(req);

    if (!admin) {
      if (String(appt.createdByUserId) !== String(req.user?._id)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const cutoffMin = appt.clientEditCutoffMinutes ?? 180;
      const cutoffTime = new Date(
        new Date(appt.startAt).getTime() - cutoffMin * 60000,
      );

      if (new Date() >= cutoffTime) {
        return res.status(403).json({ message: "Too late (2 hour cutoff)" });
      }
    }

    const oldBarberId = appt.barberId;
    const oldStartAt = appt.startAt;

    const allowed = [
      "barberId",
      "customerName",
      "phone",
      "service",
      "notes",
      "status",
      "startAt",
      "endAt",
      "clientCanEdit",
      "clientEditCutoffMinutes",
    ];

    for (const k of Object.keys(req.body)) {
      if (!allowed.includes(k)) continue;
      appt[k] = req.body[k];
    }

    appt.startAt = new Date(appt.startAt);
    appt.endAt = new Date(appt.endAt);

    if (
      Number.isNaN(appt.startAt.getTime()) ||
      Number.isNaN(appt.endAt.getTime())
    ) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (!(appt.startAt < appt.endAt)) {
      return res.status(400).json({ message: "Invalid time range" });
    }

    if (appt.status !== "cancelled") {
      const scheduleCheck = await validateBarberScheduleOrFail(
        appt.barberId,
        appt.startAt,
        appt.endAt,
      );
      if (!scheduleCheck.ok) {
        return res
          .status(scheduleCheck.status)
          .json({ message: scheduleCheck.message });
      }

      const overlap = await findOverlap({
        barberId: appt.barberId,
        startAt: appt.startAt,
        endAt: appt.endAt,
        excludeId: appt._id,
      });

      if (overlap) {
        return res.status(409).json({ message: "Time already booked" });
      }
    }

    await appt.save();

    notifyAppointmentUpdated(appt).catch((err) =>
      console.error("notifyAppointmentUpdated error:", err.message),
    );

    processWaitlistForBarberDate(
      typeof oldBarberId === "object" ? oldBarberId._id : oldBarberId,
      new Date(oldStartAt).toISOString().slice(0, 10),
    ).catch((err) =>
      console.error("processWaitlistForBarberDate error:", err.message),
    );

    res.json(appt);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/appointments/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Not found" });

    const admin = isAdmin(req);

    if (!admin) {
      if (String(appt.createdByUserId) !== String(req.user?._id)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const cutoffMin = appt.clientEditCutoffMinutes ?? 180;
      const cutoffTime = new Date(
        new Date(appt.startAt).getTime() - cutoffMin * 60000,
      );

      if (new Date() >= cutoffTime) {
        return res.status(403).json({ message: "Too late (2 hour cutoff)" });
      }
    }

    appt.status = "cancelled";
    appt.cancelledAt = new Date();
    appt.cancelledByUserId = req.user?._id || null;

    await appt.save();

    notifyAppointmentCancelled(appt).catch((err) =>
      console.error("notifyAppointmentCancelled error:", err.message),
    );

    triggerWaitlistForAppointment(appt);

    res.json({ cancelled: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/appointments/:id/hard
router.delete("/:id/hard", requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "Admin only" });
    }

    const existing = await Appointment.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Not found" });
    }

    await Appointment.findByIdAndDelete(req.params.id);

    notifyAppointmentDeleted(existing).catch((err) =>
      console.error("notifyAppointmentDeleted error:", err.message),
    );

    triggerWaitlistForAppointment(existing);

    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
