// const cron = require("node-cron");
// const Appointment = require("../models/Appointment");
// const ReportDispatchLog = require("../models/ReportDispatchLog");
// const { sendWhatsAppToPhone } = require("./sendMessageWa");
// const Service = require("../models/Service");
// const ADMIN_WHATSAPP_PHONE = process.env.ADMIN_WHATSAPP_PHONE || "0543596761";

// function startOfDay(date = new Date()) {
//   const d = new Date(date);
//   d.setHours(0, 0, 0, 0);
//   return d;
// }

// function endOfDay(date = new Date()) {
//   const d = new Date(date);
//   d.setHours(23, 59, 59, 999);
//   return d;
// }
// async function getServicePriceMap() {
//   const services = await Service.find({}).lean();

//   const map = new Map();

//   for (const service of services) {
//     const name = String(service?.name || "").trim();
//     const nameHe = String(service?.nameHe || "").trim();
//     const price = Number(service?.price || 0);

//     if (name) map.set(name.toLowerCase(), price);
//     if (nameHe) map.set(nameHe.toLowerCase(), price);
//   }

//   return map;
// }

// function getAppointmentServicePrice(appointment, servicePriceMap) {
//   const serviceName = String(appointment?.service || "")
//     .trim()
//     .toLowerCase();

//   if (!serviceName) return 0;

//   return Number(servicePriceMap.get(serviceName) || 0);
// }
// function startOfMonth(year, monthIndex) {
//   return new Date(year, monthIndex, 1, 0, 0, 0, 0);
// }

// function endOfMonth(year, monthIndex) {
//   return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
// }

// function formatDateIL(date) {
//   return new Date(date).toLocaleDateString("he-IL");
// }

// function formatTimeIL(date) {
//   return new Date(date).toLocaleTimeString("he-IL", {
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// function getStatusLabel(status) {
//   switch (status) {
//     case "booked":
//       return "פעיל";
//     case "done":
//       return "הושלם";
//     case "cancelled":
//       return "בוטל";
//     case "no_show":
//       return "לא הגיע";
//     default:
//       return status || "-";
//   }
// }

// async function alreadySent(type, key) {
//   const existing = await ReportDispatchLog.findOne({ type, key }).lean();
//   return !!existing;
// }

// async function markSent(type, key, meta = {}) {
//   await ReportDispatchLog.create({
//     type,
//     key,
//     meta,
//   });
// }

// async function buildDailyReport(targetDate = new Date()) {
//   const from = startOfDay(targetDate);
//   const to = endOfDay(targetDate);

//   const [appointments, servicePriceMap] = await Promise.all([
//     Appointment.find({
//       startAt: { $gte: from, $lte: to },
//     })
//       .sort({ startAt: 1 })
//       .populate("barberId", "name")
//       .lean(),
//     getServicePriceMap(),
//   ]);

//   const total = appointments.length;
//   const booked = appointments.filter((a) => a.status === "booked").length;
//   const done = appointments.filter((a) => a.status === "done").length;
//   const cancelled = appointments.filter((a) => a.status === "cancelled").length;
//   const noShow = appointments.filter((a) => a.status === "no_show").length;

//   const bookedRevenue = appointments
//     .filter((a) => a.status === "booked")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const doneRevenue = appointments
//     .filter((a) => a.status === "done")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const expectedRevenue = appointments
//     .filter((a) => a.status === "booked" || a.status === "done")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const cancelledRevenue = appointments
//     .filter((a) => a.status === "cancelled")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const noShowRevenue = appointments
//     .filter((a) => a.status === "no_show")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const barberMap = new Map();
//   const barberRevenueMap = new Map();

//   for (const appt of appointments) {
//     const barberName =
//       appt?.barberId && typeof appt.barberId === "object"
//         ? appt.barberId.name || "ללא ספר"
//         : "ללא ספר";

//     const price = getAppointmentServicePrice(appt, servicePriceMap);

//     barberMap.set(barberName, (barberMap.get(barberName) || 0) + 1);

//     if (appt.status === "booked" || appt.status === "done") {
//       barberRevenueMap.set(
//         barberName,
//         (barberRevenueMap.get(barberName) || 0) + price,
//       );
//     }
//   }

//   const barberText =
//     Array.from(barberMap.entries())
//       .map(([name, count]) => `- ${name}: ${count}`)
//       .join("\n") || "- אין נתונים";

//   const barberRevenueText =
//     Array.from(barberRevenueMap.entries())
//       .sort((a, b) => b[1] - a[1])
//       .map(([name, total]) => `- ${name}: ₪${total}`)
//       .join("\n") || "- אין נתונים";

//   const detailsText =
//     appointments.length > 0
//       ? appointments
//           .map((appt, i) => {
//             const barberName =
//               appt?.barberId && typeof appt.barberId === "object"
//                 ? appt.barberId.name || "-"
//                 : "-";

//             const price = getAppointmentServicePrice(appt, servicePriceMap);

//             return `${i + 1}) שעה: ${formatTimeIL(appt.startAt)}
//    לקוח: ${appt.customerName || "-"}
//    ספר: ${barberName}
//    שירות: ${appt.service || "-"}
//    מחיר: ₪${price}
//    סטטוס: ${getStatusLabel(appt.status)}`;
//           })
//           .join("\n\n")
//       : "אין תורים היום";

//   return `דוח יומי 📅
// תאריך: ${formatDateIL(targetDate)}

// סיכום תורים:
// סה"כ תורים: ${total}
// הושלמו: ${done}
// בוטלו: ${cancelled}

// סיכום כספי:
// סה"כ צפוי: ₪${expectedRevenue}

// חלוקה לפי ספר:
// ${barberText}

// הכנסה לפי ספר:
// ${barberRevenueText}

// פירוט יומי:
// ${detailsText}`;
// }
// async function buildMonthlyReport(year, monthIndex) {
//   const from = startOfMonth(year, monthIndex);
//   const to = endOfMonth(year, monthIndex);

//   const [appointments, servicePriceMap] = await Promise.all([
//     Appointment.find({
//       startAt: { $gte: from, $lte: to },
//     })
//       .sort({ startAt: 1 })
//       .populate("barberId", "name")
//       .lean(),
//     getServicePriceMap(),
//   ]);

//   const total = appointments.length;
//   const booked = appointments.filter((a) => a.status === "booked").length;
//   const done = appointments.filter((a) => a.status === "done").length;
//   const cancelled = appointments.filter((a) => a.status === "cancelled").length;
//   const noShow = appointments.filter((a) => a.status === "no_show").length;

//   const bookedRevenue = appointments
//     .filter((a) => a.status === "booked")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const doneRevenue = appointments
//     .filter((a) => a.status === "done")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const expectedRevenue = appointments
//     .filter((a) => a.status === "booked" || a.status === "done")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const cancelledRevenue = appointments
//     .filter((a) => a.status === "cancelled")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const noShowRevenue = appointments
//     .filter((a) => a.status === "no_show")
//     .reduce(
//       (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
//       0,
//     );

//   const barberMap = new Map();
//   const barberRevenueMap = new Map();

//   for (const appt of appointments) {
//     const barberName =
//       appt?.barberId && typeof appt.barberId === "object"
//         ? appt.barberId.name || "ללא ספר"
//         : "ללא ספר";

//     const price = getAppointmentServicePrice(appt, servicePriceMap);

//     barberMap.set(barberName, (barberMap.get(barberName) || 0) + 1);

//     if (appt.status === "booked" || appt.status === "done") {
//       barberRevenueMap.set(
//         barberName,
//         (barberRevenueMap.get(barberName) || 0) + price,
//       );
//     }
//   }

//   const barberText =
//     Array.from(barberMap.entries())
//       .sort((a, b) => b[1] - a[1])
//       .map(([name, count]) => `- ${name}: ${count}`)
//       .join("\n") || "- אין נתונים";

//   const barberRevenueText =
//     Array.from(barberRevenueMap.entries())
//       .sort((a, b) => b[1] - a[1])
//       .map(([name, total]) => `- ${name}: ₪${total}`)
//       .join("\n") || "- אין נתונים";

//   const monthLabel = new Intl.DateTimeFormat("he-IL", {
//     month: "long",
//     year: "numeric",
//   }).format(from);

//   return `דוח חודשי 📊
// חודש: ${monthLabel}

// סיכום תורים:
// סה"כ תורים: ${total}
// הושלמו: ${done}
// בוטלו: ${cancelled}

// סיכום כספי:
// סה"כ צפוי: ₪${expectedRevenue}
// סה"כ הושלם: ₪${doneRevenue}
// סה"כ בוטל: ₪${cancelledRevenue}

// חלוקה לפי ספר:
// ${barberText}

// הכנסה לפי ספר:
// ${barberRevenueText}`;
// }
// async function sendDailyReport(targetDate = new Date()) {
//   const key = targetDate.toISOString().slice(0, 10);

//   if (await alreadySent("daily", key)) {
//     console.log(`[REPORT] daily already sent: ${key}`);
//     return;
//   }

//   const message = await buildDailyReport(targetDate);
//   await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, message);
//   await markSent("daily", key, { date: key });

//   console.log(`[REPORT] daily sent: ${key}`);
// }

// async function sendMonthlyReport(year, monthIndex) {
//   const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

//   if (await alreadySent("monthly", key)) {
//     console.log(`[REPORT] monthly already sent: ${key}`);
//     return;
//   }

//   const message = await buildMonthlyReport(year, monthIndex);
//   await sendWhatsAppToPhone(ADMIN_WHATSAPP_PHONE, message);
//   await markSent("monthly", key, { year, month: monthIndex + 1 });

//   console.log(`[REPORT] monthly sent: ${key}`);
// }

// function isLastDayOfMonth(date = new Date()) {
//   const tomorrow = new Date(date);
//   tomorrow.setDate(tomorrow.getDate() + 1);
//   return tomorrow.getMonth() !== date.getMonth();
// }

// let dailyJob = null;
// let monthlyJob = null;
// function getReportSchedulerStatus() {
//   return {
//     dailyRunning: !!dailyJob,
//     monthlyRunning: !!monthlyJob,
//   };
// }
// function startReportScheduler() {
//   if (dailyJob || monthlyJob) {
//     console.log("ℹ️ report scheduler already running");
//     return;
//   }

//   console.log("✅ report scheduler started");

//   dailyJob = cron.schedule(
//     "0 21 * * *",
//     async () => {
//       try {
//         await sendDailyReport(new Date());
//       } catch (err) {
//         console.error("Daily report error:", err.message);
//       }
//     },
//     { timezone: "Asia/Jerusalem" },
//   );

//   monthlyJob = cron.schedule(
//     "10 21 * * *",
//     async () => {
//       try {
//         const now = new Date();
//         if (!isLastDayOfMonth(now)) return;

//         await sendMonthlyReport(now.getFullYear(), now.getMonth());
//       } catch (err) {
//         console.error("Monthly report error:", err.message);
//       }
//     },
//     { timezone: "Asia/Jerusalem" },
//   );
// }

// function stopReportScheduler() {
//   if (dailyJob) {
//     dailyJob.stop();
//     dailyJob = null;
//   }

//   if (monthlyJob) {
//     monthlyJob.stop();
//     monthlyJob = null;
//   }

//   console.log("🛑 report scheduler stopped");
// }

// module.exports = {
//   startReportScheduler,
//   sendDailyReport,
//   sendMonthlyReport,
//   stopReportScheduler,
//   getReportSchedulerStatus,
// };
const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const ReportDispatchLog = require("../models/ReportDispatchLog");
const { sendWhatsAppToPhone } = require("./sendMessageWa");
const Service = require("../models/Service");

const ADMIN_WHATSAPP_PHONE = process.env.ADMIN_WHATSAPP_PHONE || "0543596761";
const REPORT_TIMEZONE = "Asia/Jerusalem";
const DAILY_HOUR = 21;
const DAILY_MINUTE = 0;
const MONTHLY_HOUR = 21;
const MONTHLY_MINUTE = 10;

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

async function getServicePriceMap() {
  const services = await Service.find({}).lean();

  const map = new Map();

  for (const service of services) {
    const name = String(service?.name || "").trim();
    const nameHe = String(service?.nameHe || "").trim();
    const price = Number(service?.price || 0);

    if (name) map.set(name.toLowerCase(), price);
    if (nameHe) map.set(nameHe.toLowerCase(), price);
  }

  return map;
}

function getAppointmentServicePrice(appointment, servicePriceMap) {
  const serviceName = String(appointment?.service || "")
    .trim()
    .toLowerCase();

  if (!serviceName) return 0;

  return Number(servicePriceMap.get(serviceName) || 0);
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

  const [appointments, servicePriceMap] = await Promise.all([
    Appointment.find({
      startAt: { $gte: from, $lte: to },
    })
      .sort({ startAt: 1 })
      .populate("barberId", "name")
      .lean(),
    getServicePriceMap(),
  ]);

  const total = appointments.length;
  const booked = appointments.filter((a) => a.status === "booked").length;
  const done = appointments.filter((a) => a.status === "done").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
  const noShow = appointments.filter((a) => a.status === "no_show").length;

  const bookedRevenue = appointments
    .filter((a) => a.status === "booked")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const doneRevenue = appointments
    .filter((a) => a.status === "done")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const expectedRevenue = appointments
    .filter((a) => a.status === "booked" || a.status === "done")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const cancelledRevenue = appointments
    .filter((a) => a.status === "cancelled")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const noShowRevenue = appointments
    .filter((a) => a.status === "no_show")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const barberMap = new Map();
  const barberRevenueMap = new Map();

  for (const appt of appointments) {
    const barberName =
      appt?.barberId && typeof appt.barberId === "object"
        ? appt.barberId.name || "ללא ספר"
        : "ללא ספר";

    const price = getAppointmentServicePrice(appt, servicePriceMap);

    barberMap.set(barberName, (barberMap.get(barberName) || 0) + 1);

    if (appt.status === "booked" || appt.status === "done") {
      barberRevenueMap.set(
        barberName,
        (barberRevenueMap.get(barberName) || 0) + price,
      );
    }
  }

  const barberText =
    Array.from(barberMap.entries())
      .map(([name, count]) => `- ${name}: ${count}`)
      .join("\n") || "- אין נתונים";

  const barberRevenueText =
    Array.from(barberRevenueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => `- ${name}: ₪${total}`)
      .join("\n") || "- אין נתונים";

  const detailsText =
    appointments.length > 0
      ? appointments
          .map((appt, i) => {
            const barberName =
              appt?.barberId && typeof appt.barberId === "object"
                ? appt.barberId.name || "-"
                : "-";

            const price = getAppointmentServicePrice(appt, servicePriceMap);

            return `${i + 1}) שעה: ${formatTimeIL(appt.startAt)}
   לקוח: ${appt.customerName || "-"}
   ספר: ${barberName}
   שירות: ${appt.service || "-"}
   מחיר: ₪${price}
   סטטוס: ${getStatusLabel(appt.status)}`;
          })
          .join("\n\n")
      : "אין תורים היום";

  return `דוח יומי 📅
תאריך: ${formatDateIL(targetDate)}

סיכום תורים:
סה"כ תורים: ${total}
הושלמו: ${done}
בוטלו: ${cancelled}

סיכום כספי:
סה"כ צפוי: ₪${expectedRevenue}

חלוקה לפי ספר:
${barberText}

הכנסה לפי ספר:
${barberRevenueText}

פירוט יומי:
${detailsText}`;
}

async function buildMonthlyReport(year, monthIndex) {
  const from = startOfMonth(year, monthIndex);
  const to = endOfMonth(year, monthIndex);

  const [appointments, servicePriceMap] = await Promise.all([
    Appointment.find({
      startAt: { $gte: from, $lte: to },
    })
      .sort({ startAt: 1 })
      .populate("barberId", "name")
      .lean(),
    getServicePriceMap(),
  ]);

  const total = appointments.length;
  const booked = appointments.filter((a) => a.status === "booked").length;
  const done = appointments.filter((a) => a.status === "done").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
  const noShow = appointments.filter((a) => a.status === "no_show").length;

  const bookedRevenue = appointments
    .filter((a) => a.status === "booked")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const doneRevenue = appointments
    .filter((a) => a.status === "done")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const expectedRevenue = appointments
    .filter((a) => a.status === "booked" || a.status === "done")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const cancelledRevenue = appointments
    .filter((a) => a.status === "cancelled")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const noShowRevenue = appointments
    .filter((a) => a.status === "no_show")
    .reduce(
      (sum, a) => sum + getAppointmentServicePrice(a, servicePriceMap),
      0,
    );

  const barberMap = new Map();
  const barberRevenueMap = new Map();

  for (const appt of appointments) {
    const barberName =
      appt?.barberId && typeof appt.barberId === "object"
        ? appt.barberId.name || "ללא ספר"
        : "ללא ספר";

    const price = getAppointmentServicePrice(appt, servicePriceMap);

    barberMap.set(barberName, (barberMap.get(barberName) || 0) + 1);

    if (appt.status === "booked" || appt.status === "done") {
      barberRevenueMap.set(
        barberName,
        (barberRevenueMap.get(barberName) || 0) + price,
      );
    }
  }

  const barberText =
    Array.from(barberMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `- ${name}: ${count}`)
      .join("\n") || "- אין נתונים";

  const barberRevenueText =
    Array.from(barberRevenueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => `- ${name}: ₪${total}`)
      .join("\n") || "- אין נתונים";

  const monthLabel = new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(from);

  return `דוח חודשי 📊
חודש: ${monthLabel}

סיכום תורים:
סה"כ תורים: ${total}
הושלמו: ${done}
בוטלו: ${cancelled}

סיכום כספי:
סה"כ צפוי: ₪${expectedRevenue}
סה"כ הושלם: ₪${doneRevenue}
סה"כ בוטל: ₪${cancelledRevenue}

חלוקה לפי ספר:
${barberText}

הכנסה לפי ספר:
${barberRevenueText}`;
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

function getJerusalemNowParts() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value || "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function hasReachedDailySendTime() {
  const now = getJerusalemNowParts();
  if (now.hour > DAILY_HOUR) return true;
  if (now.hour === DAILY_HOUR && now.minute >= DAILY_MINUTE) return true;
  return false;
}

function hasReachedMonthlySendTime() {
  const now = getJerusalemNowParts();
  if (now.hour > MONTHLY_HOUR) return true;
  if (now.hour === MONTHLY_HOUR && now.minute >= MONTHLY_MINUTE) return true;
  return false;
}

function getTodayKeyInJerusalem() {
  const now = getJerusalemNowParts();
  return `${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`;
}

function getCurrentMonthKeyInJerusalem() {
  const now = getJerusalemNowParts();
  return {
    year: now.year,
    monthIndex: now.month - 1,
    key: `${now.year}-${String(now.month).padStart(2, "0")}`,
  };
}

async function runMissedReportsCatchup() {
  try {
    const todayKey = getTodayKeyInJerusalem();

    if (hasReachedDailySendTime() && !(await alreadySent("daily", todayKey))) {
      console.log(`[REPORT] catch-up daily send for ${todayKey}`);
      await sendDailyReport(new Date(`${todayKey}T12:00:00`));
    }

    const monthInfo = getCurrentMonthKeyInJerusalem();
    const now = getJerusalemNowParts();

    const todayForMonthCheck = new Date(
      monthInfo.year,
      monthInfo.monthIndex,
      now.day,
      12,
      0,
      0,
      0,
    );

    if (
      isLastDayOfMonth(todayForMonthCheck) &&
      hasReachedMonthlySendTime() &&
      !(await alreadySent("monthly", monthInfo.key))
    ) {
      console.log(`[REPORT] catch-up monthly send for ${monthInfo.key}`);
      await sendMonthlyReport(monthInfo.year, monthInfo.monthIndex);
    }
  } catch (err) {
    console.error("runMissedReportsCatchup error:", err.message);
  }
}

let dailyJob = null;
let monthlyJob = null;

function getReportSchedulerStatus() {
  return {
    dailyRunning: !!dailyJob,
    monthlyRunning: !!monthlyJob,
  };
}

async function startReportScheduler() {
  if (dailyJob || monthlyJob) {
    console.log("ℹ️ report scheduler already running");
    return;
  }

  await runMissedReportsCatchup();

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
    { timezone: REPORT_TIMEZONE },
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
    { timezone: REPORT_TIMEZONE },
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
  getReportSchedulerStatus,
};
