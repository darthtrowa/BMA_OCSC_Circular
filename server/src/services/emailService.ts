/**
 * services/emailService.ts
 * Email sender using Nodemailer with SMTP configuration from .env
 * Used for OTP delivery in the 2FA workflow.
 */

import nodemailer from 'nodemailer';

console.log('[Email] Initializing transporter with user:', process.env.SMTP_USER || 'NOT SET');

// ── Build transporter from environment variables ──────────────────────────────
// This is now correctly picking up vars from server/.env
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
      ? (process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false') // default true in production
      : false, // Allow self-signed in development
  },
});

/**
 * Sends a 2FA OTP email to the user.
 * @param to      Recipient email address
 * @param name    User's full name (for personalisation)
 * @param otp     6-digit OTP code (plain text — stored hashed in DB)
 */
export async function sendOtpEmail(to: string, name: string, otp: string): Promise<void> {
  const appName = process.env.APP_NAME || 'ระบบหนังสือเวียน กทม.';
  const fromName = process.env.SMTP_FROM_NAME || appName;
  const fromAddr = process.env.SMTP_USER || '';
  const expiryMin = process.env.OTP_EXPIRY_MIN || '5';

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('[Email] Cannot send email: SMTP credentials missing in environment');
    throw new Error('SMTP credentials missing');
  }

  const html = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#065f46,#059669);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                🔐 รหัสยืนยันตัวตน (OTP)
              </h1>
              <p style="color:#a7f3d0;margin:8px 0 0;font-size:13px;">${appName}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="color:#334155;font-size:15px;margin:0 0 8px;">เรียน คุณ${name}</p>
              <p style="color:#64748b;font-size:14px;margin:0 0 28px;line-height:1.6;">
                ระบบได้รับคำขอเข้าสู่ระบบจากบัญชีของคุณ กรุณาใช้รหัส OTP ด้านล่างนี้เพื่อยืนยันตัวตน
              </p>

              <!-- OTP Box -->
              <div style="background:#f0fdf4;border:2px dashed #6ee7b7;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">รหัสยืนยัน</p>
                <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#065f46;font-family:'Courier New',monospace;">${otp}</span>
                <p style="color:#f59e0b;font-size:12px;font-weight:600;margin:16px 0 0;">
                  ⏱ รหัสนี้จะหมดอายุใน ${expiryMin} นาที
                </p>
              </div>

              <div style="background:#fef9c3;border-left:4px solid #eab308;border-radius:6px;padding:14px 16px;margin-bottom:24px;">
                <p style="color:#713f12;font-size:13px;margin:0;line-height:1.6;">
                  ⚠️ <strong>หากคุณไม่ได้เป็นผู้ขอรหัสนี้</strong> กรุณาแจ้งผู้ดูแลระบบทันที และอย่าเปิดเผยรหัสนี้แก่ผู้อื่นเด็ดขาด
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                อีเมลนี้ส่งโดยอัตโนมัติจาก ${appName} — กรุณาอย่าตอบกลับ
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from:    `"${fromName}" <${fromAddr}>`,
    to,
    subject: `[${appName}] รหัสยืนยันตัวตน OTP ของคุณ`,
    html,
    text:    `รหัส OTP ของคุณคือ: ${otp} (หมดอายุใน ${expiryMin} นาที)`,
  });
}

/**
 * Verify the SMTP connection on startup (optional health-check).
 */
export async function verifySmtpConnection(): Promise<void> {
  if (!process.env.SMTP_USER) return;
  try {
    await transporter.verify();
    console.log('[Email] SMTP connection verified ✅');
  } catch (e) {
    console.warn('[Email] SMTP connection failed:', (e as Error).message);
  }
}
