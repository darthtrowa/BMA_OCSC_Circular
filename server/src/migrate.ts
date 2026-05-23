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

    // --- Workflow & Bot Schema Enhancements ---
    console.log('Checking workflow & bot schema enhancements...');

    // 1. Columns for admin table
    const adminFields = [
      { name: 'a_role', type: 'VARCHAR(50)' },
      { name: 'a_parent_id', type: 'INTEGER' },
      { name: 'a_position', type: 'VARCHAR(255)' }
    ];
    for (const field of adminFields) {
      const { rows } = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='admin' AND column_name='${field.name}';
      `);
      if (rows.length === 0) {
        console.log(`Adding column ${field.name} to admin table...`);
        await pool.query(`ALTER TABLE admin ADD COLUMN ${field.name} ${field.type};`);
      }
    }

    // 2. Columns for c_information table
    const infoFields = [
      { name: 'in_workflow_status', type: 'VARCHAR(50)', default: "DEFAULT 'DRAFT'" },
      { name: 'in_current_owner_id', type: 'INTEGER', constraint: 'REFERENCES admin(a_id)' }
    ];
    for (const field of infoFields) {
      const { rows } = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='c_information' AND column_name='${field.name}';
      `);
      if (rows.length === 0) {
        console.log(`Adding column ${field.name} to c_information table...`);
        const query = `ALTER TABLE c_information ADD COLUMN ${field.name} ${field.type} ${field.default || ''} ${field.constraint || ''};`;
        await pool.query(query);
      }
    }

    // 3. Table c_workflow_history
    const { rows: historyTable } = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' AND table_name='c_workflow_history';
    `);
    if (historyTable.length === 0) {
      console.log('Creating table c_workflow_history...');
      await pool.query(`
        CREATE TABLE c_workflow_history (
          wh_id SERIAL PRIMARY KEY,
          in_id INTEGER REFERENCES c_information(in_id),
          from_user_id INTEGER REFERENCES admin(a_id),
          to_user_id INTEGER REFERENCES admin(a_id),
          status_from VARCHAR(50),
          status_to VARCHAR(50),
          action_note TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('Table c_workflow_history created successfully.');
    }

    // 4. Table c_bot_findings
    const { rows: botTable } = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' AND table_name='c_bot_findings';
    `);
    if (botTable.length === 0) {
      console.log('Creating table c_bot_findings...');
      await pool.query(`
        CREATE TABLE c_bot_findings (
          bot_id SERIAL PRIMARY KEY,
          bot_title TEXT,
          bot_url TEXT UNIQUE,
          bot_date DATE,
          bot_status VARCHAR(20) DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('Table c_bot_findings created successfully.');
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
