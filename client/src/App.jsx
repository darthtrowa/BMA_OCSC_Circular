import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import PublicPage from './pages/PublicPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'

function ProtectedRoute({ children }) {
  const { admin } = useAuth()
  return admin ? children : <Navigate to="/admin/login" replace />
}

function GuestRoute({ children }) {
  const { admin } = useAuth()
  return !admin ? children : <Navigate to="/admin/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route
            path="/admin/login"
            element={<GuestRoute><LoginPage /></GuestRoute>}
          />
          <Route
            path="/admin/dashboard"
            element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
