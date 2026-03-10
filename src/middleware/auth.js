function requireAuth(req, res, next) {
  if (!req.session?.user)
    return res.status(401).json({ message: "Not logged in" });
  next();
}
const User = require("../models/User");

function requireAdmin(req, res, next) {
  console.log("COOKIE:", req.headers.cookie);
  console.log("SESSION ID:", req.sessionID);
  console.log("SESSION USER:", req.session?.user);

  if (!req.session?.user)
    return res.status(401).json({ message: "Not logged in" });
  if (req.session.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });
  next();
}

module.exports = { requireAdmin, requireAuth };
