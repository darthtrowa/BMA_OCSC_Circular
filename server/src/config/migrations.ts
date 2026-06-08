import db from './database.js';

/**
 * STAB-02: Dedicated module for all database schema migrations.
 * This runs synchronously before the server starts accepting requests
 * to prevent race conditions and ensure DB integrity.
 */
export async function runMigrations() {
  console.log('⏳ Running database migrations...');
  
  try {
    // 1. Ensure in_qr_link column exists
    await db.query(`ALTER TABLE c_information ADD COLUMN IF NOT EXISTS in_qr_link VARCHAR(1000) DEFAULT '-';`);
    console.log('✅ Column in_qr_link ensured');

    // 2. Ensure auth/security columns exist
    await db.query(`ALTER TABLE admin ADD COLUMN IF NOT EXISTS a_token_version INT DEFAULT 1;`);
    console.log('✅ Column a_token_version ensured');
    await db.query(`ALTER TABLE admin ADD COLUMN IF NOT EXISTS a_otp_attempts INT DEFAULT 0;`);
    console.log('✅ Column a_otp_attempts ensured');

    // 3. Agency Tree Migration
    await db.query(`
      ALTER TABLE c_agency
        ADD COLUMN IF NOT EXISTS parent_ag_id INT REFERENCES c_agency(ag_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS ag_status    VARCHAR(20)  DEFAULT 'active' NOT NULL,
        ADD COLUMN IF NOT EXISTS ag_code      VARCHAR(50)  DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS ag_type      VARCHAR(20)  DEFAULT 'AGENCY' NOT NULL,
        ADD COLUMN IF NOT EXISTS ag_role      VARCHAR(50)  DEFAULT NULL;
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_agency_parent ON c_agency(parent_ag_id);`);
    await db.query(`ALTER TABLE admin ADD COLUMN IF NOT EXISTS a_agency_id INT REFERENCES c_agency(ag_id) ON DELETE SET NULL;`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_admin_agency_id ON admin(a_agency_id);`);
    console.log('✅ Agency tree columns ensured');

    // 4. Parallel Workflow Migration
    await db.query(`ALTER TABLE c_information ADD COLUMN IF NOT EXISTS in_is_parallel BOOLEAN DEFAULT FALSE;`);
    await db.query(`ALTER TABLE c_information ADD COLUMN IF NOT EXISTS in_parallel_batch_id UUID;`);
    
    await db.query(`ALTER TABLE c_workflow_history ADD COLUMN IF NOT EXISTS pa_id BIGINT REFERENCES c_parallel_assignments(pa_id) ON DELETE SET NULL;`).catch(() => {
      // c_parallel_assignments may not exist yet, will retry after table creation
    });
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS c_parallel_assignments (
        pa_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        in_id              INT NOT NULL REFERENCES c_information(in_id) ON DELETE CASCADE,
        batch_id           UUID NOT NULL,
        ag_id              INT REFERENCES c_agency(ag_id),
        ag_name            VARCHAR(500),
        initial_owner_id   INT REFERENCES admin(a_id),
        current_owner_id   INT REFERENCES admin(a_id),
        pa_status          VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        result_comments    TEXT,
        assigned_by        INT REFERENCES admin(a_id),
        hr_director_id     INT REFERENCES admin(a_id),
        created_at         TIMESTAMPTZ DEFAULT NOW(),
        updated_at         TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    await db.query(`CREATE INDEX IF NOT EXISTS idx_pa_in_id    ON c_parallel_assignments(in_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_pa_batch_id ON c_parallel_assignments(batch_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_pa_owner    ON c_parallel_assignments(current_owner_id);`);
    
    // Retry adding pa_id FK now that table exists
    await db.query(`ALTER TABLE c_workflow_history ADD COLUMN IF NOT EXISTS pa_id BIGINT REFERENCES c_parallel_assignments(pa_id) ON DELETE SET NULL;`);
    console.log('✅ Parallel workflow tables ensured');

    // 5. Tableau Monitoring Metrics Migration
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        timestamp             TIMESTAMPTZ DEFAULT NOW(),
        cpu_usage_percent     FLOAT,
        ram_usage_mb          FLOAT,
        db_response_time_ms   FLOAT,
        db_health             BOOLEAN
      );
    `);
    // Optional: Keep only the last 30 days of metrics to prevent DB bloat (this would typically be a cron job itself)
    // We'll index timestamp for faster Tableau time-series queries
    await db.query(`CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);`);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS cron_job_logs (
        id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        timestamp     TIMESTAMPTZ DEFAULT NOW(),
        job_name      VARCHAR(255) NOT NULL,
        status        VARCHAR(50) NOT NULL,
        duration_ms   INTEGER
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_cron_logs_timestamp ON cron_job_logs(timestamp);`);
    console.log('✅ Tableau Monitoring tables ensured');

    // 6. Audit Logging System
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id           INT REFERENCES admin(a_id) ON DELETE SET NULL,
        user_name         VARCHAR(255),
        action            VARCHAR(50) NOT NULL,
        target_resource   VARCHAR(255),
        target_id         VARCHAR(255),
        payload           JSONB,
        ip_address        VARCHAR(100),
        user_agent        TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);`);
    // Add is_acting column to audit_logs to tag interim-capacity actions
    await db.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_acting BOOLEAN DEFAULT FALSE;`);
    console.log('✅ Audit Logging tables ensured');

    // 7. Acting Appointments (Temporary Privilege Escalation)
    await db.query(`
      CREATE TABLE IF NOT EXISTS c_acting_appointments (
        act_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

        -- The user whose role is temporarily elevated
        user_id         INT NOT NULL REFERENCES admin(a_id) ON DELETE CASCADE,

        -- The role this user acts AS during the appointment window.
        -- Must be a valid AdminRole value from src/middleware/auth.ts
        target_role     VARCHAR(50) NOT NULL,

        -- Appointment window (inclusive on both ends)
        start_date      TIMESTAMPTZ NOT NULL,
        end_date        TIMESTAMPTZ NOT NULL,

        -- Soft-disable: SUPERADMIN can revoke early without deleting the record
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,

        -- Authorisation audit trail
        appointed_by    INT REFERENCES admin(a_id) ON DELETE SET NULL,
        reason          TEXT,

        -- Standard timestamps
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),

        -- Structural constraint: end must be after start
        CONSTRAINT chk_acting_dates CHECK (end_date > start_date)
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_acting_user_id    ON c_acting_appointments(user_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_acting_active      ON c_acting_appointments(user_id, is_active, start_date, end_date);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_acting_appointed_by ON c_acting_appointments(appointed_by);`);
    console.log('✅ Acting appointments table ensured');

    // 8. Workflow Delegations (Order-based Acting Role Assignment)
    await db.query(`
      CREATE TABLE IF NOT EXISTS c_workflow_delegations (
        delegation_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

        -- ผู้มอบอำนาจ: เจ้าของตำแหน่งจริง (e.g., HR_DIRECTOR ที่ลาหรือตำแหน่งว่าง)
        assigner_id     INT NOT NULL REFERENCES admin(a_id) ON DELETE CASCADE,

        -- ผู้รับมอบอำนาจ: บุคคลที่จะรักษาการแทน (ต้อง role ต่ำกว่า 1 ระดับ)
        assignee_id     INT NOT NULL REFERENCES admin(a_id) ON DELETE CASCADE,

        -- Role ที่ assignee จะได้รับชั่วคราว (ต้องตรงกับ AdminRole ใน auth.ts)
        delegated_role  VARCHAR(50) NOT NULL,



        -- สถานะ: ปิด/เปิดการมอบอำนาจ (ไม่มีวันหมดอายุ — ต้อง toggle เอง)
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,

        -- ผู้บันทึกและหมายเหตุ
        created_by      INT REFERENCES admin(a_id) ON DELETE SET NULL,
        notes           TEXT,

        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),

        -- ป้องกัน assignee รักษาการแทนตัวเอง
        CONSTRAINT chk_delegation_different CHECK (assigner_id != assignee_id)
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_delegation_assignee ON c_workflow_delegations(assignee_id, is_active);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_delegation_assigner ON c_workflow_delegations(assigner_id, is_active);`);
    console.log('✅ Workflow delegations table ensured');

    // 9. Workflow Inbox (Acting context tagging)
    await db.query(`
      CREATE TABLE IF NOT EXISTS c_workflow_inbox (
        inbox_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

        -- หนังสือเวียนที่เชื่อมกับ inbox item นี้
        circular_id      INT NOT NULL REFERENCES c_information(in_id) ON DELETE CASCADE,

        -- ผู้รับผิดชอบปัจจุบัน
        current_owner_id INT NOT NULL REFERENCES admin(a_id) ON DELETE CASCADE,

        -- SELF = งานปกติ / ACTING = งานรักษาการแทน
        assigned_as      VARCHAR(10) NOT NULL DEFAULT 'SELF'
                         CHECK (assigned_as IN ('SELF', 'ACTING')),

        -- ถ้าเป็น ACTING ให้บันทึก delegation ที่อนุญาต
        delegation_id    BIGINT REFERENCES c_workflow_delegations(delegation_id) ON DELETE SET NULL,

        -- ป้องกัน duplicate
        UNIQUE (circular_id, current_owner_id, assigned_as),

        created_at       TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_inbox_owner ON c_workflow_inbox(current_owner_id, assigned_as);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_inbox_circular ON c_workflow_inbox(circular_id);`);
    console.log('✅ Workflow inbox table ensured');

    // 10. Extend audit_logs for delegation context tracking
    await db.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS approval_context VARCHAR(10) DEFAULT 'SELF';`);
    await db.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS delegation_id BIGINT REFERENCES c_workflow_delegations(delegation_id) ON DELETE SET NULL;`);
    console.log('✅ audit_logs delegation columns ensured');

    // 11. Remove Dynamic Workflow Builder Tables and Columns
    await db.query(`ALTER TABLE c_agency DROP COLUMN IF EXISTS ag_template_id;`);
    await db.query(`ALTER TABLE c_parallel_assignments DROP COLUMN IF EXISTS pa_template_id;`);
    await db.query(`ALTER TABLE c_parallel_assignments DROP COLUMN IF EXISTS pa_active_node_id;`);
    await db.query(`ALTER TABLE c_information DROP COLUMN IF EXISTS in_template_id;`);
    await db.query(`ALTER TABLE c_information DROP COLUMN IF EXISTS in_active_node_id;`);
    await db.query(`DROP TABLE IF EXISTS workflow_edges CASCADE;`);
    await db.query(`DROP TABLE IF EXISTS workflow_nodes CASCADE;`);
    await db.query(`DROP TABLE IF EXISTS workflow_templates CASCADE;`);
    await db.query(`DROP TYPE IF EXISTS wf_assignee_type CASCADE;`).catch(() => {});
    console.log('✅ Dynamic Workflow Builder tables and columns removed');

    console.log('🎉 Database migrations completed successfully.');
  } catch (e: any) {
    console.error('❌ Database migration failed:', e.message);
    // STAB-02: If migrations fail, we should probably throw to prevent server start,
    // but for safety/backward compatibility in dev, we just log it for now.
    throw e;
  }
}
