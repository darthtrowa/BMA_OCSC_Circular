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
    console.log('--- Checking Active PostgreSQL Connections ---');
    
    // Query pg_stat_activity
    const res = await pool.query(`
      SELECT pid, usename, datname, client_addr, client_port, state, query, backend_start
      FROM pg_stat_activity
      WHERE datname = 'ocsc_circular' OR datname = 'circular'
    `);
    
    console.log(`\nFound ${res.rows.length} active connections to circular databases:`);
    res.rows.forEach((r, idx) => {
      console.log(`[${idx + 1}] PID: ${r.pid} | User: ${r.usename} | DB: ${r.datname} | IP: ${r.client_addr}:${r.client_port} | State: ${r.state} | Start: ${r.backend_start}`);
      console.log(`    Query: ${r.query.slice(0, 100)}...`);
    });
    
    // Summary by state
    const sumRes = await pool.query(`
      SELECT state, count(*) as count
      FROM pg_stat_activity
      GROUP BY state
    `);
    console.log('\nConnections Summary by State (All Databases):');
    sumRes.rows.forEach(r => {
      console.log(` - State: ${r.state || 'internal'} | Count: ${r.count}`);
    });

  } catch (err) {
    console.error('Error querying pg_stat_activity:', err.message);
    console.log('\nHint: If connection fails with "too many clients", you might need to increase max_connections in postgresql.conf or terminate idle connections.');
  } finally {
    await pool.end();
  }
}

run();
