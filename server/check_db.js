const db = require('./config/database');

async function checkData() {
  try {
    const results = await db.query('SELECT * FROM c_results ORDER BY results_id');
    console.log('--- c_results ---');
    console.table(results.rows);
    
    const mati_kk = await db.query('SELECT count(*) FROM c_mati_kk');
    console.log('Total mkk:', mati_kk.rows[0].count);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
