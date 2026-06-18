import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

console.log("==========================================================");
console.log("   BMA OCSC Circular - Database Diagnostic & Setup Tool");
console.log("   Target OS: Windows Server 2019 (Native)");
console.log("==========================================================\n");

// Configuration details
const dbConfig = {
  host:                process.env.DB_HOST     || 'localhost',
  user:                process.env.DB_USER     || 'postgres',
  password:            process.env.DB_PASSWORD,
  database:            process.env.DB_NAME     || 'ocsc_circular',
  port:                parseInt(process.env.DB_PORT     || '5432'),
  connectionTimeoutMillis: 5000,
};

console.log("Loaded configuration from .env:");
console.log(` - Host:      ${dbConfig.host}`);
console.log(` - Port:      ${dbConfig.port}`);
console.log(` - User:      ${dbConfig.user}`);
console.log(` - DB Name:   ${dbConfig.database}`);
console.log(` - Password:  ${dbConfig.password ? "[SET] (Length: " + dbConfig.password.length + ")" : "[NOT SET] ⚠️"}`);

if (!dbConfig.password) {
  console.error("\n❌ Error: DB_PASSWORD is not configured in your .env file!");
  console.error("Please add DB_PASSWORD to server/.env before continuing.");
  process.exit(1);
}

async function runDiagnostics() {
  const pool = new Pool(dbConfig);
  
  console.log(`\n1. Testing connection to database "${dbConfig.database}"...`);
  
  try {
    const client = await pool.connect();
    console.log("   ✅ Connection Successful!");
    
    // Check version
    const versionRes = await client.query("SELECT version()");
    console.log(`   PostgreSQL Version: ${versionRes.rows[0].version}`);
    
    // Check tables
    console.log("\n2. Listing tables in the database:");
    const tablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    
    if (tablesRes.rows.length === 0) {
      console.log("   ℹ️ Database is empty (no tables found).");
      console.log("   Tip: Start the server (npx pm2 start ecosystem.config.js) to run migrations.");
    } else {
      console.log(`   Found ${tablesRes.rows.length} tables:`);
      tablesRes.rows.forEach(row => {
        console.log(`    - ${row.table_name}`);
      });
    }
    
    client.release();
    await pool.end();
    console.log("\n🎉 Database is fully functional and ready!");
    process.exit(0);
    
  } catch (err) {
    console.error("   ❌ Connection Failed!");
    console.error(`   Error Code:    ${err.code || 'N/A'}`);
    console.error(`   Error Message: ${err.message}`);
    
    await pool.end();
    
    // If database does not exist (Error Code 3D000)
    if (err.code === '3D000') {
      console.log(`\n3. [Action Required] Database "${dbConfig.database}" does not exist.`);
      await handleMissingDatabase();
    } else {
      printDebuggingTips(err);
      process.exit(1);
    }
  }
}

async function handleMissingDatabase() {
  console.log("   Attempting to connect to 'postgres' system database to create it...");
  
  const systemPool = new Pool({
    ...dbConfig,
    database: 'postgres',
  });
  
  try {
    const systemClient = await systemPool.connect();
    console.log("   ✅ Connected to 'postgres' system database.");
    console.log(`   Creating database "${dbConfig.database}"...`);
    
    await systemClient.query(`CREATE DATABASE "${dbConfig.database}"`);
    console.log(`   ✅ Database "${dbConfig.database}" created successfully!`);
    
    systemClient.release();
    await systemPool.end();
    
    console.log("\nRe-running diagnostics on the new database...");
    await runDiagnostics();
    
  } catch (sysErr) {
    console.error("   ❌ Failed to create database!");
    console.error(`   Error Message: ${sysErr.message}`);
    await systemPool.end();
    process.exit(1);
  }
}

function printDebuggingTips(err) {
  console.log("\n==========================================================");
  console.log("🔧 Windows Server 2019 - Troubleshooting Guide:");
  console.log("==========================================================");
  
  if (err.code === '28P01') {
    console.log(" - Password Authentication Failed (Error 28P01):");
    console.log("   Please check if DB_USER and DB_PASSWORD are correct in server/.env.");
  } else if (err.code === 'ECONNREFUSED' || err.message.includes('ENOTFOUND')) {
    console.log(" - Connection Refused / Host Not Found:");
    console.log("   1. Verify if the PostgreSQL service is running on the target machine.");
    console.log("      Run 'services.msc' and ensure PostgreSQL is 'Running'.");
    console.log("   2. Verify that the host address and port are correct.");
    console.log("   3. Check Windows Defender Firewall (Inbound Rules) and verify");
    console.log("      that port 5432 (or your custom port) is open to the network.");
  } else {
    console.log(" - Generic Connection Mismatch:");
    console.log("   1. Verify postgresql.conf has 'listen_addresses = *' set.");
    console.log("   2. Verify pg_hba.conf permits connections from your subnet.");
  }
  console.log("==========================================================\n");
}

runDiagnostics();
