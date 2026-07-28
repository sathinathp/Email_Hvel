require('dotenv').config({ path: '../.env' });
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);
console.log('HRMS_EMAIL_PASS length:', process.env.HRMS_EMAIL_PASS ? process.env.HRMS_EMAIL_PASS.length : 0);
