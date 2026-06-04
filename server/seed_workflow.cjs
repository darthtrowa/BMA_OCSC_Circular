const pkg = require('pg');
require('dotenv').config();

const pool = new pkg.Pool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME     || 'circular',
  port:     parseInt(process.env.DB_PORT || '5432'),
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Template
    const tplRes = await client.query(`
      INSERT INTO workflow_templates (name, description, is_active)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING template_id
    `, ['การพิจารณาหนังสือเวียนสำนักงาน ก.พ. (มาตรฐาน)', 'เส้นทางแสดงการไหลของหนังสือเวียนจากผู้ประสานงาน มอบหมายลงมาถึงเจ้าหน้าที่ และเสนอผลพิจารณากลับขึ้นไปตามลำดับชั้น', true]);
    
    const templateId = tplRes.rows[0].template_id;

    // Clear existing nodes/edges for this template (if re-running)
    await client.query('DELETE FROM workflow_nodes WHERE template_id = $1', [templateId]);

    // 2. Insert Nodes (U-Shape)
    const nodes = [
      // Downward path
      { name: '1. ผู้ประสานงาน (รับเรื่อง)', role: 'COORDINATOR', x: 200, y: 100 },
      { name: '2. ผอ.กอง (พิจารณามอบหมาย)', role: 'HR_DIRECTOR', x: 200, y: 250 },
      { name: '3. ผอ.ส่วน (พิจารณามอบหมาย)', role: 'DIV_DIRECTOR', x: 200, y: 400 },
      { name: '4. หัวหน้าฝ่าย (พิจารณามอบหมาย)', role: 'SEC_DIRECTOR', x: 200, y: 550 },
      { name: '5. หัวหน้ากลุ่ม (พิจารณามอบหมาย)', role: 'GRP_LEADER', x: 200, y: 700 },
      // Bottom execution
      { name: '6. เจ้าหน้าที่ (ดำเนินการ/สรุปผล)', role: 'STAFF', x: 450, y: 850 },
      // Upward path
      { name: '7. หัวหน้ากลุ่ม (ตรวจทาน)', role: 'GRP_LEADER', x: 700, y: 700 },
      { name: '8. หัวหน้าฝ่าย (พิจารณา)', role: 'SEC_DIRECTOR', x: 700, y: 550 },
      { name: '9. ผอ.ส่วน (พิจารณา)', role: 'DIV_DIRECTOR', x: 700, y: 400 },
      { name: '10. ผอ.กอง (อนุมัติ/เกษียน)', role: 'HR_DIRECTOR', x: 700, y: 250 },
    ];

    const insertedNodes = [];
    for (const node of nodes) {
      const res = await client.query(`
        INSERT INTO workflow_nodes (template_id, step_name, assignee_type, target_role, ui_pos_x, ui_pos_y)
        VALUES ($1, $2, 'ROLE', $3, $4, $5)
        RETURNING node_id
      `, [templateId, node.name, node.role, node.x, node.y]);
      insertedNodes.push(res.rows[0].node_id);
    }

    // 3. Insert Edges (Connect them in sequence 1 -> 10)
    for (let i = 0; i < insertedNodes.length - 1; i++) {
      let condition = null;
      if (i < 5) condition = 'มอบหมาย';
      else if (i === 5) condition = 'เสนอผลการพิจารณา';
      else condition = 'เห็นชอบ/ส่งต่อ';

      await client.query(`
        INSERT INTO workflow_edges (template_id, source_node_id, target_node_id, condition_value)
        VALUES ($1, $2, $3, $4)
      `, [templateId, insertedNodes[i], insertedNodes[i+1], condition]);
    }

    await client.query('COMMIT');
    console.log('✅ Successfully seeded OCSC Circular Workflow Template!');
    console.log('Template ID:', templateId);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
