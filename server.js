///////////////////////////////////////////////////////////////
// LOAD ENVIRONMENT VARIABLES
///////////////////////////////////////////////////////////////
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const nodemailer = require("nodemailer");

///////////////////////////////////////////////////////////////
// EXPRESS APP SETUP
///////////////////////////////////////////////////////////////
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend from /public
app.use(express.static(path.join(__dirname, "public")));

///////////////////////////////////////////////////////////////
// MONGODB CONNECTION (MODERN, NO DEPRECATED OPTIONS)
///////////////////////////////////////////////////////////////
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
    console.error("FATAL: MONGODB_URI is not defined in environment.");
} else {
    console.log(
        "DEBUG: Connecting to MongoDB — URI preview:",
        mongoUri.slice(0, 40).replace(/\/\/.*@/, "//*****@")
    );
}

mongoose.set("strictQuery", false);

mongoose
    .connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
    })
    .then(() => console.log("MongoDB connected successfully."))
    .catch((err) =>
        console.error("MongoDB connection error:", err.stack || err)
    );

///////////////////////////////////////////////////////////////
// MODELS (Menus + Issues)
///////////////////////////////////////////////////////////////
const MenuSchema = new mongoose.Schema({
    day: String,
    breakfast: String,
    lunch: String,
    dinner: String,
});

const IssueSchema = new mongoose.Schema({
    name: String,
    email: String,
    hostel: String,
    type: String,
    message: String,
    createdAt: { type: Date, default: Date.now },
});

const Menu = mongoose.model("menus", MenuSchema);
const Issue = mongoose.model("issues", IssueSchema);

///////////////////////////////////////////////////////////////
// EMAIL TRANSPORTER (Nodemailer)
///////////////////////////////////////////////////////////////
let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

transporter.verify(function (error, success) {
    if (error) {
        console.error("Email transporter verification failed:", error);
    } else {
        console.log("Email transporter ready");
    }
});

///////////////////////////////////////////////////////////////
// MULTER — FILE UPLOAD FOR MENU IMAGES (optional)
///////////////////////////////////////////////////////////////
const upload = multer({ dest: "uploads/" });

///////////////////////////////////////////////////////////////
// ROUTES
///////////////////////////////////////////////////////////////

///////////////////////
// GET TODAY'S MENU
///////////////////////
app.get("/api/menus/today", async (req, res) => {
    try {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const today = days[new Date().getDay()];

        const menu = await Menu.findOne({ day: today });
        res.json(menu || { message: "No menu found" });
    } catch (err) {
        console.error("Error fetching today's menu:", err);
        res.status(500).json({ error: "Server error" });
    }
});

///////////////////////
// ADD/UPDATE MENU
///////////////////////
app.post("/api/menus", upload.single("image"), async (req, res) => {
    try {
        const { day, breakfast, lunch, dinner } = req.body;

        const updated = await Menu.findOneAndUpdate(
            { day },
            { breakfast, lunch, dinner },
            { new: true, upsert: true }
        );

        res.json(updated);
    } catch (err) {
        console.error("Error saving menu:", err);
        res.status(500).json({ error: "Failed to save menu" });
    }
});

///////////////////////
// REPORT AN ISSUE
///////////////////////
app.post("/api/report-issue", async (req, res) => {
    try {
        const issue = await Issue.create(req.body);

        res.json({ success: true, issue });

        // Email admin
        await transporter.sendMail({
            from: process.env.MAIL_USER,
            to: process.env.MAIL_USER,
            subject: "New Mess Issue Report",
            text: JSON.stringify(req.body, null, 2),
        });
    } catch (err) {
        console.error("REPORT ISSUE ERROR:", err);
        res.status(500).json({ error: "Error reporting issue" });
    }
});

///////////////////////////////////////////////////////////////
// FALLBACK — SERVE FRONTEND FOR UNKNOWN ROUTES
///////////////////////////////////////////////////////////////
// FALLBACK — SERVE FRONTEND FOR UNKNOWN ROUTES
app.get((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


///////////////////////////////////////////////////////////////
// START SERVER
///////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
