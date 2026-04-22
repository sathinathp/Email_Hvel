const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkPasskeyDetail() {
  try {
    const res = await pool.query("SELECT * FROM passkeys WHERE email = 'sathinathpadhi8@gmail.com'");
    console.log(JSON.stringify(res.rows[0], (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
    , 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkPasskeyDetail();
