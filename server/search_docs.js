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
    console.log('--- Searching for Circular Documents ---');
    
    // Search for latest 15 documents
    const res = await pool.query(
      `SELECT in_id, in_detail, in_num_date, in_workflow_status, in_current_owner_id, in_flow_state 
       FROM c_information 
       ORDER BY created_at DESC LIMIT 15`
    );
    
    console.log('\nLatest 15 documents:');
    res.rows.forEach(r => {
      console.log(` - ID: ${r.in_id} | Num/Date: "${r.in_num_date}" | Detail: "${r.in_detail}" | Status: ${r.in_workflow_status}`);
    });
    
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await pool.end();
  }
}

run();
