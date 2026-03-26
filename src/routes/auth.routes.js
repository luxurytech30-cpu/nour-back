const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
function signToken(user) {
  return jwt.sign(
    {
      _id: String(user._id),
      username: user.username,
      role: user.role || "user",
      name: user.name || "",
      phone: user.phone || "",
      barberId: user.barberId ? String(user.barberId) : null,
      isMainAdmin: !!user.isMainAdmin,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "שם משתמש או סיסמה שגויים" });
    }

    // if you use bcrypt, compare here
    if (user.password !== password) {
      return res.status(401).json({ message: "שם משתמש או סיסמה שגויים" });
    }

    const token = signToken(user);

    return res.json({
      message: "התחברת בהצלחה",
      token,
      user: {
        _id: String(user._id),
        name: user.name || "",
        username: user.username || "",
        phone: user.phone || "",
        role: user.role || "user",
        barberId: user.barberId ? String(user.barberId) : null,
        isMainAdmin: !!user.isMainAdmin,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ message: "Login failed" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, username, password, phone } = req.body;

    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ message: "שם המשתמש כבר קיים" });
    }

    const user = await User.create({
      name: String(name || "").trim(),
      username: String(username || "").trim(),
      password: String(password || "").trim(),
      phone: String(phone || "").trim(),
      role: "user",
    });

    const token = signToken(user);

    return res.status(201).json({
      message: "החשבון נוצר בהצלחה",
      token,
      user: {
        _id: String(user._id),
        name: user.name || "",
        username: user.username || "",
        phone: user.phone || "",
        role: user.role || "user",
        barberId: user.barberId ? String(user.barberId) : null,
        isMainAdmin: !!user.isMainAdmin,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({ message: "Register failed" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.json({ user: null });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    return res.json({
      user: {
        _id: decoded._id,
        name: decoded.name || "",
        username: decoded.username || "",
        phone: decoded.phone || "",
        role: decoded.role || "user",
        barberId: decoded.barberId || null,
        isMainAdmin: !!decoded.isMainAdmin,
      },
    });
  } catch (error) {
    return res.json({ user: null });
  }
});

router.post("/logout", async (req, res) => {
  return res.json({ success: true });
});

module.exports = router;
