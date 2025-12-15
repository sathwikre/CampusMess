///////////////////////////////////////////////////////////////
// LOAD ENVIRONMENT VARIABLES
///////////////////////////////////////////////////////////////
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

///////////////////////////////////////////////////////////////
// IMPORTS
///////////////////////////////////////////////////////////////
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const nodemailer = require("nodemailer");

const menuRoutes = require("./routes/menuRoutes");
const Menu = require("./models/Menu"); // ✅ IMPORTANT

///////////////////////////////////////////////////////////////
// APP SETUP
///////////////////////////////////////////////////////////////
const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

///////////////////////////////////////////////////////////////
// STATIC FILES
///////////////////////////////////////////////////////////////
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(uploadsDir));
app.use(express.static(path.join(__dirname, "public")));

///////////////////////////////////////////////////////////////
// DATABASE CONNECTION
///////////////////////////////////////////////////////////////
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("❌ FATAL: MONGODB_URI not defined");
  process.exit(1);
}

console.log(
  "DEBUG: Connecting to MongoDB —",
  mongoUri.slice(0, 40).replace(/\/\/.*@/, "//*****@")
);

mongoose.set("strictQuery", false);

mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

///////////////////////////////////////////////////////////////
// EMAIL (REPORT ISSUE)
///////////////////////////////////////////////////////////////
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

transporter.verify((err) => {
  if (err) console.error("❌ Email error:", err);
  else console.log("✅ Email transporter ready");
});

///////////////////////////////////////////////////////////////
// ROUTES
///////////////////////////////////////////////////////////////

/**
 * ✅ GET TODAY'S MENUS
 * This is the MISSING PIECE that broke breakfast & hostel buttons
 */
app.get("/api/menus/today", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const menus = await Menu.find({
      menuDate: today,
    }).lean();

    res.json({
      success: true,
      data: menus,
    });
  } catch (err) {
    console.error("❌ Error loading today's menus:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load menus",
    });
  }
});

/**
 * ✅ MENU ROUTES (POST, DELETE, etc.)
 */
app.use("/api/menus", menuRoutes);

/**
 * REPORT ISSUE
 */
app.post("/api/report-issue", async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: process.env.MAIL_USER,
      subject: "New Mess Issue",
      text: JSON.stringify(req.body, null, 2),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Issue mail error:", err);
    res.status(500).json({ success: false });
  }
});

///////////////////////////////////////////////////////////////
// FRONTEND FALLBACK (VERY IMPORTANT)
///////////////////////////////////////////////////////////////
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

///////////////////////////////////////////////////////////////
// START SERVER
///////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
