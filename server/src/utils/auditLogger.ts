import pool from '../config/database.js';

export interface AuditLogData {
  userId: number | null;
  userName: string | null;
  action: string;
  targetResource: string | null;
  targetId: string | null;
  payload: any;
  ipAddress: string | null;
  userAgent: string | null;
  /** Set to true when the action was performed under an acting appointment */
  isActing?: boolean;
  /** 'SELF' = ลงนามในนามตนเอง, 'ACTING' = ลงนามในฐานะรักษาการ */
  approval_context?: 'SELF' | 'ACTING';
  /** FK ไปยัง c_workflow_delegations.delegation_id (เฉพาะเมื่อ approval_context = 'ACTING') */
  delegation_id?: number | null;
}

/**
 * Redacts sensitive information (like passwords) from a payload before saving.
 */
function redactPayload(payload: any): any {
  if (!payload) return null;
  if (typeof payload !== 'object') return payload;

  const redacted = { ...payload };
  const sensitiveKeys = ['password', 'a_password', 'loginPassword', 'token', 'otp_code'];

  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.includes(key) && redacted[key]) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      // Very basic shallow/deep redaction, mainly we care about the top level keys
      if (!Array.isArray(redacted[key])) {
        redacted[key] = redactPayload(redacted[key]);
      }
    }
  }

  return redacted;
}

/**
 * Saves an audit log to the database.
 * This is designed to be fire-and-forget (non-blocking).
 */
export async function recordAuditLog(data: AuditLogData) {
  try {
    const redactedPayload = redactPayload(data.payload);
    
    await pool.query(
      `INSERT INTO audit_logs 
        (user_id, user_name, action, target_resource, target_id, payload, ip_address, user_agent, is_acting, approval_context, delegation_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        data.userId,
        data.userName,
        data.action,
        data.targetResource,
        data.targetId,
        redactedPayload ? JSON.stringify(redactedPayload) : null,
        data.ipAddress,
        data.userAgent,
        data.isActing ?? false,
        data.approval_context ?? 'SELF',
        data.delegation_id ?? null,
      ]
    );
  } catch (err: any) {
    console.error('❌ Failed to record Audit Log:', err.message);
  }
}
