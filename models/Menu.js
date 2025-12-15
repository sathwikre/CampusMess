const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  text: {
    type: String,
    required: true,
  },
  imagePath: String,
  thumbPath: String,
  createdBy: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  ownerToken: {
    type: String,
    required: true,
  },
}, { _id: true });

const menuSchema = new mongoose.Schema({
  hostel: {
    type: String,
    required: true,
    lowercase: true,                 // 🔥 AUTO NORMALIZE
    enum: ['ellora', 'hampi', 'shilpa', 'ajantha'],
  },
  mealType: {
    type: String,
    required: true,
    lowercase: true,
    enum: ['breakfast', 'lunch', 'dinner'],
  },
  menuDate: {
    type: Date,
    required: true,
  },
  day: {
    type: String,
    required: true,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  items: [itemSchema],
  status: {
    type: String,
    enum: ['published', 'pending'],
    default: 'published',
  },
}, {
  timestamps: true,
});

// Prevent duplicate menus for same hostel + meal + date
menuSchema.index(
  { hostel: 1, mealType: 1, menuDate: 1 },
  { unique: true }
);

module.exports = mongoose.model('Menu', menuSchema);
