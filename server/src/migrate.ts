import 'dotenv/config';
import pool from './config/database.js';

async function migrate() {
  try {
    console.log('Starting migration...');
    
    // Check if column exists first
    const checkSql = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='c_information' AND column_name='in_circular_detail';
    `;
    const { rows } = await pool.query(checkSql);
    
    if (rows.length === 0) {
      console.log('Adding column in_circular_detail to c_information table...');
      await pool.query('ALTER TABLE c_information ADD COLUMN in_circular_detail TEXT;');
      console.log('Column in_circular_detail added successfully.');
    } else {
      console.log('Column in_circular_detail already exists.');
    }

    const newFields = [
      { name: 'in_original_link', type: 'TEXT' },
      { name: 'in_attachment_link', type: 'TEXT' }
    ];

    for (const field of newFields) {
      const { rows: fieldRows } = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='c_information' AND column_name='${field.name}';
      `);
      if (fieldRows.length === 0) {
        console.log(`Adding column ${field.name}...`);
        await pool.query(`ALTER TABLE c_information ADD COLUMN ${field.name} ${field.type} DEFAULT '-';`);
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
