require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();
pool.query('ALTER TABLE c_bot_findings ADD COLUMN IF NOT EXISTS bot_payload JSONB')
  .then(() => {
    console.log('Column added successfully');
    pool.end();
  })
  .catch(err => {
    console.error('Error adding column', err);
    pool.end();
  });
