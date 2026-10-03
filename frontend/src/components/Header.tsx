/**
 * En-tête — titre de page + recherche globale + bouton menu (mobile) +
 * cloche + utilisateur.
 */

import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Button from './ui/Button'
import NotificationBell from './NotificationBell'
import RechercheGlobale from './RechercheGlobale'

interface HeaderProps {
  title: string
  onMenuToggle: () => void
}

function initials(nom: string) {
  return nom
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Header({ title, onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth()

  return (
    <header className="h-12 bg-white border-b border-ink-200 px-3 sm:px-6 flex items-center justify-between shrink-0">
      {/* Menu + titre */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Bouton burger (mobile) */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-md text-ink-500 hover:text-ink-800 hover:bg-ink-100 transition-colors shrink-0"
          aria-label="Ouvrir le menu"
        >
          <Menu size={18} />
        </button>

        <h1 className="text-[15px] font-semibold text-ink-900 truncate">
          {title}
        </h1>
      </div>

      {/* Recherche globale : masquée sur mobile pour laisser la place au
          titre et aux actions de droite. */}
      <div className="hidden md:block w-64 shrink-0 mx-3">
        <RechercheGlobale />
      </div>

      {/* Actions droite */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <NotificationBell />

        <div className="w-px h-6 bg-ink-200" />

        {/* Utilisateur */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
            {user?.nom_complet ? initials(user.nom_complet) : '??'}
          </div>
          <div className="text-right hidden md:block">
            <div className="text-[13px] font-medium text-ink-900 leading-tight truncate max-w-[140px]">
              {user?.nom_complet}
            </div>
            <div className="text-[11px] text-ink-500 leading-tight truncate max-w-[140px]">
              {user?.role_display}
            </div>
          </div>
        </div>

        <div className="hidden sm:block w-px h-6 bg-ink-200" />

        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          leftIcon={<LogOut size={14} />}
        >
          <span className="hidden sm:inline">Déconnexion</span>
        </Button>
      </div>
    </header>
  )
}