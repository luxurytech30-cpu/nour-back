const router = require("express").Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");
console.log("AA");
// register (minimal)
router.post("/register", async (req, res) => {
  const { username, password, phone, role } = req.body;
  console.log("register: \n", req.body);

  if (!username || !password || !phone)
    return res.status(400).json({ message: "Missing fields" });
  const exists = await User.findOne({ username });
  if (exists) return res.status(409).json({ message: "Username taken" });

  const user = await User.create({
    username,
    password,
    phone,
    role: role === "admin" ? "admin" : "user", // keep it simple
  });

  res.json({ id: user._id, username: user.username, role: user.role });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const u = await User.findOne({ username });
  if (!u) return res.status(401).json({ message: "Invalid credentials" });

  // replace with bcrypt compare if you use bcrypt
  if (u.password !== password)
    return res.status(401).json({ message: "Invalid credentials" });

  req.session.user = {
    _id: u._id.toString(),
    username: u.username,
    role: u.role,
  };

  req.session.save(() => {
    res.json({ user: req.session.user });
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.json({ ok: true });
  });
});
router.get("/debug", (req, res) => {
  res.json({
    sid_cookie: req.headers.cookie || null,
    sessionID: req.sessionID || null,
    sessionUser: req.session?.user || null,
  });
});
router.get("/me", (req, res) => {
  res.json({ user: req.session?.user || null });
});
module.exports = router;
