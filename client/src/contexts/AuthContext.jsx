import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    const token   = localStorage.getItem('admin_token')
    const name    = localStorage.getItem('admin_name')
    const permiss = localStorage.getItem('admin_permiss')
    return token ? { token, name, permiss } : null
  })

  const login = (token, name, permiss) => {
    localStorage.setItem('admin_token',   token)
    localStorage.setItem('admin_name',    name)
    localStorage.setItem('admin_permiss', permiss)
    setAdmin({ token, name, permiss })
  }

  const logout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    localStorage.removeItem('admin_permiss')
    setAdmin(null)
  }

  return (
    <AuthContext.Provider value={{ admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
