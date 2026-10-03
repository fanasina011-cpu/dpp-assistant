/**
 * Route protégée.
 *
 * Vérifie que l'utilisateur est authentifié. Si non :
 *   - soit il est en cours de vérification (isLoading) → afficher un loader,
 *   - soit il n'est pas connecté → rediriger vers /login.
 *
 * Utilisation dans App.tsx :
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 */

import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">Chargement...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}