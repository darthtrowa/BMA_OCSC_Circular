require('dotenv').config();
const { Client } = require('pg');
const c = new Client({connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/circular_db'});
c.connect().then(()=>c.query("UPDATE c_information SET in_flow_state = 'out' WHERE in_id = 510")).then(r=>{console.log('Update done'); c.end()}).catch(console.error);
