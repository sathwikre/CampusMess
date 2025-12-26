const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const crypto = require("crypto");
const Menu = require("../models/Menu");

// 🔹 Cloudinary + Multer
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
console.log("☁️ Cloudinary ENV CHECK:", {
  CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
});

///////////////////////////////////////////////////////////////
// CLOUDINARY CONFIG
///////////////////////////////////////////////////////////////
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "campus-mess",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

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
    res.status(500).json({ success: false, error: "Server error" });
  }
});

///////////////////////////////////////////////////////////////
// ADD MENU ITEM
///////////////////////////////////////////////////////////////
router.post("/", (req, res, next) => {
  upload.single("photo")(req, res, (err) => {
    if (err) {
      console.error("❌ Upload error:", err);
      console.error("❌ Upload error type:", err.constructor.name);
      console.error("❌ Upload error message:", err.message);
      if (err.stack) {
        console.error("❌ Upload error stack:", err.stack);
      }
      
      // Handle Cloudinary errors (check http_code first)
      if (err.http_code) {
        console.error("❌ Cloudinary error with http_code:", err.http_code);
        return res.status(err.http_code || 500).json({
          success: false,
          error: err.message || "Cloudinary upload failed",
        });
      }
      
      // Handle Multer errors
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          error: `Upload error: ${err.message}`,
        });
      }
      
      // Generic error handler
      return res.status(500).json({
        success: false,
        error: err.message || "File upload failed",
      });
    }
    console.log("✅ Upload successful, file:", req.file ? "present" : "not provided");
    next();
  });
}, async (req, res, next) => {
  try {
    let { hostel, singleItem, createdBy } = req.body;
    const mealType = req.body.mealType?.toLowerCase().trim();

    // Normalize hostel to match schema enum
    hostel =
      hostel?.charAt(0).toUpperCase() +
      hostel?.slice(1).toLowerCase();

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

    // ✅ CLOUDINARY IMAGE URL
    if (req.file) {
      newItem.imagePath = req.file.path;   // Cloudinary URL
      newItem.thumbPath = req.file.path;
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
        $addToSet: { items: newItem },
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, data: menu });
  } catch (err) {
    console.error("❌ Save menu error:", err);
    console.error("❌ Error name:", err.name);
    console.error("❌ Error message:", err.message);
    if (err.stack) {
      console.error("❌ Error stack:", err.stack);
    }
    // Ensure JSON response is always sent
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: err.message || "Failed to save menu item"
      });
    }
  }
});

///////////////////////////////////////////////////////////////
// DELETE MENU ITEM
///////////////////////////////////////////////////////////////
router.delete("/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { createdBy } = req.body;

    console.log("🗑️ DELETE request received:", { itemId, createdBy });

    if (!itemId) {
      return res.status(400).json({
        success: false,
        error: "Item ID is required",
      });
    }

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        error: "User name is required",
      });
    }

    // Convert itemId to ObjectId for MongoDB query
    let itemObjectId;
    try {
      itemObjectId = new mongoose.Types.ObjectId(itemId);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: "Invalid item ID format",
      });
    }

    // Find the menu containing the item
    const menu = await Menu.findOne({
      "items._id": itemObjectId,
    });

    if (!menu) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }

    // Find the item in the menu
    const item = menu.items.find(
      (item) => {
        const itemIdStr = item._id ? item._id.toString() : '';
        return itemIdStr === itemId;
      }
    );

    if (!item) {
      console.error("❌ Item not found in menu:", itemId);
      console.error("❌ Available item IDs:", menu.items.map(i => i._id?.toString()));
      return res.status(404).json({
        success: false,
        error: "Item not found in menu",
      });
    }
    
    console.log("✅ Item found:", {
      itemId: item._id?.toString(),
      createdBy: item.createdBy,
      text: item.text
    });

    // Verify ownership - check if createdBy matches (trim and compare)
    const itemCreatedBy = (item.createdBy || "").trim();
    const requestCreatedBy = (createdBy || "").trim();
    
    console.log("🔍 Ownership check:", {
      itemCreatedBy,
      requestCreatedBy,
      match: itemCreatedBy === requestCreatedBy,
    });

    if (itemCreatedBy !== requestCreatedBy) {
      return res.status(403).json({
        success: false,
        error: "You can only delete items you created",
      });
    }

    // Use $pull to remove the item from the array
    console.log("🗑️ Attempting to delete item with ObjectId:", itemObjectId);
    const result = await Menu.updateOne(
      { "items._id": itemObjectId },
      { $pull: { items: { _id: itemObjectId } } }
    );

    console.log("📊 Delete result:", {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });

    if (result.matchedCount === 0) {
      console.error("❌ No menu matched for item:", itemId);
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }

    if (result.modifiedCount === 0) {
      console.error("❌ Item matched but not modified:", itemId);
      return res.status(500).json({
        success: false,
        error: "Failed to delete item",
      });
    }

    console.log("✅ Item deleted successfully:", itemId);
    res.json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (err) {
    console.error("❌ Delete item error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to delete item",
    });
  }
});

module.exports = router;
