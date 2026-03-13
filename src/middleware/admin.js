function requireAdmin(req, res, next) {
  console.log("XXXXXXXXXXXXXXXXXX", req.user);
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
}

module.exports = { requireAdmin };
