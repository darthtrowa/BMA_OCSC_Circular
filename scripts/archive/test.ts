import { db } from "./src/db"; db.query("SELECT a_id, a_name, a_role, a_agency_id FROM admin WHERE a_name = \"jojosan24\"").then(r => console.log(r.rows)).finally(() => process.exit(0))
