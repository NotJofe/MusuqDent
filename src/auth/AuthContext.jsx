import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { getConfig } from '../config.js'
import { fetchUserInfo, hasRequiredScopes, revokeToken } from './google.js'

const SESSION_KEY = 'musuqdent.session'
const AuthContext = createContext(null)

function readSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    if (s?.mode === 'google' && s.expiresAt < Date.now()) return null
    return s
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession)
  const [notice, setNotice] = useState('')

  const store = useCallback((s) => {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(SESSION_KEY)
    setSession(s)
  }, [])

  /** Completa el inicio de sesión con la respuesta del cliente de tokens de Google. */
  const loginWithGoogle = useCallback(async (tokenResponse) => {
    if (!hasRequiredScopes(tokenResponse)) {
      throw new Error('Debes aceptar el permiso de Google Sheets para usar MusuqDent.')
    }
    const info = await fetchUserInfo(tokenResponse.access_token)
    const email = String(info.email || '').toLowerCase()
    const { allowedEmails } = getConfig()
    if (allowedEmails.length && !allowedEmails.includes(email)) {
      revokeToken(tokenResponse.access_token)
      throw new Error(`La cuenta ${email} no está autorizada para ingresar a MusuqDent.`)
    }
    setNotice('')
    store({
      mode: 'google',
      token: tokenResponse.access_token,
      // margen de 1 minuto antes de que expire el token
      expiresAt: Date.now() + (Number(tokenResponse.expires_in) - 60) * 1000,
      user: { email, name: info.name || email, picture: info.picture || '' },
    })
  }, [store])

  const loginDemo = useCallback(() => {
    setNotice('')
    store({ mode: 'demo', user: { email: 'demo@musuqdent', name: 'Usuario demo', picture: '' } })
  }, [store])

  const logout = useCallback((message = '') => {
    const s = readSession()
    if (s?.mode === 'google') revokeToken(s.token)
    setNotice(message)
    store(null)
  }, [store])

  const getToken = useCallback(() => {
    const s = readSession()
    return s?.token ?? ''
  }, [])

  const value = useMemo(
    () => ({ session, user: session?.user, notice, loginWithGoogle, loginDemo, logout, getToken }),
    [session, notice, loginWithGoogle, loginDemo, logout, getToken],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
