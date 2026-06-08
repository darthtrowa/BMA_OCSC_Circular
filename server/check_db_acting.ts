import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: "postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular"
});

async function main() {
  await client.connect();
  let res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'admin'
  `);
  console.log("admin columns:");
  console.dir(res.rows, { depth: null });

  let acting_res = await client.query(`
    SELECT * FROM c_acting_appointments
  `);
  console.log("Acting rows:", acting_res.rows);
  
  let dele_res = await client.query(`
    SELECT * FROM c_workflow_delegations
  `);
  console.log("Delegation rows:", dele_res.rows);

  await client.end();
}
main().catch(console.error);
