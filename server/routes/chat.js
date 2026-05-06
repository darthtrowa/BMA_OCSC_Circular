/**
 * routes/chat.js — AI Chat via OpenClaw WebSocket Gateway
 * POST /chat   → ส่งข้อความ รับคำตอบจาก AI
 * GET  /chat/ping → ตรวจสอบการเชื่อมต่อ
 */
const router             = require('express').Router()
const WebSocket          = require('ws')
const { randomUUID }     = require('crypto')

const OPENCLAW_HOST  = process.env.OPENCLAW_HOST  || '127.0.0.1'
const OPENCLAW_PORT  = parseInt(process.env.OPENCLAW_PORT || '18789')
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN  || ''
const TIMEOUT_MS     = 120_000

// ─── OpenClaw WebSocket connection ────────────────────────────
function openClawConnect() {
  return new Promise((resolve, reject) => {
    const ws      = new WebSocket(`ws://${OPENCLAW_HOST}:${OPENCLAW_PORT}`, { handshakeTimeout: 6000 })
    const pending = new Map()

    const send    = (obj) => ws.send(JSON.stringify(obj))
    const request = (method, params) => new Promise((res, rej) => {
      const id = randomUUID()
      pending.set(id, { res, rej })
      send({ type: 'req', id, method, params })
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout: ' + method)) } }, 15_000)
    })

    ws.on('message', raw => {
      let f; try { f = JSON.parse(raw.toString()) } catch { return }
      if (f.type === 'res' && f.id && pending.has(f.id)) {
        const { res, rej } = pending.get(f.id)
        pending.delete(f.id)
        f.ok !== false ? res(f.payload ?? f.result ?? f) : rej(new Error(f.payload?.error?.message || JSON.stringify(f)))
        return
      }
      ws.emit('oc-event', f)
    })

    ws.on('error', reject)
    ws.on('close', () => { for (const { rej } of pending.values()) rej(new Error('WebSocket closed')); pending.clear() })
    ws.on('open', async () => {
      try {
        await new Promise(r => setTimeout(r, 300))
        await request('connect', {
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'gateway-client', displayName: 'Circular Web UI', mode: 'backend', version: '1.0.0', platform: 'node' },
          caps: [], auth: { token: OPENCLAW_TOKEN }, role: 'operator', scopes: ['operator.read', 'operator.write'],
        })
        resolve({ ws, request })
      } catch (e) { ws.close(); reject(e) }
    })
  })
}

// ─────────────────────────────────────────────────────────────
// GET /chat/ping
// ─────────────────────────────────────────────────────────────
router.get('/ping', async (req, res) => {
  try {
    const { ws } = await openClawConnect()
    ws.close()
    return res.json({ ok: true, message: 'OpenClaw connected' })
  } catch (e) {
    return res.status(503).json({ ok: false, error: e.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /chat
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { message, sessionKey: existingKey } = req.body
  if (!message?.trim()) return res.status(400).json({ status: false, message: 'กรุณาส่งข้อความ' })

  let conn
  try {
    conn = await openClawConnect()
  } catch (e) {
    return res.status(502).json({ status: false, message: 'เชื่อมต่อ AI ไม่ได้: ' + e.message })
  }

  const { ws, request } = conn
  const chunks = []
  let replied  = false

  const finish = (ok, text, extra = {}) => {
    if (replied) return
    replied = true
    clearTimeout(tid)
    ws.close()
    ok ? res.json({ status: true, response: text, ...extra })
       : res.status(502).json({ status: false, message: text })
  }

  const tid = setTimeout(() => {
    const partial = chunks.join('').trim()
    finish(!!partial, partial || `AI ไม่ตอบภายใน ${TIMEOUT_MS / 1000} วินาที`)
  }, TIMEOUT_MS)

  // สร้าง / ใช้ session เดิม
  let sessionKey = existingKey
  if (!sessionKey) {
    try {
      const sess = await request('sessions.create', { agentId: 'main' })
      sessionKey = sess.key || sess.sessionKey
    } catch (e) {
      return finish(false, 'สร้าง session ไม่ได้: ' + e.message)
    }
  }

  try { await request('sessions.messages.subscribe', { key: sessionKey }) } catch {}

  ws.on('oc-event', f => {
    const event = f.event || '', payload = f.payload || {}
    if (event === 'chat') {
      if (payload.state === 'final' && payload.message?.content) {
        const parts = Array.isArray(payload.message.content) ? payload.message.content : []
        const text  = parts.filter(p => p.type === 'text').map(p => p.text).join('').trim()
        if (text) finish(true, text, { sessionKey })
      }
      return
    }
    if (event === 'agent' && payload.stream === 'assistant') {
      const text = payload.data?.text ?? payload.data?.delta ?? null
      if (text) chunks.push(String(text))
      return
    }
    if (event === 'agent' && payload.stream === 'lifecycle' && payload.data?.phase === 'end') {
      const acc = chunks.join('').trim()
      if (acc && !replied) finish(true, acc, { sessionKey })
    }
  })

  ws.on('close', () => {
    const full = chunks.join('').trim()
    if (full)          finish(true, full, { sessionKey })
    else if (!replied) finish(false, 'OpenClaw ปิดการเชื่อมต่อโดยไม่มีคำตอบ')
  })

  try {
    const result = await request('chat.send', {
      sessionKey,
      idempotencyKey: randomUUID(),
      message: message.trim(),
    })
    const text = result?.message?.content ?? result?.content ?? result?.text ?? null
    if (text) finish(true, String(text).trim(), { sessionKey })
  } catch (e) {
    if (!replied) finish(false, 'ส่งข้อความไม่ได้: ' + e.message)
  }
})

module.exports = router
