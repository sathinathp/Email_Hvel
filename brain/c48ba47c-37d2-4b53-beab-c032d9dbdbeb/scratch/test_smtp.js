const nodemailer = require('nodemailer');
require('dotenv').config({ path: '../hvel-backend/.env' });

console.log("Testing SMTP with:", process.env.EMAIL_USER);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const mailOptions = {
  from: process.env.EMAIL_USER,
  to: process.env.EMAIL_USER, // Send to self
  subject: 'HVEL SMTP Test',
  text: 'If you receive this, your .env SMTP settings are correct.'
};

transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error("SMTP TEST FAILED:", err);
  } else {
    console.log("SMTP TEST SUCCESSFUL:", info.response);
  }
});
