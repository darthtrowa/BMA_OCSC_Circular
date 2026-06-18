import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:MKhNYeMDtZ4nuUCy@127.0.0.1:5432/ocsc_circular';
const pool = new pg.Pool({ connectionString });

async function run() {
  try {
    console.log('--- Testing /api/stats database queries ---');
    
    const queries = [
      { name: 'all', sql: 'SELECT COUNT(*) AS c FROM c_information' },
      { name: 'use (in_results_id=2)', sql: 'SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=2' },
      { name: 'adjust (in_results_id=4)', sql: 'SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=4' },
      { name: 'notuse (in_results_id=5)', sql: 'SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=5' },
      { name: 'pending (in_results_id=12)', sql: 'SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=12' },
      { name: 'missing (in_results_id=11)', sql: 'SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=11' }
    ];

    for (const q of queries) {
      try {
        console.log(`Running query [${q.name}]: ${q.sql}`);
        const res = await pool.query(q.sql);
        console.log(` -> Success! Result:`, res.rows[0]);
      } catch (err) {
        console.error(` -> [FAILED] Query [${q.name}] failed! Error:`, err.message);
      }
    }
    
  } catch (err) {
    console.error('Database connection failed:', err);
  } finally {
    await pool.end();
  }
}

run();
