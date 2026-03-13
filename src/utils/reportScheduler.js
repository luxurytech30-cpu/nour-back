const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const ReportDispatchLog = require("../models/ReportDispatchLog");
const { sendWhatsAppToPhone } = require("./sendMessageWa");

const ADMIN_WHATSAPP_PHONE = process.env.ADMIN_WHATSAPP_PHONE || "0543596761";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(year, monthIndex) {
  return new Date(year, monthIndex, 1, 0, 0, 0, 0);
}

function endOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
}

function formatDateIL(date) {
  return new Date(date).toLocaleDateString("he-IL");
}

function formatTimeIL(date) {
  return new Date(date).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status) {
  switch (status) {
    case "booked":
      return "פעיל";
    case "done":
      return "הושלם";
    case "cancelled":
      return "בוטל";
    case "no_show":
      return "לא הגיע";
    default:
      return status || "-";
  }
}

async function alreadySent(type, key) {
  const existing = await ReportDispatchLog.findOne({ type, key }).lean();
  return !!existing;
}

async function markSent(type, key, meta = {}) {
  await ReportDispatchLog.create({
    type,
    key,
    meta,
  });
}

async function buildDailyReport(targetDate = new Date()) {
  const from = startOfDay(targetDate);
  const to = endOfDay(targetDate);

  const appointments = await Appointment.find({
    startAt: { $gte: from, $lte: to },
  })
    .sort({ startAt: 1 })
    .populate("barberId", "name")
    .lean();

  const total = appointments.length;
  const booked = appointments.filter((a) => a.status === "booked").length;
  const done = appointments.filter((a) => a.status === "done").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
  const noShow = appointments.filter((a) => a.status === "no_show").length;

  const barberMap = new Map();

  for (const appt of appointments) {
    const barberName =
      appt?.barberId && typeof appt.barberId === "object"
        ? appt.barberId.name || "ללא ספר"
        : "ללא ספר";

    barberMap.set(barberName, (barberMap.get(barberName) || 0) + 1);
  }

  const barberText =
    Array.from(barberMap.entries())
      .map(([name, count]) => `- ${name}: ${count}`)
      .join("\n") || "- אין נתונים";

  const detailsText =
    appointments.length > 0
      ? appointments
          .map((appt, i) => {
            const barberName =
              appt?.barberId && typeof appt.barberId === "object"
                ? appt.barberId.name || "-"
                : "-";

            return `${i + 1}. ${formatTimeIL(appt.startAt)} | ${appt.customerName || "-"} | ${barberName} | ${appt.service || "-"} | ${getStatusLabel(appt.status)}`;
          })
          .join("\n")
      : "אין תורים היום";

  return `דוח יומי 📅
תאריך: ${formatDateIL(targetDate)}

סיכום:
סה"כ תורים: ${total}
פעילים: ${booked}
הושלמו: ${done}
בוטלו: ${cancelled}
לא הגיעו: ${noShow}

חלוקה לפי ספר:
${barberText}

פירוט:
${detailsText}`;
}

async function buildMonthlyReport(year, monthIndex) {
  const from = startOfMonth(year, monthIndex);
  const to = endOfMonth(year, monthIndex);

  const appointments = await Appointment.find({
    startAt: { $gte: from, $lte: to },
  })
    .sort({ startAt: 1 })
    .populate("barberId", "name")
    .lean();

  const total = appointments.length;
  const booked = appointments.filter((a) => a.status === "booked").length;
  const done = appointments.filter((a) => a.status === "done").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
  const noShow = appointments.filter((a) => a.status === "no_show").length;

  const barberMap = new Map();

  for (const appt of appointments) {
    const barberName =
      appt?.barberId && typeof appt.barberId === "object"
        ? appt.barberId.name || "ללא ספר"
        : "ללא ספר";

    barberMap.set(barberName, (barberMap.get(barberName) || 0) + 1);
  }

  const barberText =
    Array.from(barberMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `- ${name}: ${count}`)
      .join("\n") || "- אין נתונים";

  const monthLabel = new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(from);

  return `דוח חודשי 📊
חודש: ${monthLabel}

סיכום:
סה"כ תורים: ${total}
פעילים: ${booked}
הושלמו: ${done}
בוטלו: ${cancelled}
לא הגיעו: ${noShow}

חלוקה לפי ספר:
${barberText}`;
}

async function sendDailyReport(targetDate = new Date()) {
  const key = targetDate.toISOString().slice(0, 10);

  if (await alreadySent("daily", key)) {
    console.log(`[REPORT] daily already sent: ${key}`);
    return;
  }

  const message = await buildDailyReport(targetDate);
  await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, message);
  await markSent("daily", key, { date: key });

  console.log(`[REPORT] daily sent: ${key}`);
}

async function sendMonthlyReport(year, monthIndex) {
  const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  if (await alreadySent("monthly", key)) {
    console.log(`[REPORT] monthly already sent: ${key}`);
    return;
  }

  const message = await buildMonthlyReport(year, monthIndex);
  await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, message);
  await markSent("monthly", key, { year, month: monthIndex + 1 });

  console.log(`[REPORT] monthly sent: ${key}`);
}

function isLastDayOfMonth(date = new Date()) {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getMonth() !== date.getMonth();
}

let dailyJob = null;
let monthlyJob = null;

function startReportScheduler() {
  console.log("✅ report scheduler started");

  dailyJob = cron.schedule(
    "0 21 * * *",
    async () => {
      try {
        await sendDailyReport(new Date());
      } catch (err) {
        console.error("Daily report error:", err.message);
      }
    },
    { timezone: "Asia/Jerusalem" },
  );

  monthlyJob = cron.schedule(
    "10 21 * * *",
    async () => {
      try {
        const now = new Date();
        if (!isLastDayOfMonth(now)) return;

        await sendMonthlyReport(now.getFullYear(), now.getMonth());
      } catch (err) {
        console.error("Monthly report error:", err.message);
      }
    },
    { timezone: "Asia/Jerusalem" },
  );
}

function stopReportScheduler() {
  if (dailyJob) {
    dailyJob.stop();
    dailyJob = null;
  }

  if (monthlyJob) {
    monthlyJob.stop();
    monthlyJob = null;
  }

  console.log("🛑 report scheduler stopped");
}

module.exports = {
  startReportScheduler,
  sendDailyReport,
  sendMonthlyReport,
  stopReportScheduler,
};
