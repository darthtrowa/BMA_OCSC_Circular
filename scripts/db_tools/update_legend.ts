import db from './src/config/database.js';

async function update() {
  try {
    const { rowCount } = await db.query("UPDATE c_information SET updated_user = 'legend', in_current_owner_id = NULL, in_creator_id = NULL WHERE in_workflow_status = 'COMPLETED'");
    console.log('Updated rows:', rowCount);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

update();
