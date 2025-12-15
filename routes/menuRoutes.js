const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const crypto = require("crypto");
const Menu = require("../models/Menu");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

///////////////////////////////////////////////////////////////
// UPLOADS SETUP
///////////////////////////////////////////////////////////////
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

///////////////////////////////////////////////////////////////
// GET TODAY MENUS
///////////////////////////////////////////////////////////////
router.get("/today", async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const menus = await Menu.find({
      menuDate: { $gte: start, $lt: end },
    }).lean();

    res.json({ success: true, data: menus });
  } catch (err) {
    console.error("Fetch menus error:", err);
    res.status(500).json({ success: false });
  }
});

///////////////////////////////////////////////////////////////
// ADD MENU ITEM
///////////////////////////////////////////////////////////////
router.post("/", upload.single("photo"), async (req, res) => {
  try {
   const { hostel, singleItem, createdBy } = req.body;
const mealType = req.body.mealType.toLowerCase().trim();

    if (!hostel || !mealType || !singleItem) {
      return res.status(400).json({
        success: false,
        error: "hostel, mealType, singleItem required",
      });
    }

    const menuDate = new Date();
    menuDate.setHours(0, 0, 0, 0);

    const newItem = {
      _id: new mongoose.Types.ObjectId(),
      text: singleItem,
      createdBy: createdBy || "Anonymous",
      createdAt: new Date(),
      ownerToken: crypto.randomUUID(),
    };

    if (req.file) {
      newItem.imagePath = `/uploads/${req.file.filename}`;
      newItem.thumbPath = newItem.imagePath;
    }

    const menu = await Menu.findOneAndUpdate(
      { hostel, mealType, menuDate },
      {
        $set: {
          hostel,
          mealType,
          menuDate,
          status: "published",
        },
        $push: { items: newItem },
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, data: menu });
  } catch (err) {
    console.error("Save menu error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
