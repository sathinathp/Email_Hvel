const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkPasskeys() {
  try {
    const res = await pool.query('SELECT email, cred_id, created_at FROM passkeys');
    console.log('Total Passkeys in DB:', res.rows.length);
    res.rows.forEach(r => console.log(`- ${r.email}: ${r.cred_id.substring(0, 10)}... (Created: ${r.created_at})`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkPasskeys();
