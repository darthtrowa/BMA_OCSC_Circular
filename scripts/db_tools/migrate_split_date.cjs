const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: '1956wine', host: 'localhost', database: 'circular' });

async function run() {
  await client.connect();

  // Step 1: Add new column
  await client.query('ALTER TABLE c_information ADD COLUMN IF NOT EXISTS in_doc_date character varying(255)');
  console.log('✅ Column in_doc_date added');

  // Step 2: Migrate data - split "ลงวันที่" from in_num_date
  const { rows } = await client.query('SELECT in_id, in_num_date FROM c_information WHERE in_num_date IS NOT NULL');
  console.log(`📦 Found ${rows.length} rows to process`);

  let updated = 0;
  for (const row of rows) {
    const original = row.in_num_date || '';
    // Pattern: "นร 1013/ว 36 ลงวันที่ 10 ตุลาคม 2568"
    const match = original.match(/^(.*?)\s*ลงวันที่\s*(.+)$/);
    if (match) {
      const docNum = match[1].trim();
      const docDate = match[2].trim();
      await client.query('UPDATE c_information SET in_num_date = $1, in_doc_date = $2 WHERE in_id = $3', [docNum, docDate, row.in_id]);
      console.log(`  ✏️ [${row.in_id}] "${docNum}" | "${docDate}"`);
      updated++;
    }
  }

  console.log(`✅ Migration complete. Updated ${updated}/${rows.length} rows.`);
  await client.end();
}

run().catch(err => { console.error(err); process.exit(1); });
