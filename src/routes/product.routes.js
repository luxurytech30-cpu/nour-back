const router = require("express").Router();
const Product = require("../models/Product");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const { requireAdmin } = require("../middleware/admin");
const { requireAuth } = require("../middleware/auth");


// list
router.get("/", async (req, res) => {
  const { active } = req.query;
  const filter = {};
  if (active === "true") filter.isActive = true;
  const products = await Product.find(filter).sort({ createdAt: -1 });
  res.json(products);
});

// create (admin) + image to cloudinary
router.post("/",requireAuth, requireAdmin, upload.single("image"), async (req, res) => {
  const { name, descrip, price, stock, isTop, isActive, cate, brand } =
    req.body;
  if (!name || price == null)
    return res.status(400).json({ message: "name + price required" });

  let image = { url: "", publicId: "" };

  if (req.file) {
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const uploaded = await cloudinary.uploader.upload(base64, {
      folder: "nour/products",
    });
    image = { url: uploaded.secure_url, publicId: uploaded.public_id };
  }

  const product = await Product.create({
    name,
    descrip: descrip || "",
    price: Number(price),
    stock: Number(stock || 0),
    isTop: isTop === "true" || isTop === true,
    isActive: isActive === "false" ? false : true,
    cate: cate || "",
    brand: brand || "",
    image,
  });

  res.json(product);
});

router.patch("/:id",requireAuth, requireAdmin, upload.single("image"), async (req, res) => {
  try {
    console.log("PATCH BODY:", req.body);
    console.log(
      "PATCH FILE:",
      req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            hasBuffer: !!req.file.buffer,
          }
        : null,
    );

    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });

    // optional replace image
    if (req.file) {
      try {
        if (!req.file.buffer) {
          return res.status(400).json({
            message: "Upload buffer missing (multer storage not memory?)",
          });
        }

        if (p.image?.publicId) {
          await cloudinary.uploader.destroy(p.image.publicId).catch(() => {});
        }

        const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const uploaded = await cloudinary.uploader.upload(base64, {
          folder: "nour/products",
        });

        p.image = { url: uploaded.secure_url, publicId: uploaded.public_id };
      } catch (err) {
        console.error("CLOUDINARY UPLOAD ERROR:", err);
        return res
          .status(500)
          .json({ message: err?.message || "Image upload failed" });
      }
    }

    const up = req.body;

    if (up.name != null) p.name = up.name;
    if (up.descrip != null) p.descrip = up.descrip;
    if (up.price != null) p.price = Number(up.price);
    if (up.stock != null) p.stock = Number(up.stock);
    if (up.isTop != null) p.isTop = up.isTop === "true" || up.isTop === true;
    if (up.isActive != null)
      p.isActive = up.isActive === "true" || up.isActive === true;
    if (up.cate != null) p.cate = up.cate;
    if (up.brand != null) p.brand = up.brand;

    // SAFE JSON parse
    if (up.sales != null) {
      p.sales =
        typeof up.sales === "string" ? JSON.parse(up.sales || "[]") : up.sales;
    }
    if (up.copoune != null) {
      p.copoune =
        typeof up.copoune === "string"
          ? JSON.parse(up.copoune || "{}")
          : up.copoune;
    }

    await p.save();
    return res.json(p);
  } catch (err) {
    console.error("PATCH /api/products/:id FATAL:", err);
    return res.status(500).json({ message: err?.message || "Server error" });
  }
});

// delete (admin)
router.delete("/:id",requireAuth, requireAdmin, async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });
  if (p.image?.publicId)
    await cloudinary.uploader.destroy(p.image.publicId).catch(() => {});
  await p.deleteOne();
  res.json({ message: "Deleted" });
});

module.exports = router;
