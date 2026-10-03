/**
 * ErrorBoundary — capture les erreurs React non gérées.
 * Affiche un écran de secours au lieu d'une page blanche.
 */

import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log dans la console pour le debug
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 p-6">
        <Card className="w-full max-w-md text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-danger-bg text-danger flex items-center justify-center mb-5">
            <AlertTriangle size={32} strokeWidth={1.5} />
          </div>

          <p className="text-[11px] uppercase tracking-widest font-semibold text-ink-400 mb-2">
            Erreur inattendue
          </p>
          <h1 className="text-[22px] font-semibold text-ink-900 mb-2">
            Quelque chose s'est mal passé
          </h1>
          <p className="text-[13px] text-ink-500 mb-6 leading-relaxed">
            Une erreur inattendue est survenue. Vous pouvez recharger la page
            ou revenir au tableau de bord.
          </p>

          {/* Détails (dev only) */}
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left text-[11px] bg-ink-900 text-danger-bg p-3 rounded-md mb-5 overflow-x-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              variant="secondary"
              onClick={this.handleGoHome}
              className="w-full sm:w-auto"
            >
              Tableau de bord
            </Button>
            <Button
              onClick={this.handleReload}
              leftIcon={<RefreshCw size={14} />}
              className="w-full sm:w-auto"
            >
              Recharger
            </Button>
          </div>
        </Card>
      </div>
    )
  }
}