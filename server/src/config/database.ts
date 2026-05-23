import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

if (!process.env.DB_PASSWORD) {
  console.error('❌ Database Connection Error: DB_PASSWORD environment variable is not set!');
  process.exit(1);
}

const pool = new Pool({
  host:                process.env.DB_HOST     || 'localhost',
  user:                process.env.DB_USER     || 'postgres',
  password:            process.env.DB_PASSWORD,
  database:            process.env.DB_NAME     || 'circular',
  port:                parseInt(process.env.DB_PORT     || '5432'),
  max:                 parseInt(process.env.DB_MAX_CONN || '10'),
  idleTimeoutMillis:   parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: 5000,
});

pool.connect((err, _client, release) => {
  if (err) {
    console.error('❌ PostgreSQL Error:', err.message);
  } else if (release) {
    console.log(`✅ PostgreSQL connected → database: "${process.env.DB_NAME || 'circular'}"`);
    release();
  }
});

export default pool;
