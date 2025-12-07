const nodemailer = require('nodemailer');

// User must generate Gmail App Password:
// 1. Go to Google Account settings
// 2. Enable 2-factor authentication
// 3. Go to Security → App passwords
// 4. Generate app password for "Mail"
// 5. Store in .env as:
// MAIL_USER=suramsathwikreddy292@gmail.com
// MAIL_PASS=hrqdlgywfnuurlza

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// Verify transporter on startup
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('Email transporter ready');
  } catch (error) {
    console.error('Email transporter verification failed:', error);
  }
};

// Send email function
const sendEmail = async (mailOptions) => {
  return await transporter.sendMail(mailOptions);
};

module.exports = {
  verifyTransporter,
  sendEmail
};
