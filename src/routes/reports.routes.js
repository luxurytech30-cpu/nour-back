const router = require("express").Router();
const {
  stopReportScheduler,
  startReportScheduler,
} = require("../utils/reportScheduler");

router.get("/stop", (req, res) => {
  stopReportScheduler();
  res.json({ ok: true, message: "Report scheduler stopped" });
});

router.get("/start", (req, res) => {
  startReportScheduler();
  res.json({ ok: true, message: "Report scheduler started" });
});

module.exports = router;
