/**
 * Instance Axios configurée pour parler à l'API Django.
 *
 * - URL de base : VITE_API_URL (défaut http://127.0.0.1:8000) + /api/v1
 * - Intercepteur de requête : ajoute automatiquement le token JWT
 *   dans l'en-tête Authorization si présent.
 * - Intercepteur de réponse : tente de rafraîchir le token si l'API
 *   retourne 401 (token expiré).
 */

import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

// L'origine seule est paramétrable ; le préfixe des routes est fixe.
const BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/v1`

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ---------------------------------------------------------------------------
// Intercepteur de requête : ajoute le token d'accès
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const access = localStorage.getItem('access_token')
    if (access && config.headers) {
      config.headers.Authorization = `Bearer ${access}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ---------------------------------------------------------------------------
// Intercepteur de réponse : gère l'expiration du token (401)
// ---------------------------------------------------------------------------

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Ne pas tenter de rafraîchir sur les endpoints d'auth
      if (originalRequest.url?.includes('/auth/login/')) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refresh = localStorage.getItem('refresh_token')

      if (!refresh) {
        isRefreshing = false
        // Pas de refresh token → déconnexion
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh/`, {
          refresh,
        })
        const newAccess = response.data.access
        localStorage.setItem('access_token', newAccess)
        processQueue(null, newAccess)

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`
        }
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default api