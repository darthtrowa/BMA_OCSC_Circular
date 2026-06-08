import db from './src/config/database.js';
async function run() {
  const res = await db.query(`SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'c_workflow_delegations'`);
  console.log(res.rows);
  process.exit(0);
}
run();
