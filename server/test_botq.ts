import db from './src/config/database.js';

async function test() {
  const { rows } = await db.query('SELECT bot_payload FROM c_bot_queue LIMIT 1');
  console.log(rows);
  process.exit(0);
}
test();
