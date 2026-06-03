import db from '../config/database.js';
import { AdminRole } from '../middleware/auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ActingAppointment {
  act_id: number;
  user_id: number;
  target_role: AdminRole;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
  appointed_by: number | null;
  reason: string | null;
}

/**
 * The result returned by `resolveEffectiveRole`.
 *
 * - `effectiveRole`  — the role the user actually holds right now
 * - `isActing`       — true when the privilege comes from an appointment,
 *                      not from the user's own profile
 * - `appointment`    — the matching row, present only when isActing === true
 */
export interface EffectiveRoleResult {
  effectiveRole: AdminRole | null;
  isActing: boolean;
  appointment: ActingAppointment | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the effective role for a user, factoring in both their native role
 * (from the JWT/admin record) and any active temporary escalation in
 * `c_acting_appointments`.
 *
 * Resolution order (first match wins):
 *   1. Native role already satisfies the required roles → return immediately,
 *      isActing = false.
 *   2. An active, non-expired appointment whose `target_role` is in the
 *      required roles list → return the acting role, isActing = true.
 *   3. Neither → effectiveRole = null, isActing = false.
 *
 * @param userId       - The admin's primary key (a_id)
 * @param nativeRole   - The role stored in the JWT (`decoded.role`)
 * @param requiredRoles - The roles that grant access to the current endpoint
 */
export async function resolveEffectiveRole(
  userId: number,
  nativeRole: AdminRole | undefined,
  requiredRoles: AdminRole[],
): Promise<EffectiveRoleResult> {
  // 1. Native role check (no DB hit needed)
  if (nativeRole && requiredRoles.includes(nativeRole)) {
    return { effectiveRole: nativeRole, isActing: false, appointment: null };
  }

  // 2. Check for an active acting appointment that satisfies the required roles
  //    The composite index idx_acting_active makes this query very fast.
  const { rows } = await db.query<ActingAppointment>(
    `SELECT act_id, user_id, target_role, start_date, end_date,
            is_active, appointed_by, reason
     FROM   c_acting_appointments
     WHERE  user_id   = $1
       AND  is_active = TRUE
       AND  NOW() BETWEEN start_date AND end_date
       AND  target_role = ANY($2::text[])
     ORDER BY end_date ASC   -- prefer the appointment expiring soonest
     LIMIT  1`,
    [userId, requiredRoles],
  );

  if (rows.length > 0) {
    const appt = rows[0];
    return {
      effectiveRole: appt.target_role as AdminRole,
      isActing: true,
      appointment: appt,
    };
  }

  // 3. No match at all
  return { effectiveRole: null, isActing: false, appointment: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: check a single user/role without knowing the required set
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the user currently holds `targetRole` either natively or
 * through an acting appointment.  Also returns the acting context for callers
 * that need to stamp audit records.
 */
export async function userHasRole(
  userId: number,
  nativeRole: AdminRole | undefined,
  targetRole: AdminRole,
): Promise<EffectiveRoleResult> {
  return resolveEffectiveRole(userId, nativeRole, [targetRole]);
}
