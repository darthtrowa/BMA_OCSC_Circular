import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import PublicPage from './pages/PublicPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

// BP-05: Client-side JWT expiry check
function isTokenExpired(token: string): boolean {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const payload = JSON.parse(jsonPayload);
    return payload.exp * 1000 < Date.now();
  } catch (e) {
    console.error('Token decode error:', e);
    return true;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth()
  if (!admin || isTokenExpired(admin.token)) {
    if (admin) logout() // clear stale session
    return <Navigate to="/admin/login" replace />
  }
  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { admin } = useAuth()
  if (admin && isTokenExpired(admin.token)) return <>{children}</>
  return !admin ? <>{children}</> : <Navigate to="/admin/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/bma_ocsc_circular">
        <Routes>
          <Route path="/" element={<PublicPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
