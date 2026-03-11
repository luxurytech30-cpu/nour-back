// src/routes/appointments.js
const router = require("express").Router();
const crypto = require("crypto");
const Appointment = require("../models/Appointment");
const Barber = require("../models/Barber");
const { requireAuth } = require("../middleware/auth");
const { validateAppointmentAgainstSchedule } = require("../utils/schedule");

console.log("✅ appointments routes file loaded");

// helper: admin from session
const isAdmin = (req) => req.session?.user?.role === "admin";

function generateManageToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generateBookingCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function canClientManageAppointment(appointment) {
  if (!appointment) return false;
  if (!appointment.clientCanEdit) return false;
  if (appointment.status === "cancelled") return false;
  if (appointment.status === "done") return false;
  if (appointment.status === "no_show") return false;

  const cutoffMinutes = Number(appointment.clientEditCutoffMinutes || 120);
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

// GET /api/appointments?date=YYYY-MM-DD&barberId=...&status=...
// admin sees all
// logged-in non-admin sees only own appointments
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
      if (!req.session?.user?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      q.createdByUserId = req.session.user._id;
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
// public booking allowed
// admin can also create manually
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
    let finalCustomerName = customerName;
    let finalPhone = phone || "";
    let finalService = service || "";

    // support new booking payload: barberId + date + time + customerId + serviceId
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

    if (!finalCustomerName && customerId) {
      finalCustomerName = "לקוח";
    }

    if (!finalService && serviceId) {
      const Service = require("../models/Service");
      const serviceDoc = await Service.findById(serviceId).lean();
      if (serviceDoc) {
        finalService = serviceDoc.name || "";
      }
    }

    if (!finalBarberId || !finalStartAt || !finalEndAt || !finalCustomerName) {
      return res.status(400).json({ message: "Missing fields" });
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

    const appointment = await Appointment.create({
      barberId: finalBarberId,
      startAt: s,
      endAt: e,
      customerName: String(finalCustomerName).trim(),
      phone: finalPhone ? String(finalPhone).trim() : "",
      service: finalService ? String(finalService).trim() : "",
      notes: notes ? String(notes).trim() : "",
      status: "booked",
      manageToken: generateManageToken(),
      bookingCode: generateBookingCode(),
      clientCanEdit: true,
      clientEditCutoffMinutes: 120,
      createdByUserId: req.session?.user?._id || customerId || null,
    });

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
// public view by manage token
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
// public cancel by manage token
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

    return res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    console.error("DELETE PUBLIC APPOINTMENT ERROR:", err);
    res.status(500).json({ message: "Failed to cancel appointment" });
  }
});

// PATCH /api/appointments/public/:token
// public edit by manage token
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
// admin always
// logged-in non-admin only own appointment and before cutoff
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Not found" });

    const admin = isAdmin(req);

    if (!admin) {
      if (String(appt.createdByUserId) !== String(req.session?.user?._id)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const cutoffMin = appt.clientEditCutoffMinutes ?? 120;
      const cutoffTime = new Date(
        new Date(appt.startAt).getTime() - cutoffMin * 60000,
      );

      if (new Date() >= cutoffTime) {
        return res.status(403).json({ message: "Too late (2 hour cutoff)" });
      }
    }

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
    res.json(appt);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/appointments/:id
// admin always
// logged-in non-admin only own appointment and before cutoff
// soft delete = cancel
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Not found" });

    const admin = isAdmin(req);

    if (!admin) {
      if (String(appt.createdByUserId) !== String(req.session?.user?._id)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const cutoffMin = appt.clientEditCutoffMinutes ?? 120;
      const cutoffTime = new Date(
        new Date(appt.startAt).getTime() - cutoffMin * 60000,
      );

      if (new Date() >= cutoffTime) {
        return res.status(403).json({ message: "Too late (2 hour cutoff)" });
      }
    }

    appt.status = "cancelled";
    appt.cancelledAt = new Date();
    appt.cancelledByUserId = req.session?.user?._id || null;

    await appt.save();

    res.json({ cancelled: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/appointments/:id/hard
// admin only hard delete
router.delete("/:id/hard", requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "Admin only" });
    }

    const deleted = await Appointment.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
