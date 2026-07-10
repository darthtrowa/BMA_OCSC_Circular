import pkg from 'pg';
const { Client } = pkg;

const client = new Client('postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/ocsc_circular');
client.connect()
  .then(async () => {
    const res = await client.query(
      `SELECT a.a_id, a.a_name, a.a_role, a.a_position, a.a_agency_id, ag.ag_name, ag.ag_type, ag.parent_ag_id
       FROM admin a
       LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
       WHERE a.a_username = 'somboon_p'`
    );
    console.log(res.rows);
  })
  .catch(console.error)
  .finally(() => client.end());
