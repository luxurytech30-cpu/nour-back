require("dotenv").config();
const express = require("express");
const cors = require("cors");
// const session = require("express-session");
// const MongoStore = require("connect-mongo").default;
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
const waitlistRoutes = require("./routes/waitlist");
const verfyRoutes = require("./routes/phoneVerification");

const app = express();

const allowedOrigins = [
  "https://epex-ruby.vercel.app",
  "https://apex-nine-mu.vercel.app",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://192.168.1.7:8080",
];

// app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      console.log("CORS ORIGIN:", origin);

      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// app.use((req, res, next) => {
//   console.log("ORIGIN:", req.headers.origin);
//   console.log("COOKIE:", req.headers.cookie);
//   next();
// });

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// app.use(
//   session({
//     name: "sid",
//     secret: process.env.SESSION_SECRET || "dev_secret",
//     resave: false,
//     saveUninitialized: false,
//     rolling: true,
//     store: MongoStore.create({
//       mongoUrl: process.env.MONGO_URI,
//       touchAfter: 24 * 3600,
//     }),
//     // cookie: {
//     //   httpOnly: true,
//     //   sameSite: "lax",
//     //   secure: false,
//     //   maxAge: 1000 * 60 * 60 * 24 * 7,
//     // },
//     cookie: {
//       httpOnly: true,
//       sameSite: "none",
//       secure: true,
//       maxAge: 1000 * 60 * 60 * 24 * 7,
//     },
//   }),
// );

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
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/verify", verfyRoutes);

module.exports = app;
