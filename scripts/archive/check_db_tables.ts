import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: "postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular"
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log(res.rows.map(r => r.table_name));
  await client.end();
}
main().catch(console.error);
