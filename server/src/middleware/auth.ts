import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set!');
}
export const JWT_SECRET = process.env.JWT_SECRET;

// Valid roles per workflow_design.md Topic 1
export type AdminRole =
  | 'SUPERADMIN'
  | 'COORDINATOR'
  | 'HR_DIRECTOR'
  | 'DIV_DIRECTOR'
  | 'SEC_DIRECTOR'
  | 'GRP_LEADER'
  | 'STAFF'
  | 'SYSTEM_ADMIN';

export interface AdminRequest extends Request {
  admin?: {
    id: number;
    name: string;
    permiss: string;  // legacy field (kept for backward compatibility)
    role?: AdminRole; // new granular role from workflow_design.md
  };
}

/**
 * Middleware: ตรวจสอบ Bearer JWT token
 * ใส่ req.admin = { id, name, permiss, role } เมื่อผ่าน
 */
export const requireAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ status: false, message: 'กรุณาเข้าสู่ระบบ' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
    
    // Validate token version
    if (decoded.token_version !== undefined) {
      const { rows } = await db.query('SELECT a_token_version FROM admin WHERE a_id = $1', [decoded.id]);
      if (rows.length && rows[0].a_token_version !== decoded.token_version) {
        return res.status(401).json({ status: false, message: 'Session expired due to password change' });
      }
    }

    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ status: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
  }
};

/**
 * Middleware: ตรวจสอบว่าเป็น superadmin เท่านั้น (legacy, ใช้ permiss)
 */
export const requireSuperAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ status: false, message: 'กรุณาเข้าสู่ระบบ' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
    if (decoded.permiss !== 'superadmin')
      return res.status(403).json({ status: false, message: 'Permission Not Allowed' });
    
    // Validate token version
    if (decoded.token_version !== undefined) {
      const { rows } = await db.query('SELECT a_token_version FROM admin WHERE a_id = $1', [decoded.id]);
      if (rows.length && rows[0].a_token_version !== decoded.token_version) {
        return res.status(401).json({ status: false, message: 'Session expired due to password change' });
      }
    }

    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ status: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
  }
};

/**
 * Middleware factory: ตรวจสอบว่า role ตรงกับที่กำหนดหรือไม่
 * ใช้กับ workflow routes ใหม่
 *
 * @example router.post('/assign', requireRole(['HR_DIRECTOR', 'DIV_DIRECTOR']), handler)
 */
export const requireRole = (roles: AdminRole[]) =>
  async (req: AdminRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ status: false, message: 'กรุณาเข้าสู่ระบบ' });
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
      const userRole: AdminRole = decoded.role;
      // SUPERADMIN bypasses all role checks
      if (decoded.permiss === 'superadmin' || roles.includes(userRole)) {
        
        // Validate token version
        if (decoded.token_version !== undefined) {
          const { rows } = await db.query('SELECT a_token_version FROM admin WHERE a_id = $1', [decoded.id]);
          if (rows.length && rows[0].a_token_version !== decoded.token_version) {
            return res.status(401).json({ status: false, message: 'Session expired due to password change' });
          }
        }

        req.admin = decoded;
        return next();
      }
      return res.status(403).json({ status: false, message: `ต้องการสิทธิ์: ${roles.join(', ')}` });
    } catch {
      return res.status(401).json({ status: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    }
  };

