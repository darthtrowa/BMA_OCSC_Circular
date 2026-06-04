/**
 * migrate_workflow_engine.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Database Migration: Dynamic Workflow Engine Tables
 *
 * Creates/migrates the following tables:
 *   1. c_workflow_delegations   — Acting-role appointment (may already exist; adds order_number)
 *   2. c_workflow_inbox         — Per-user actionable inbox for circulars
 *   3. workflow_templates       — Named, versioned workflow definitions
 *   4. workflow_nodes           — Visual graph nodes (steps) for a template
 *   5. workflow_edges           — Directed graph edges (transitions) between nodes
 *
 * Usage:  node migrate_workflow_engine.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 */
'use strict';

const pkg = require('pg');
require('dotenv').config();

const { Pool } = pkg;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME     || 'circular',
  port:     parseInt(process.env.DB_PORT || '5432'),
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* ── 1. c_workflow_delegations ─────────────────────────────────────────
       This table may already exist from migrate_workflow.cjs.
       We use IF NOT EXISTS + ADD COLUMN IF NOT EXISTS to be idempotent.      */
    console.log('[1/5] Ensuring c_workflow_delegations schema...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS c_workflow_delegations (
        delegation_id   SERIAL PRIMARY KEY,
        assigner_id     INTEGER NOT NULL REFERENCES admin(a_id) ON DELETE CASCADE,
        assignee_id     INTEGER NOT NULL REFERENCES admin(a_id) ON DELETE CASCADE,
        delegated_role  VARCHAR(50) NOT NULL,
        order_number    INTEGER NOT NULL DEFAULT 1,
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        notes           TEXT,
        created_by      INTEGER REFERENCES admin(a_id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_delegation_assigner_assignee UNIQUE (assigner_id, assignee_id),
        CONSTRAINT chk_delegation_no_self CHECK (assigner_id <> assignee_id)
      );
    `);

    await client.query(`
      ALTER TABLE c_workflow_delegations
        ADD COLUMN IF NOT EXISTS order_number INTEGER NOT NULL DEFAULT 1;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wf_del_assignee_active
        ON c_workflow_delegations (assignee_id, is_active);
    `);

    /* ── 2. c_workflow_inbox ─────────────────────────────────────────────── */
    console.log('[2/5] Creating c_workflow_inbox...');

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_assigned_as') THEN
          CREATE TYPE workflow_assigned_as AS ENUM ('SELF', 'ACTING');
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_inbox_status') THEN
          CREATE TYPE workflow_inbox_status AS ENUM (
            'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'DELEGATED', 'RECALLED'
          );
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS c_workflow_inbox (
        inbox_id          SERIAL PRIMARY KEY,
        circular_id       INTEGER NOT NULL REFERENCES c_information(in_id) ON DELETE CASCADE,
        current_owner_id  INTEGER NOT NULL REFERENCES admin(a_id) ON DELETE CASCADE,
        assigned_as       VARCHAR(50) NOT NULL DEFAULT 'SELF',
        from_stage        VARCHAR(100),
        status            VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Alter table to add columns if table already existed (e.g. from previous migration)
    await client.query(`
      ALTER TABLE c_workflow_inbox 
        ADD COLUMN IF NOT EXISTS from_stage VARCHAR(100),
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wf_inbox_owner_status
        ON c_workflow_inbox (current_owner_id, status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wf_inbox_circular
        ON c_workflow_inbox (circular_id, status);
    `);

    /* ── 3. workflow_templates ───────────────────────────────────────────── */
    console.log('[3/5] Creating workflow_templates...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        template_id   SERIAL PRIMARY KEY,
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_by    INTEGER REFERENCES admin(a_id),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_wf_template_name UNIQUE (name)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wf_template_active
        ON workflow_templates (is_active, created_at DESC);
    `);

    /* ── 4. workflow_nodes ───────────────────────────────────────────────── */
    console.log('[4/5] Creating workflow_nodes...');
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wf_assignee_type') THEN
          CREATE TYPE wf_assignee_type AS ENUM ('USER', 'ROLE', 'AGENCY_HIERARCHY');
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_nodes (
        node_id           SERIAL PRIMARY KEY,
        template_id       INTEGER NOT NULL REFERENCES workflow_templates(template_id) ON DELETE CASCADE,
        step_name         VARCHAR(255) NOT NULL,
        assignee_type     wf_assignee_type NOT NULL DEFAULT 'ROLE',
        target_role       VARCHAR(50),
        target_agency_id  INTEGER REFERENCES c_agency(ag_id) ON DELETE SET NULL,
        target_user_id    INTEGER REFERENCES admin(a_id) ON DELETE SET NULL,
        ui_pos_x          FLOAT NOT NULL DEFAULT 0,
        ui_pos_y          FLOAT NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wf_nodes_template
        ON workflow_nodes (template_id);
    `);

    /* ── 5. workflow_edges ───────────────────────────────────────────────── */
    console.log('[5/5] Creating workflow_edges...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_edges (
        edge_id           SERIAL PRIMARY KEY,
        template_id       INTEGER NOT NULL REFERENCES workflow_templates(template_id) ON DELETE CASCADE,
        source_node_id    INTEGER NOT NULL REFERENCES workflow_nodes(node_id) ON DELETE CASCADE,
        target_node_id    INTEGER NOT NULL REFERENCES workflow_nodes(node_id) ON DELETE CASCADE,
        condition_value   VARCHAR(100),
        CONSTRAINT uq_wf_edge UNIQUE (template_id, source_node_id, target_node_id, condition_value),
        CONSTRAINT chk_wf_edge_no_loop CHECK (source_node_id <> target_node_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wf_edges_template
        ON workflow_edges (template_id);
    `);

    await client.query('COMMIT');
    console.log('\n✅ Workflow Engine Migration completed successfully.');
    console.log('   Created: c_workflow_inbox, workflow_templates, workflow_nodes, workflow_edges');
    console.log('   Updated: c_workflow_delegations (added order_number column if missing)\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed — rolled back:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
