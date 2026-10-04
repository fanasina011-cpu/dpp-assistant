/**
 * Page de connexion v2 — split-screen moderne avec branding.
 */

import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login({ username, password })
      navigate('/')
    } catch {
      setError(
        'Identifiants invalides ou serveur injoignable. Veuillez réessayer.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh flex">
      {/* -------- Panneau gauche : branding -------- */}
      <div className="hidden lg:flex lg:w-1/2 bg-ink-900 relative overflow-hidden flex-col justify-between p-12">
        {/* Décorations géométriques */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-500 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-brand-400 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-lg">
            D
          </div>
          <div>
            <p className="text-white font-semibold leading-tight">
              DPP Assistant
            </p>
            <p className="text-[11px] text-ink-400 leading-tight">
              Coordination interne
            </p>
          </div>
        </div>

        {/* Message central */}
        <div className="relative">
          <h1 className="text-3xl font-semibold text-white leading-tight mb-4">
            Pilotez vos projets,
            <br />
            suivez vos équipes,
            <br />
            <span className="text-brand-400">en toute clarté.</span>
          </h1>
          <p className="text-[13px] text-ink-400 max-w-md leading-relaxed">
            Plateforme unifiée de gestion des tâches, activités, instructions
            et comptes-rendus pour la Direction des Projets et Partenariats.
          </p>
        </div>

        {/* Pied */}
        <div className="relative text-[11px] text-ink-500">
          © {new Date().getFullYear()} Direction des Projets et Partenariats
        </div>
      </div>

      {/* -------- Panneau droit : formulaire -------- */}
      <div className="flex-1 flex items-center justify-center bg-ink-50 p-6">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-lg">
              D
            </div>
            <div>
              <p className="text-ink-900 font-semibold leading-tight">
                DPP Assistant
              </p>
              <p className="text-[11px] text-ink-500 leading-tight">
                Coordination interne
              </p>
            </div>
          </div>

          {/* En-tête */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-ink-900">
              Bon retour
            </h2>
            <p className="text-[13px] text-ink-500 mt-1">
              Connectez-vous pour accéder à votre espace.
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-[12px] font-medium text-ink-700 mb-1.5"
              >
                Nom d'utilisateur
              </label>
              <div className="relative">
                <User
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
                />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-ink-200 rounded-md
                             placeholder:text-ink-400 text-ink-900
                             focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400
                             transition-colors"
                  placeholder="Votre nom d'utilisateur"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[12px] font-medium text-ink-700 mb-1.5"
              >
                Mot de passe
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-9 pr-10 text-sm bg-white border border-ink-200 rounded-md
                             placeholder:text-ink-400 text-ink-900
                             focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400
                             transition-colors"
                  placeholder="Votre mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors"
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-danger-bg border border-danger-border text-danger text-[12px] rounded-md p-3 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full !h-10"
            >
              {isSubmitting ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>

          {/* Aide */}
          <p className="text-[11px] text-ink-500 text-center mt-6">
            Mot de passe oublié ? Contactez l'administrateur.
          </p>
        </div>
      </div>
    </div>
  )
}