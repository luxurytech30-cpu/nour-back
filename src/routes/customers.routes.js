const router = require("express").Router();
const Customer = require("../models/Customer");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const {
  cleanCustomerName,
  normalizeCustomerPhone,
  upsertCustomer,
} = require("../utils/customerStore");
const { sendWhatsAppToPhone } = require("../utils/sendMessageWa");

function serializeCustomer(customer) {
  return {
    _id: String(customer._id),
    name: customer.name || "",
    normalizedName: customer.normalizedName || "",
    phone: customer.phone || "",
    normalizedPhone: customer.normalizedPhone || "",
    trusted: Boolean(customer.trusted),
    source: customer.source || "",
  };
}

router.get("/authorization", async (req, res) => {
  try {
    const normalizedPhone = normalizeCustomerPhone(req.query.phone);
    if (!normalizedPhone) {
      return res.json({ trusted: false, customer: null });
    }

    const customer = await Customer.findOne({ normalizedPhone }).lean();
    return res.json({
      trusted: Boolean(customer?.trusted),
      customer: customer ? serializeCustomer(customer) : null,
    });
  } catch (error) {
    console.error("CUSTOMER AUTHORIZATION ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit || 500), 1000);
    const filter = {};

    if (q) {
      const normalized = normalizeCustomerPhone(q);
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } },
      ];

      if (normalized) {
        filter.$or.push({ normalizedPhone: { $regex: normalized } });
      }
    }

    const customers = await Customer.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ customers: customers.map(serializeCustomer) });
  } catch (error) {
    console.error("LIST CUSTOMERS ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, phone, trusted = true } = req.body || {};
    if (!phone) return res.status(400).json({ message: "phone is required" });

    const customer = await upsertCustomer({
      name,
      phone,
      trusted,
      source: "admin",
      verifiedAt: trusted ? new Date() : null,
    });

    return res.status(201).json({ customer: serializeCustomer(customer) });
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

router.post("/import", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.customers) ? req.body.customers : [];
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const phone = row?.phone;
      const normalizedPhone = normalizeCustomerPhone(phone);
      if (!normalizedPhone) {
        skipped += 1;
        continue;
      }

      await upsertCustomer({
        name: cleanCustomerName(row?.name),
        phone,
        trusted: true,
        source: "pdf_import",
        verifiedAt: new Date(),
      });
      imported += 1;
    }

    return res.json({ imported, skipped });
  } catch (error) {
    console.error("IMPORT CUSTOMERS ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

router.post(
  "/broadcast-whatsapp",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const message = String(req.body?.message || "").trim();
      const trustedOnly = req.body?.trustedOnly !== false;

      if (!message) {
        return res.status(400).json({ message: "message is required" });
      }

      const filter = trustedOnly ? { trusted: true } : {};
      const customers = await Customer.find(filter)
        .select("name phone normalizedPhone trusted")
        .lean();

      const uniqueCustomers = customers.filter(
        (customer) => normalizeCustomerPhone(customer.phone) || customer.normalizedPhone,
      );

      const results = await Promise.allSettled(
        uniqueCustomers.map(async (customer) => {
          await sendWhatsAppToPhone(
            customer.normalizedPhone || customer.phone,
            message,
          );
          return {
            _id: String(customer._id),
            name: customer.name || "",
            phone: customer.phone || "",
          };
        }),
      );

      const sent = results.filter((result) => result.status === "fulfilled");
      const failed = results
        .map((result, index) => ({ result, customer: uniqueCustomers[index] }))
        .filter((item) => item.result.status === "rejected")
        .map((item) => ({
          _id: String(item.customer._id),
          name: item.customer.name || "",
          phone: item.customer.phone || "",
          error:
            item.result.status === "rejected"
              ? item.result.reason?.message || "Failed to send"
              : "",
        }));

      return res.json({
        ok: true,
        trustedOnly,
        total: uniqueCustomers.length,
        sent: sent.length,
        failed: failed.length,
        failures: failed.slice(0, 20),
      });
    } catch (error) {
      console.error("BROADCAST CUSTOMERS WHATSAPP ERROR:", error);
      return res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
