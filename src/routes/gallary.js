const express = require("express");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const GalleryImage = require("../models/GalleryImage");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

const isAdmin = (req) => req.user?.role === "admin";
// simple admin check, adjust to your auth
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// GET active gallery for public site
router.get("/", async (req, res) => {
  try {
    const items = await GalleryImage.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    res.json(items);
  } catch (err) {
    console.error("GET /gallery error:", err);
    res.status(500).json({ message: "Failed to load gallery" });
  }
});

// GET all gallery items for admin
router.get("/admin", async (req, res) => {
  try {
    const items = await GalleryImage.find({})
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    res.json(items);
  } catch (err) {
    console.error("GET /gallery/admin error:", err);
    res.status(500).json({ message: "Failed to load admin gallery" });
  }
});

// CREATE gallery image
router.post("/admin", upload.single("image"), async (req, res) => {
  try {
    // if (!isAdmin(req)) {
    //   if (!req.user?._id) {
    //     return res.status(401).json({ message: "Unauthorized" });
    //   }
    //   q.createdByUserId = req.user._id;
    // }
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const uploaded = await cloudinary.uploader.upload(fileBase64, {
      folder: "nour/gallery",
    });

    const item = await GalleryImage.create({
      image: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      },
      title: req.body.title || "",
      isActive: req.body.isActive !== "false",
      sortOrder: Number(req.body.sortOrder || 0),
    });

    res.status(201).json(item);
  } catch (err) {
    console.error("POST /gallery/admin error:", err);
    res.status(500).json({ message: "Failed to upload gallery image" });
  }
});

// UPDATE gallery image meta
router.put("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title = "", isActive = true, sortOrder = 0 } = req.body;
    // if (!isAdmin(req)) {
    //   if (!req.user?._id) {
    //     return res.status(401).json({ message: "Unauthorized" });
    //   }
    //   q.createdByUserId = req.user._id;
    // }
    const updated = await GalleryImage.findByIdAndUpdate(
      id,
      {
        title,
        isActive,
        sortOrder: Number(sortOrder || 0),
      },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Gallery image not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("PUT /gallery/admin/:id error:", err);
    res.status(500).json({ message: "Failed to update gallery image" });
  }
});

// DELETE gallery image
router.delete("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // if (!isAdmin(req)) {
    //   if (!req.user?._id) {
    //     return res.status(401).json({ message: "Unauthorized" });
    //   }
    //   q.createdByUserId = req.user._id;
    // }
    const item = await GalleryImage.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Gallery image not found" });
    }

    if (item.image?.publicId) {
      await cloudinary.uploader.destroy(item.image.publicId);
    }

    await item.deleteOne();

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /gallery/admin/:id error:", err);
    res.status(500).json({ message: "Failed to delete gallery image" });
  }
});

module.exports = router;
