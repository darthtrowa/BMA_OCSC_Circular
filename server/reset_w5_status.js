import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:MKhNYeMDtZ4nuUCy@127.0.0.1:5432/ocsc_circular';
const pool = new pg.Pool({ connectionString });

const DOC_TARGET_ID = 513;
const DOC_SOURCE_ID = 508;

async function run() {
  const isWrite = process.argv.includes('--write');
  
  try {
    console.log('--- Connecting to database ---');
    
    // 1. Get Source Document (ว4/2569)
    const srcRes = await pool.query(
      `SELECT in_id, in_detail, in_num_date, in_workflow_status, in_current_owner_id, in_flow_state 
       FROM c_information 
       WHERE in_id = $1`,
      [DOC_SOURCE_ID]
    );
    
    if (srcRes.rows.length === 0) {
      console.error(`[ERROR] Source document (ID: ${DOC_SOURCE_ID}) not found!`);
      return;
    }
    
    const srcDoc = srcRes.rows[0];
    console.log(`\n[Source] Found Source (ID: ${DOC_SOURCE_ID}):`);
    console.log(` - ID: ${srcDoc.in_id}`);
    console.log(` - Number/Date: ${srcDoc.in_num_date}`);
    console.log(` - Workflow Status: ${srcDoc.in_workflow_status}`);
    console.log(` - Current Owner ID: ${srcDoc.in_current_owner_id}`);
    console.log(` - Flow State: ${srcDoc.in_flow_state}`);
    
    // 2. Get Target Document (ว5/2569)
    const tgtRes = await pool.query(
      `SELECT in_id, in_detail, in_num_date, in_workflow_status, in_current_owner_id, in_flow_state 
       FROM c_information 
       WHERE in_id = $1`,
      [DOC_TARGET_ID]
    );
    
    if (tgtRes.rows.length === 0) {
      console.error(`[ERROR] Target document (ID: ${DOC_TARGET_ID}) not found!`);
      return;
    }
    
    const tgtDoc = tgtRes.rows[0];
    console.log(`\n[Target] Found Target (ID: ${DOC_TARGET_ID}) (Current state):`);
    console.log(` - ID: ${tgtDoc.in_id}`);
    console.log(` - Number/Date: ${tgtDoc.in_num_date}`);
    console.log(` - Workflow Status: ${tgtDoc.in_workflow_status}`);
    console.log(` - Current Owner ID: ${tgtDoc.in_current_owner_id}`);
    console.log(` - Flow State: ${tgtDoc.in_flow_state}`);
    
    if (!isWrite) {
      console.log('\n=========================================');
      console.log(' DRY RUN ONLY - No changes were made.');
      console.log(' To apply changes, run the script with:');
      console.log(` node server/reset_w5_status.js --write`);
      console.log('=========================================');
      return;
    }
    
    // 3. Update Target Document (ว5/2569) to match Source (ว4/2569)
    console.log(`\n[Updating] Copying status from ${srcDoc.in_num_date} to ${tgtDoc.in_num_date}...`);
    
    const updateQuery = `
      UPDATE c_information 
      SET in_workflow_status = $1, 
          in_current_owner_id = $2, 
          in_flow_state = $3,
          updated_at = NOW()
      WHERE in_id = $4
    `;
    
    await pool.query(updateQuery, [
      srcDoc.in_workflow_status,
      srcDoc.in_current_owner_id,
      srcDoc.in_flow_state,
      tgtDoc.in_id
    ]);
    
    console.log(`[SUCCESS] Reset status for ${tgtDoc.in_num_date} completed!`);
    
  } catch (err) {
    console.error('[ERROR] Database operation failed:', err);
  } finally {
    await pool.end();
  }
}

run();
