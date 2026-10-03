/**
 * AuthContext — gestion de l'authentification côté frontend.
 *
 * Ce contexte expose :
 *   - user          : l'utilisateur connecté (null si non connecté)
 *   - isLoading     : vrai pendant la vérification initiale du token
 *   - isAuthenticated : dérivé de user !== null
 *   - login()       : connecte avec username + password
 *   - logout()      : déconnecte et supprime les tokens
 *   - refreshUser() : recharge l'utilisateur depuis /auth/me/ (utile après
 *                     une modification de profil)
 *
 * Les tokens JWT sont stockés dans localStorage.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import api from '../api/client'
import type { LoginPayload, LoginResponse, Utilisateur } from '../types'

interface AuthContextValue {
  user: Utilisateur | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // -------------------------------------------------------------------------
  // Au montage : tenter de récupérer le profil si un token existe
  // -------------------------------------------------------------------------
  useEffect(() => {
    const bootstrap = async () => {
      const access = localStorage.getItem('access_token')
      if (!access) {
        setIsLoading(false)
        return
      }

      try {
        const response = await api.get<Utilisateur>('/auth/me/')
        setUser(response.data)
      } catch {
        // Token invalide ou expiré → nettoyage silencieux
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
  }, [])

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------
  const login = useCallback(async (payload: LoginPayload) => {
    const response = await api.post<LoginResponse>('/auth/login/', payload)
    localStorage.setItem('access_token', response.data.access)
    localStorage.setItem('refresh_token', response.data.refresh)

    const meResponse = await api.get<Utilisateur>('/auth/me/')
    setUser(meResponse.data)
  }, [])

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------
  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token')

    if (refresh) {
      try {
        await api.post('/auth/logout/', { refresh })
      } catch {
        // On ignore les erreurs réseau au logout : le client se déconnecte
        // dans tous les cas.
      }
    }

    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [])

  // -------------------------------------------------------------------------
  // Refresh user (utile après modification de profil)
  // -------------------------------------------------------------------------
  const refreshUser = useCallback(async () => {
    const access = localStorage.getItem('access_token')
    if (!access) return

    try {
      const response = await api.get<Utilisateur>('/auth/me/')
      setUser(response.data)
    } catch (err) {
      // Silencieux : si le token est invalide, l'intercepteur Axios
      // gérera la déconnexion automatique.
      console.error('refreshUser failed', err)
    }
  }, [])

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook pour consommer le contexte
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider')
  }
  return context
}