import 'dotenv/config';
import { Adapter } from '@adminjs/sql';

async function test() {
  try {
    const sqlAdapter = new Adapter('postgresql', {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'circular',
      port: parseInt(process.env.DB_PORT || '5432'),
    });
    const db = await sqlAdapter.init();
    console.log("Success! Tables found:");
    console.log(db.tables().map(t => t.tableName));
    process.exit(0);
  } catch(e) {
    console.error("Error:", e);
    process.exit(1);
  }
}
test();
