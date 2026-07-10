import pkg from 'pg';
const { Client } = pkg;

const client = new Client('postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/ocsc_circular');
client.connect()
  .then(async () => {
    // 1. Query agency 2 details and all descendants
    const agenciesRes = await client.query(
      `WITH RECURSIVE agency_tree AS (
        SELECT ag_id, ag_name, parent_ag_id, ag_type, 1 AS depth
        FROM c_agency 
        WHERE ag_id = 2
        UNION ALL
        SELECT a.ag_id, a.ag_name, a.parent_ag_id, a.ag_type, t.depth + 1
        FROM c_agency a
        JOIN agency_tree t ON a.parent_ag_id = t.ag_id
      )
      SELECT * FROM agency_tree ORDER BY depth, ag_id`
    );
    console.log("=== Descendant Agencies starting from ID 2 ===");
    console.dir(agenciesRes.rows, { depth: null });

    const agencyIds = agenciesRes.rows.map(r => r.ag_id);

    // 2. Query all users belonging to these agencies
    const usersRes = await client.query(
      `SELECT a.a_id, a.a_username, a.a_name, a.a_role, a.a_agency_id, ag.ag_name, ag.ag_type, ag.parent_ag_id
       FROM admin a
       LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
       WHERE a.a_agency_id = ANY($1)`,
      [agencyIds]
    );
    console.log("=== Users in division ===");
    console.dir(usersRes.rows, { depth: null });
  })
  .catch(console.error)
  .finally(() => client.end());
