const express = require('express');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Menu = require('../models/Menu');
const upload = require('../middleware/uploadMiddleware');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

// Helper: Get today's date in IST (UTC+5:30) at 00:00:00
function getTodayInIST() {
  const now = new Date();
  // Convert to IST by adding 5.5 hours
  const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const date = istNow.getUTCDate();
  return new Date(Date.UTC(year, month, date));
}

// Helper: Normalize a given date to IST 00:00:00
function normalizeToIST(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date)) return null;
  // Set to UTC start of day, then adjust to represent IST midnight
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return new Date(Date.UTC(year, month, day));
}

// Helper: Generate a random owner token (32-byte hex)
function generateOwnerToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * POST /api/menus
 * Supports two modes:
 * 1. Full menu: { hostel, mealType, dishes, createdBy (optional), photo (optional) }
 * 2. Single item append: { hostel, mealType, singleItem, createdBy (optional), photo (optional) }
 * menuDate is automatically generated from current IST time
 */
router.post('/menus', async (req, res) => {
  let uploadedFilePath = null;
  let thumbnailPath = null;

  // Handle multer upload with error handling
  try {
    await new Promise((resolve, reject) => {
      upload.single('photo')(req, res, (err) => {
        if (err) {
          console.error("UPLOAD ERROR:", err);
          return reject(err);
        }
        resolve();
      });
    });
  } catch (uploadError) {
    if (uploadError.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: "File too large. Max 3MB allowed." });
    } else if (uploadError.message.includes('Only jpg, png, and webp images are allowed')) {
      return res.status(400).json({ success: false, error: "Invalid file type. Only jpg, png, and webp allowed." });
    } else {
      return res.status(400).json({ success: false, error: "Invalid file upload" });
    }
  }

  try {
    const { hostel, mealType, dishes, singleItem, createdBy, createdAt } = req.body;

    // Automatically compute menuDate from current IST time
    const normalizedDate = getTodayInIST();

    // Determine if this is a single-item append or full menu replacement
    const isSingleItem = !!singleItem;
    const contentField = isSingleItem ? singleItem : dishes;

    // Validation
    if (!hostel || !mealType || !contentField) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      return res.status(400).json({
        success: false,
        message: isSingleItem
          ? 'Missing required fields: hostel, mealType, singleItem'
          : 'Missing required fields: hostel, mealType, dishes',
      });
    }

    // Process uploaded image if present
    if (req.file) {
      uploadedFilePath = `/uploads/${req.file.filename}`;
      const thumbFilename = `thumb_${Date.now()}${path.extname(req.file.filename)}`;
      const thumbFilePath = path.join(__dirname, '../uploads/thumbs', thumbFilename);

      try {
        // Create thumbnail with sharp (400px width, maintain aspect ratio)
        await sharp(req.file.path)
          .resize(400, 400, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toFile(thumbFilePath);

        thumbnailPath = `/uploads/thumbs/${thumbFilename}`;
      } catch (sharpError) {
        console.error('Error processing thumbnail:', sharpError);
        // Clean up uploaded file if thumbnail fails
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
        return res.status(500).json({
          success: false,
          message: 'Error processing image',
          error: sharpError.message,
        });
      }
    }

    if (isSingleItem) {
      // Single-item append mode with ownership
      const ownerToken = generateOwnerToken();
      const itemId = new mongoose.Types.ObjectId();
      
      const newItem = {
        _id: itemId,
        text: singleItem,
        imagePath: uploadedFilePath || undefined,
        thumbPath: thumbnailPath || undefined,
        createdBy: createdBy || undefined,
        createdAt: createdAt,
        ownerToken,
      };

      // Remove undefined fields
      Object.keys(newItem).forEach(key => newItem[key] === undefined && delete newItem[key]);

      // Atomic $push to append item to items array
      const menu = await Menu.findOneAndUpdate(
        {
          hostel,
          mealType,
          menuDate: normalizedDate,
        },
        {
          $push: { items: newItem },
          $set: { status: 'published' },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      res.status(201).json({
        success: true,
        message: 'Item added successfully',
        itemId: itemId.toString(),
        ownerToken,
        data: menu,
      });
    } else {
      // Full menu replacement mode - convert dishes string to items array
      const itemsList = dishes
        .split('\n')
        .filter(d => d.trim())
        .map(d => ({
          _id: new mongoose.Types.ObjectId(),
          text: d.trim(),
          imagePath: uploadedFilePath || undefined,
          createdBy: createdBy || undefined,
          createdAt: new Date(),
          ownerToken: generateOwnerToken(),
        }));

      // Remove undefined fields
      itemsList.forEach(item => {
        Object.keys(item).forEach(key => item[key] === undefined && delete item[key]);
      });

      // Upsert: find and update or create
      const menu = await Menu.findOneAndUpdate(
        {
          hostel,
          mealType,
          menuDate: normalizedDate,
        },
        {
          $set: {
            hostel,
            mealType,
            menuDate: normalizedDate,
            items: itemsList,
            status: 'published',
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      res.status(201).json({
        success: true,
        message: 'Menu updated successfully',
        data: menu,
      });
    }
  } catch (error) {
    console.error('Error saving menu:', error);
    // Clean up uploaded file if error occurs
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

/**
 * GET /api/menus/today
 * Fetch all published menus for today (in IST)
 */
router.get('/menus/today', async (req, res) => {
  try {
    const todayIST = getTodayInIST();

    const menus = await Menu.find({
      menuDate: todayIST,
      status: 'published',
    }).sort({ hostel: 1, mealType: 1 });

    res.json({
      success: true,
      data: menus,
    });
  } catch (error) {
    console.error('Error fetching menus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/menus/item/:itemId
 * Remove a menu item by ID if the createdBy matches the provided userName
 */
router.delete('/menus/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { userName } = req.body;

    if (!userName) {
      return res.status(400).json({
        success: false,
        message: 'Missing userName',
      });
    }

    // Find all menus and locate the item across all hostels/meals for today
    const todayIST = getTodayInIST();
    const menus = await Menu.find({ menuDate: todayIST });

    let targetMenu = null;
    let targetItem = null;

    for (const menu of menus) {
      const item = menu.items.find(i => i._id.toString() === itemId);
      if (item) {
        targetMenu = menu;
        targetItem = item;
        break;
      }
    }

    if (!targetMenu || !targetItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    // Verify the user is the creator
    if (targetItem.createdBy !== userName) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: only the creator can delete this item',
      });
    }

    // Remove the item using atomic $pull operation
    await Menu.findByIdAndUpdate(
      targetMenu._id,
      { $pull: { items: { _id: targetItem._id } } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

// Report Issue Route
router.post('/report-issue', async (req, res) => {
  try {
    const { name, email, hostel, type, message } = req.body;

    // Validate that message is not empty
    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    // Log the issue on the server console
    console.log("NEW ISSUE REPORT:", { name, email, hostel, type, message });

    // Always return success for valid input
    res.json({ success: true });
  } catch (error) {
    // On unexpected error, log it and return failure
    console.error("REPORT ISSUE ERROR:", error);
    res.status(500).json({
      success: false,
      error: "Failed to record issue"
    });
  }
});

const Notification = require('../models/Notification');

/**
 * GET /api/notifications
 * Return all notifications, sorted by newest first, limit to last 50.
 */
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications
 * Create a new notification.
 */
router.post('/notifications', async (req, res) => {
  try {
    const { message, createdBy } = req.body;

    // Validate message
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Create notification
    const notification = new Notification({
      message: message.trim(),
      createdBy: createdBy || 'Anonymous',
    });

    const savedNotification = await notification.save();

    res.status(201).json({
      success: true,
      data: savedNotification,
    });
  } catch (error) {
    console.error('Error saving notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

module.exports = router;
