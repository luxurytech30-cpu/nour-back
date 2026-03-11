const router = require("express").Router();
const mongoose = require("mongoose");

const Waitlist = require("../models/Waitlist");
const Appointment = require("../models/Appointment");
const Barber = require("../models/Barber");
const Service = require("../models/Service");

const ok = (data) => ({ success: true, data });
const fail = (message) => ({ success: false, message });

function isDate(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isTime(t) {
  return t == null || (typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
}

function isObjectId(v) {
  return mongoose.Types.ObjectId.isValid(v);
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

// POST /api/waitlist
// join waitlist
router.post("/", async (req, res) => {
  try {
    const {
      barberId,
      serviceId,
      customerId,
      date,
      preferredTime = null,
      phone = "",
      notes = "",
    } = req.body;

    if (!barberId || !serviceId || !customerId || !date) {
      return res.status(400).json(fail("Missing required fields"));
    }

    if (!isObjectId(barberId)) {
      return res.status(400).json(fail("Invalid barberId"));
    }

    if (!isObjectId(serviceId)) {
      return res.status(400).json(fail("Invalid serviceId"));
    }

    if (!isObjectId(customerId)) {
      return res.status(400).json(fail("Invalid customerId"));
    }

    if (!isDate(date)) {
      return res.status(400).json(fail("date must be YYYY-MM-DD"));
    }

    if (!isTime(preferredTime)) {
      return res.status(400).json(fail("preferredTime must be HH:mm"));
    }

    const [barber, service] = await Promise.all([
      Barber.findById(barberId).select("_id name isActive").lean(),
      Service.findById(serviceId).select("_id name active").lean(),
    ]);

    if (!barber) {
      return res.status(404).json(fail("Barber not found"));
    }

    if (!service) {
      return res.status(404).json(fail("Service not found"));
    }

    const existing = await Waitlist.findOne({
      barberId,
      date,
      customerId,
      status: { $in: ["waiting", "notified"] },
    });

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
      customerId,
      date,
      preferredTime,
      phone: String(phone || "").trim(),
      notes: String(notes || "").trim(),
      position: activeCount + 1,
      status: "waiting",
    });

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
// leave waitlist
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
// accept waitlist offer
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
      return res.status(400).json(fail("Offer expired"));
    }

    const appointmentTime = item.offeredTime || item.preferredTime || time;

    if (!appointmentTime) {
      return res
        .status(400)
        .json(fail("No appointment time available for this waitlist offer"));
    }

    const alreadyBooked = await Appointment.findOne({
      barberId: item.barberId,
      date: item.date,
      time: appointmentTime,
      status: { $nin: ["cancelled"] },
    }).lean();

    if (alreadyBooked) {
      return res.status(400).json(fail("This time is no longer available"));
    }

    const appointment = await Appointment.create({
      customerId: item.customerId,
      barberId: item.barberId,
      serviceId: item.serviceId,
      date: item.date,
      time: appointmentTime,
      status: "confirmed",
      source: "waitlist",
    });

    item.status = "accepted";
    item.position = 0;
    await item.save();

    await reindexWaitlist(item.barberId, item.date);

    return res.json(ok({ appointment, waitlist: item }));
  } catch (e) {
    console.error("POST /api/waitlist/:id/accept error:", e);
    return res.status(500).json(fail(e.message));
  }
});

// POST /api/waitlist/:id/expire
// manually expire current offer
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
