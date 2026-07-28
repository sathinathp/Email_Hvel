console.log('BEFORE DOTENV:');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'present' : 'missing');

require('dotenv').config({ path: '../.env' });
console.log('AFTER DOTENV:');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'present' : 'missing');
