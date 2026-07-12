import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  user: 'root',
  host: 'localhost',
  database: 'circular_db',
  password: 'root',
  port: 5432,
});

pool.query("SELECT a_username, a_permiss, a_role FROM admin WHERE a_username='admincsc01'", (err, res) => {
  if (err) {
    console.error(err);
  } else {
    console.log(res.rows);
  }
  pool.end();
});
