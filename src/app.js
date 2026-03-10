require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");
const barberRoutes = require("./routes/barber.routes");
const queueRoutes = require("./routes/queue.routes");
const courseRoutes = require("./routes/course.routes");
const appointmentsRoutes = require("./routes/appointments");
const barberScheduleRoutes = require("./routes/barberSchedule");
const servicesRoutes = require("./routes/services.routes");

const app = express();

const allowedOrigins = [
  "https://x-up10.vercel.app",
  "http://localhost:8080",
  "http://localhost:8081",
];

app.set("trust proxy", 1);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),
    cookie: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    },
  }),
);

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/barbers", barberRoutes);
app.use("/api/queues", queueRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/barbers-schedule", barberScheduleRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/availability", require("./routes/availability.routes"));
app.use("/api/services", servicesRoutes);

module.exports = app;
