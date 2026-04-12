const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const Barber = require("../models/Barber");
const { sendWhatsAppToPhone } = require("./sendMessageWa");

const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ["booked"];
const TIMEZONE = "Asia/Jerusalem";

let reminderJob = null;
let reminderRunInProgress = false;

function formatAppointmentDateTime(startAt) {
  const date = new Date(startAt);

  return {
    date: new Intl.DateTimeFormat("he-IL", {
      timeZone: TIMEZONE,
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("he-IL", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),
  };
}

async function buildCustomerReminderMessage(appointment) {
  const { date, time } = formatAppointmentDateTime(appointment.startAt);
  const customerName = appointment.customerName || "לקוח";
  const service = appointment.service || "-";
  const bookingCode = appointment.bookingCode || "-";

  let barberName = "-";
  if (appointment.barberId) {
    const barber = await Barber.findById(appointment.barberId)
      .select("name")
      .lean();
    barberName = barber?.name || "-";
  }

  return `היי ${customerName},
תזכורת: התור שלך בעוד שעתיים.

ספר: ${barberName}
שירות: ${service}
תאריך: ${date}
שעה: ${time}
קוד הזמנה: ${bookingCode}`;
}

async function sendDueCustomerReminders() {
  if (reminderRunInProgress) return;
  reminderRunInProgress = true;

  try {
    const now = new Date();
    const reminderUntil = new Date(now.getTime() + REMINDER_WINDOW_MS);

    const appointments = await Appointment.find({
      phone: { $ne: "" },
      status: { $in: ACTIVE_STATUSES },
      startAt: { $gt: now, $lte: reminderUntil },
    })
      .select(
        "_id barberId startAt customerName phone service bookingCode status customerReminderForStartAt",
      )
      .lean();

    for (const appointment of appointments) {
      const startTime = new Date(appointment.startAt).getTime();
      const reminderForStartTime = appointment.customerReminderForStartAt
        ? new Date(appointment.customerReminderForStartAt).getTime()
        : null;

      if (reminderForStartTime === startTime) continue;

      const liveAppointment = await Appointment.findOne({
        _id: appointment._id,
        status: { $in: ACTIVE_STATUSES },
        startAt: appointment.startAt,
      })
        .select("_id barberId startAt customerName phone service bookingCode status")
        .lean();

      if (!liveAppointment?.phone) continue;

      const message = await buildCustomerReminderMessage(liveAppointment);
      await sendWhatsAppToPhone(liveAppointment.phone, message);

      await Appointment.updateOne(
        {
          _id: liveAppointment._id,
          status: { $in: ACTIVE_STATUSES },
          startAt: liveAppointment.startAt,
        },
        {
          $set: {
            customerReminderSentAt: new Date(),
            customerReminderForStartAt: liveAppointment.startAt,
          },
        },
      );
    }
  } catch (error) {
    console.error("sendDueCustomerReminders error:", error);
  } finally {
    reminderRunInProgress = false;
  }
}

function startCustomerReminderScheduler() {
  if (reminderJob) {
    console.log("Customer reminder scheduler already running");
    return;
  }

  reminderJob = cron.schedule("* * * * *", () => {
    sendDueCustomerReminders();
  });

  console.log("Customer reminder scheduler started");
}

function stopCustomerReminderScheduler() {
  if (!reminderJob) return;
  reminderJob.stop();
  reminderJob = null;
  console.log("Customer reminder scheduler stopped");
}

module.exports = {
  sendDueCustomerReminders,
  startCustomerReminderScheduler,
  stopCustomerReminderScheduler,
};
