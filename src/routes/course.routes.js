const router = require("express").Router();
const Course = require("../models/Course");
const { requireAdmin } = require("../middleware/auth");

// list
router.get("/", async (req, res) => {
  const courses = await Course.find({ isActive: true }).populate("barber");
  res.json(courses);
});

// create (admin)
router.post("/", requireAdmin, async (req, res) => {
  const { title, type, dates, barberId, isActive } = req.body;
  if (!title || !type) return res.status(400).json({ message: "title + type required" });
  if (!["online", "zoom"].includes(type)) return res.status(400).json({ message: "type must be online/zoom" });

  const course = await Course.create({
    title,
    type,
    dates: Array.isArray(dates) ? dates : (dates ? JSON.parse(dates) : []),
    barber: barberId || undefined,
    isActive: isActive === "false" ? false : true,
  });

  res.json(course);
});

module.exports = router;