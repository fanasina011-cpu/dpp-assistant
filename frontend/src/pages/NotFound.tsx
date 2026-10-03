/**
 * Page 404 — Route introuvable.
 * Design centré, illustration légère, actions de retour.
 */

import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 p-6">
      <Card className="w-full max-w-md text-center">
        {/* Icône boussole */}
        <div className="mx-auto w-16 h-16 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center mb-5">
          <Compass size={32} strokeWidth={1.5} />
        </div>

        {/* Code + titre */}
        <p className="text-[11px] uppercase tracking-widest font-semibold text-ink-400 mb-2">
          Erreur 404
        </p>
        <h1 className="text-[22px] font-semibold text-ink-900 mb-2">
          Page introuvable
        </h1>
        <p className="text-[13px] text-ink-500 mb-6 leading-relaxed">
          La page que vous cherchez n'existe pas, a été supprimée ou vous
          n'avez pas les droits pour y accéder.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft size={14} />}
          >
            Retour
          </Button>
          <Link to="/">
            <Button leftIcon={<Home size={14} />} className="w-full sm:w-auto">
              Tableau de bord
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}