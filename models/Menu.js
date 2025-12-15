const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  text: {
    type: String,
    required: true,
  },
  imagePath: {
    type: String,
  },
  thumbPath: {
    type: String,
  },
  createdBy: {
    type: String,
  },
  createdAt: {
    type: mongoose.Schema.Types.Mixed,
  },
  ownerToken: {
    type: String,
    required: true,
  },
}, { _id: true });

const menuSchema = new mongoose.Schema({
  hostel: {
    type: String,
    enum: ['Ellora', 'Hampi', 'Shilpa', 'Ajantha'],
    required: true,
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner'],
    required: true,
  },
  menuDate: {
    type: Date,
    required: true,
  },
  day: {
    type: String,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true,
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

// Unique index to prevent duplicate menu entries for same hostel/meal/date
menuSchema.index({ hostel: 1, mealType: 1, menuDate: 1 }, { unique: true });

module.exports = mongoose.model('Menu', menuSchema);
