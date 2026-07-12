const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: '1956wine', host: 'localhost', database: 'circular' });
client.connect().then(() => {
  return client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'c_information'");
}).then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
  return client.end();
}).catch(console.error);
