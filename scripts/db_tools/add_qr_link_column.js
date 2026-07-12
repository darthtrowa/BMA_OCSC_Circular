import pool from './src/config/database.js';

async function main() {
  try {
    await pool.query(`ALTER TABLE c_information ADD COLUMN IF NOT EXISTS in_qr_link VARCHAR(1000) DEFAULT '-';`);
    console.log('Successfully added in_qr_link column to c_information table');
  } catch (error) {
    console.error('Failed to alter table:', error);
  } finally {
    await pool.end();
  }
}

main();
