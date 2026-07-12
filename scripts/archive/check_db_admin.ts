import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: "postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular"
});

async function main() {
  await client.connect();
  let res = await client.query(`
    SELECT *
    FROM admin
    WHERE a_username IN ('wanchalerm_c', 'GRP_LEADER', 'hr.it.csc') OR a_role = 'GRP_LEADER' OR a_username LIKE '%wanch%' OR a_username LIKE '%GRP%'
  `);
  console.log("Admins:");
  console.dir(res.rows, { depth: null });
  await client.end();
}
main().catch(console.error);
