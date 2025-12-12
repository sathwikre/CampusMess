const mongoose = require('mongoose');

// Load .env only during local development (do not override production env vars)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const path = require('path');
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

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("ERROR: MONGODB_URI is not set in environment variables.");
}

mongoose.set('strictQuery', false);

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log("MongoDB connected."))
.catch(err => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
