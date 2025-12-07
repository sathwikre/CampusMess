require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const menuRoutes = require('./routes/menuRoutes');
const { verifyTransporter } = require('./services/emailService');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple ping route
app.get('/ping', (req, res) => {
  res.json({ success: true, message: 'pong' });
});

// Menu API routes
app.use('/api', menuRoutes);

// MongoDB connection
const DB_URI = process.env.DB_URI;
if (DB_URI) {
  mongoose.connect(DB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

  mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
  });
} else {
  console.warn('DB_URI not set; skipping MongoDB connection');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await verifyTransporter();
});
