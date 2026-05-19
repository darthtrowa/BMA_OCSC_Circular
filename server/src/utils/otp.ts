/**
 * utils/otp.ts
 * OTP generation and hashing utilities for 2FA.
 *
 * Security strategy:
 *  - Generate a cryptographically random 6-digit code
 *  - Hash it with bcrypt before storing in DB (same approach as passwords)
 *  - Compare plain OTP against stored hash at verification time
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const OTP_EXPIRY_MIN = parseInt(process.env.OTP_EXPIRY_MIN || '5', 10);

/**
 * Generate a cryptographically random 6-digit OTP.
 * Uses crypto.randomInt for uniform distribution (no modulo bias).
 */
export function generateOtp(): string {
  const code = crypto.randomInt(100000, 999999); // always 6 digits
  return String(code);
}

/**
 * Hash an OTP with bcrypt (cost factor 8 — fast enough for OTPs).
 */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 8);
}

/**
 * Compare a plain-text OTP against its stored bcrypt hash.
 */
export async function verifyOtp(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed).catch(() => false);
}

/**
 * Return the DateTime (in UTC) when this OTP should expire.
 */
export function otpExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + OTP_EXPIRY_MIN);
  return d;
}

/**
 * Mask an email address for display: "user@bma.go.th" → "u***@bma.go.th"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || local.length <= 1) return email;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 1, 4))}@${domain}`;
}
