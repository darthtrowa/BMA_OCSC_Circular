import 'dotenv/config';
import pool from './config/database.js';

async function check() {
  try {
    console.log('--- Database Connection Check ---');
    const { rows: time } = await pool.query('SELECT NOW()');
    console.log('✅ Connection Successful. Server Time:', time[0].now);

    console.log('\n--- Table List ---');
    const { rows: tables } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log(tables.map(r => r.table_name).join(', '));

    console.log('\n--- Data Summary (c_information) ---');
    const { rows: count } = await pool.query('SELECT COUNT(*) FROM c_information');
    console.log('Total Circulars:', count[0].count);

    console.log('\n--- Year Distribution (Top 10) ---');
    const { rows: years } = await pool.query(`
      SELECT y.year_value, COUNT(i.in_id) as count
      FROM c_year y
      LEFT JOIN c_information i ON i.in_year_id = y.year_id
      GROUP BY y.year_value
      ORDER BY y.year_value DESC
      LIMIT 10
    `);
    console.table(years);

    console.log('\n--- Latest 5 Records ---');
    const { rows: latest } = await pool.query(`
      SELECT i.in_id, i.in_num_date, y.year_value
      FROM c_information i
      JOIN c_year y ON i.in_year_id = y.year_id
      ORDER BY y.year_value DESC, i.in_id DESC
      LIMIT 5
    `);
    console.table(latest);

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Database Check Failed:', err.message);
    process.exit(1);
  }
}

check();
