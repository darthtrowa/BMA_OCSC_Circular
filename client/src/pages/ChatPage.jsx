import { useState, useEffect, useRef } from 'react'
import { publicApi } from '../api/apiService'
import Swal from 'sweetalert2'

export default function ChatPage() {
  const [messages, setMessages]     = useState([
    { role: 'assistant', text: 'สวัสดีครับ! ผมคือผู้ช่วย AI สำหรับระบบหนังสือเวียน ก.พ. กทม. มีอะไรให้ช่วยไหมครับ?' }
  ])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [sessionKey, setSessionKey] = useState(null)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)
    try {
      const data = await publicApi.chat(userMsg, sessionKey)
      if (data.status) {
        setSessionKey(data.sessionKey)
        setMessages(prev => [...prev, { role: 'assistant', text: data.response }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: '❌ ' + data.message, error: true }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: '❌ เกิดข้อผิดพลาดในการเชื่อมต่อ', error: true }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-page d-flex flex-column min-vh-100">
      <div className="chat-header bg-success text-white px-4 py-3 d-flex align-items-center">
        <a href="/" className="btn btn-sm btn-outline-light me-3">
          <i className='bx bx-arrow-back'></i>
        </a>
        <i className='bx bx-bot fs-4 me-2'></i>
        <div>
          <div className="fw-bold">ผู้ช่วย AI — BMA Circular</div>
          <small className="opacity-75">พร้อมตอบคำถามเกี่ยวกับหนังสือเวียน ก.พ.</small>
        </div>
        <div className="ms-auto">
          <span className="badge bg-light text-success">
            <i className='bx bxs-circle me-1' style={{ fontSize: '0.6rem' }}></i>Online
          </span>
        </div>
      </div>

      <div className="chat-messages flex-grow-1 overflow-auto p-4" style={{ background: '#f8f9fa' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`d-flex mb-3 ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
            {msg.role === 'assistant' && (
              <div className="chat-avatar bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-2"
                style={{ width: 36, height: 36, flexShrink: 0 }}>
                <i className='bx bx-bot'></i>
              </div>
            )}
            <div
              className={`chat-bubble p-3 rounded-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-white'
                  : msg.error ? 'bg-danger text-white' : 'bg-white border'
              }`}
              style={{ maxWidth: '75%', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="d-flex justify-content-start mb-3">
            <div className="chat-avatar bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-2"
              style={{ width: 36, height: 36, flexShrink: 0 }}>
              <i className='bx bx-bot'></i>
            </div>
            <div className="chat-bubble bg-white border p-3 rounded-3">
              <span className="typing-dots">
                <span></span><span></span><span></span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input border-top bg-white p-3">
        <form onSubmit={sendMessage} className="d-flex gap-2">
          <input
            type="text"
            className="form-control"
            placeholder="พิมพ์ข้อความ..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button type="submit" className="btn btn-success px-4" disabled={loading || !input.trim()}>
            <i className='bx bx-send'></i>
          </button>
        </form>
      </div>
    </div>
  )
}
