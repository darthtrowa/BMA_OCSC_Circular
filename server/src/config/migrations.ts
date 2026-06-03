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
        ADD COLUMN IF NOT EXISTS ag_code      VARCHAR(50)  DEFAULT NULL;
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
    console.log('✅ Audit Logging tables ensured');

    console.log('🎉 Database migrations completed successfully.');
  } catch (e: any) {
    console.error('❌ Database migration failed:', e.message);
    // STAB-02: If migrations fail, we should probably throw to prevent server start,
    // but for safety/backward compatibility in dev, we just log it for now.
    throw e;
  }
}
