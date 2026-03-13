const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const {
  stopReportScheduler,
  startReportScheduler,
  sendDailyReport,
  sendMonthlyReport,
  getReportSchedulerStatus,
} = require("../utils/reportScheduler");

router.get("/status", (req, res) => {
  console.log("X");
  res.json({
    ok: true,
    scheduler: getReportSchedulerStatus(),
  });
});

router.get("/stop", (req, res) => {
  stopReportScheduler();
  res.json({ ok: true, message: "Report scheduler stopped" });
});

router.get("/start", (req, res) => {
  startReportScheduler();
  res.json({ ok: true, message: "Report scheduler started" });
});

router.post("/daily", async (req, res) => {
  try {
    await sendDailyReport(new Date());
    res.json({ ok: true, message: "Daily report sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/monthly", async (req, res) => {
  try {
    const now = new Date();
    await sendMonthlyReport(now.getFullYear(), now.getMonth());
    res.json({ ok: true, message: "Monthly report sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
