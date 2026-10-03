/**
 * Menu latéral v3 — responsive avec drawer mobile.
 * - Desktop (lg+) : sidebar fixe à gauche
 * - Mobile (< lg) : drawer qui s'ouvre/ferme via un bouton dans le Header
 */

import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  CheckSquare,
  ClipboardList,
  FileBarChart,
  FileText,
  FolderKanban,
  History,
  LayoutDashboard,
  Share2,
  User,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ROLES_CHEF } from '../types'
import type { Role } from '../types'
import type { ReactNode } from 'react'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  /** Rôles EFFECTIFS requis (rôle propre ou délégué). */
  roles?: Role[]
}

interface NavSection {
  title: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    title: 'Général',
    items: [
      { to: '/', label: 'Tableau de bord', icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    title: 'Travail',
    items: [
      {
        to: '/mes-taches',
        label: 'Mes tâches',
        icon: <ClipboardList size={16} />,
        roles: [
          'DIRECTEUR',
          'SECRETAIRE_DIRECTION',
          ...ROLES_CHEF,
        ],
      },
      { to: '/taches', label: 'Tâches', icon: <CheckSquare size={16} /> },
      { to: '/activites', label: 'Activités', icon: <FolderKanban size={16} /> },
      { to: '/instructions', label: 'Instructions', icon: <FileText size={16} /> },
      { to: '/blocages', label: 'Blocages', icon: <AlertTriangle size={16} /> },
      { to: '/agenda', label: 'Agenda', icon: <Calendar size={16} /> },
    ],
  },
  {
    title: 'Suivi',
    items: [
      { to: '/crq', label: 'Comptes-rendus', icon: <FileBarChart size={16} /> },
      {
        to: '/syntheses',
        label: 'Synthèses',
        icon: <BarChart3 size={16} />,
        roles: [
          'DIRECTEUR',
          'SECRETAIRE_DIRECTION',
          ...ROLES_CHEF,
          'CONSEILLERE_TECHNIQUE',
        ],
      },
      { to: '/notifications', label: 'Notifications', icon: <Bell size={16} /> },
      { to: '/historique', label: 'Historique', icon: <History size={16} /> },
      {
        to: '/delegations',
        label: 'Délégations',
        icon: <Share2 size={16} />,
        roles: ['DIRECTEUR', ...ROLES_CHEF],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        to: '/utilisateurs',
        label: 'Utilisateurs',
        icon: <Users size={16} />,
        roles: ['DIRECTEUR'],
      },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth()
  const location = useLocation()

  /**
   * Rôles effectifs de l'utilisateur (rôle propre + délégations en cours).
   * Le repli sur `[user.role]` couvre un /auth/me servi par une version
   * antérieure de l'API.
   */
  const roles: Role[] | undefined = user
    ? user.roles_effectifs?.length
      ? user.roles_effectifs
      : [user.role]
    : undefined

  // Ferme le drawer automatiquement au changement de page
  useEffect(() => {
    if (isOpen) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Bloquer le scroll body quand le drawer est ouvert sur mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.roles || (roles && item.roles.some((r) => roles.includes(r))),
    ),
  })).filter((section) => section.items.length > 0)

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-60 bg-ink-900 text-ink-300 flex flex-col shrink-0
          fixed lg:static inset-y-0 left-0 z-50
          transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* En-tête */}
        <div className="px-4 h-14 flex items-center justify-between border-b border-ink-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center text-white text-xs font-bold">
              D
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-tight">
                DPP Assistant
              </h1>
              <p className="text-[10px] text-ink-500 leading-tight">
                Coordination interne
              </p>
            </div>
          </div>

          {/* Bouton fermer (mobile uniquement) */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden w-7 h-7 flex items-center justify-center rounded-md text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
            aria-label="Fermer le menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-3">
              <div className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {section.title}
              </div>
              <div className="space-y-0.5 px-2">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-ink-800 text-white'
                          : 'text-ink-400 hover:bg-ink-800/60 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={isActive ? 'text-brand-400' : 'text-ink-500'}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Pied : Mon profil */}
        <div className="border-t border-ink-800 p-2">
          <NavLink
            to="/profil"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-ink-800 text-white'
                  : 'text-ink-400 hover:bg-ink-800/60 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-brand-400' : 'text-ink-500'}>
                  <User size={16} />
                </span>
                <span>Mon profil</span>
              </>
            )}
          </NavLink>
        </div>
      </aside>
    </>
  )
}