const { Client } = require('pg');
const client = new Client('postgresql://root:root@localhost:5432/circular_db');

client.connect().then(() => {
  return client.query("SELECT a_username, a_name, a_permiss, a_role FROM admin WHERE a_username = 'admincsc01'");
}).then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
}).catch(console.error).finally(() => {
  client.end();
});
