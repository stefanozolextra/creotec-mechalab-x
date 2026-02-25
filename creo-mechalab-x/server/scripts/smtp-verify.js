require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

transporter.verify()
  .then(() => {
    console.log('✅ SMTP verify OK');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ SMTP verify failed:', e.code || '', e.response || e.message);
    process.exit(1);
  });
