const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'L^opNlkilogmL'

/**
 * Middleware: ตรวจสอบ Bearer JWT token
 * ใส่ req.admin = { id, name, permiss } เมื่อผ่าน
 */
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ status: false, message: 'กรุณาเข้าสู่ระบบ' })
  try {
    req.admin = jwt.verify(authHeader.split(' ')[1], JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ status: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' })
  }
}

/**
 * Middleware: ตรวจสอบว่าเป็น superadmin เท่านั้น
 */
const requireSuperAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ status: false, message: 'กรุณาเข้าสู่ระบบ' })
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET)
    if (decoded.permiss !== 'superadmin')
      return res.status(403).json({ status: false, message: 'Permission Not Allowed' })
    req.admin = decoded
    next()
  } catch {
    return res.status(401).json({ status: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' })
  }
}

module.exports = { requireAdmin, requireSuperAdmin, JWT_SECRET }
