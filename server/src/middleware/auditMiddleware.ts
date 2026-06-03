import { Response, NextFunction } from 'express';
import { AdminRequest } from './auth.js';
import { recordAuditLog } from '../utils/auditLogger.js';

/**
 * Middleware to intercept API requests and record them as audit logs.
 */
export const auditMiddleware = (req: AdminRequest, res: Response, next: NextFunction) => {
  // We only want to log mutating actions (POST, PUT, PATCH, DELETE)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Intercept the response to log only if successful, or log immediately?
    // Usually we want to log the intent regardless, or only on success.
    // Let's log it immediately to capture the intent.
    
    // Attempt to determine the target resource from the URL
    // e.g. /api/admin/users/5 -> resource: users, targetId: 5
    const pathParts = req.path.split('/').filter(Boolean);
    let targetResource = pathParts[0] || 'unknown'; // if mapped to /api/admin/*, first part is the resource
    let targetId = req.params?.id || pathParts[1] || null;
    
    // For specific known paths
    if (pathParts[0] === 'circular') targetResource = 'circular';
    if (pathParts[0] === 'users') targetResource = 'users';

    // Map HTTP method to action
    let action = 'UNKNOWN';
    if (req.method === 'POST') action = 'CREATE';
    if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE';
    if (req.method === 'DELETE') action = 'DELETE';
    
    // Special case for login/auth routes
    if (req.path.includes('/auth/')) {
      action = 'LOGIN/AUTH';
      targetResource = 'auth';
    }

    recordAuditLog({
      userId: req.admin?.id || null,
      userName: req.admin?.name || null,
      action: action,
      targetResource: targetResource,
      targetId: (targetId as string) || null,
      payload: req.body,
      ipAddress: (req.ip as string) || (req.socket.remoteAddress as string) || null,
      userAgent: (req.headers['user-agent'] as string) || null
    });
  }

  next();
};
