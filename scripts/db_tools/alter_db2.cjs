const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: '1956wine', host: 'localhost', database: 'circular' });
client.connect().then(() => {
  return client.query('ALTER TABLE c_bot_findings ADD COLUMN IF NOT EXISTS bot_payload JSONB');
}).then(() => {
  console.log('Column added successfully');
  return client.end();
}).catch(console.error);
