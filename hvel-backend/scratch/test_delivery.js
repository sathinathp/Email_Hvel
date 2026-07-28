const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const smtpHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.EMAIL_PORT || '465');
const smtpSecure = process.env.EMAIL_SECURE === 'false' ? false : (process.env.EMAIL_SECURE === 'true' ? true : smtpPort === 465);

console.log('SMTP Config:');
console.log('Host:', smtpHost);
console.log('Port:', smtpPort);
console.log('Secure:', smtpSecure);
console.log('User:', process.env.EMAIL_USER);

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: { 
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS 
  }
});

const targetEmail = 'sathinath.padhi@petabytz.com';

const mailOptions = {
  from: `"HVEL Security Test" <${process.env.EMAIL_USER}>`,
  to: targetEmail,
  subject: 'HVEL Petabytz SMTP Test',
  text: 'This is a test to verify email delivery from HVEL backend to petabytz email using Office365 SMTP settings.',
  html: '<h3>HVEL Test Delivery</h3><p>If you receive this, the Office365 SMTP transporter successfully delivered the message to your petabytz.com mailbox.</p>'
};

console.log('Sending test email to:', targetEmail);
transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error('SMTP Error occurred:', err);
  } else {
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  }
});
