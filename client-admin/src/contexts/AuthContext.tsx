import { createContext, useContext, useState, ReactNode } from 'react'

export interface AdminUser {
  token: string;
  id: string;
  name: string;
  permiss: string;
  role: string;
}

interface AuthContextType {
  admin: AdminUser | null;
  login: (token: string, id: string, name: string, permiss: string, role?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    const token   = localStorage.getItem('admin_token')
    const id      = localStorage.getItem('admin_id')
    const name    = localStorage.getItem('admin_name')
    const permiss = localStorage.getItem('admin_permiss')
    const role    = localStorage.getItem('admin_role')
    return token && id && name && permiss ? { token, id, name, permiss, role: role || '' } : null
  })

  const login = (token: string, id: string, name: string, permiss: string, role?: string) => {
    localStorage.setItem('admin_token',   token)
    localStorage.setItem('admin_id',      id)
    localStorage.setItem('admin_name',    name)
    localStorage.setItem('admin_permiss', permiss)
    localStorage.setItem('admin_role',    role || '')
    setAdmin({ token, id, name, permiss, role: role || '' })
  }

  const logout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_id')
    localStorage.removeItem('admin_name')
    localStorage.removeItem('admin_permiss')
    localStorage.removeItem('admin_role')
    setAdmin(null)
  }

  return (
    <AuthContext.Provider value={{ admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
