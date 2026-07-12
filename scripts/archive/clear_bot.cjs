const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: '1956wine', host: 'localhost', database: 'circular' });
client.connect().then(() => {
  return client.query('TRUNCATE TABLE c_bot_findings RESTART IDENTITY');
}).then(() => {
  console.log('Bot findings cleared successfully.');
  return client.end();
}).catch(console.error);
