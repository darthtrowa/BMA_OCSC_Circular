import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: "postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular"
});

async function main() {
  await client.connect();
  let res = await client.query(`
    SELECT *
    FROM c_agency
    WHERE ag_id IN (41, 47)
  `);
  console.log("Agencies:");
  console.dir(res.rows, { depth: null });
  await client.end();
}
main().catch(console.error);
