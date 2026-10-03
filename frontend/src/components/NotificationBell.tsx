/**
 * Cloche de notifications — version finale.
 * Badge + shake + son personnalisable + mode Ne pas déranger.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Inbox,
  Moon,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  fetchNotifications,
  marquerNotificationLue,
} from '../api/notifications'
import { useToast } from '../context/ToastContext'
import { SOUNDS, playSound, type SoundId } from '../utils/sounds'
import type { Notification } from '../types'

const SOUND_ENABLED_KEY = 'notifications:soundEnabled'
const SOUND_ID_KEY = 'notifications:soundId'
const DND_UNTIL_KEY = 'notifications:dndUntil'

function formatRelatif(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffJ = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH} h`
  if (diffJ === 1) return 'hier'
  if (diffJ < 7) return `il y a ${diffJ} j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/**
 * Formate le temps restant jusqu'à l'expiration du mode NPD.
 */
function formatTempsRestant(ms: number): string {
  const min = Math.ceil(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const restMin = min % 60
  if (restMin === 0) return `${h}h`
  return `${h}h${String(restMin).padStart(2, '0')}`
}

/**
 * Calcule l'epoch ms de "demain 8h".
 */
function timestampDemainMatin(): number {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(8, 0, 0, 0)
  return d.getTime()
}

export default function NotificationBell() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [isOpen, setIsOpen] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [isSoundMenuOpen, setIsSoundMenuOpen] = useState(false)
  const [isDndMenuOpen, setIsDndMenuOpen] = useState(false)
  const [now, setNow] = useState(Date.now())

  // Préférences son
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(SOUND_ENABLED_KEY)
    return saved === null ? true : saved === 'true'
  })
  const [soundId, setSoundId] = useState<SoundId>(() => {
    const saved = localStorage.getItem(SOUND_ID_KEY)
    if (saved === 'bip' || saved === 'ding' || saved === 'pop' || saved === 'doux') {
      return saved
    }
    return 'bip'
  })

  // Mode Ne pas déranger — timestamp de fin
  const [dndUntil, setDndUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem(DND_UNTIL_KEY)
    if (!saved) return null
    const ts = Number(saved)
    if (isNaN(ts) || ts <= Date.now()) return null
    return ts
  })

  const [position, setPosition] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  })

  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const soundMenuRef = useRef<HTMLDivElement>(null)
  const dndMenuRef = useRef<HTMLDivElement>(null)
  const previousCountRef = useRef<number | null>(null)

  // Persistance
  useEffect(() => {
    localStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled))
  }, [soundEnabled])

  useEffect(() => {
    localStorage.setItem(SOUND_ID_KEY, soundId)
  }, [soundId])

  useEffect(() => {
    if (dndUntil) {
      localStorage.setItem(DND_UNTIL_KEY, String(dndUntil))
    } else {
      localStorage.removeItem(DND_UNTIL_KEY)
    }
  }, [dndUntil])

  // Ticker global (mise à jour du countdown NPD)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Auto-expiration du NPD
  useEffect(() => {
    if (!dndUntil) return
    if (dndUntil <= now) {
      setDndUntil(null)
      showToast('Mode Ne pas déranger terminé', 'info')
      return
    }
    // Timer pour expiration exacte
    const timeout = setTimeout(() => {
      setDndUntil(null)
      showToast('Mode Ne pas déranger terminé', 'info')
    }, dndUntil - Date.now())
    return () => clearTimeout(timeout)
  }, [dndUntil, now, showToast])

  const isDndActive = dndUntil !== null && dndUntil > now

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => fetchNotifications({ lue: false }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const nonLues = notifications.length

  // Détection nouvelle notification → shake + son (sauf si NPD actif)
  useEffect(() => {
    const previous = previousCountRef.current
    if (previous === null) {
      previousCountRef.current = nonLues
      return
    }
    if (nonLues > previous) {
      setIsShaking(true)
      if (soundEnabled && !isDndActive) {
        playSound(soundId)
      }
      setTimeout(() => setIsShaking(false), 600)
    }
    previousCountRef.current = nonLues
  }, [nonLues, soundEnabled, soundId, isDndActive])

  const marquerLueMutation = useMutation({
    mutationFn: marquerNotificationLue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => showToast('Impossible de marquer comme lue', 'error'),
  })

  const marquerToutLuMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => marquerNotificationLue(id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      showToast('Toutes les notifications marquées comme lues', 'success')
    },
    onError: () => showToast('Erreur lors du marquage', 'error'),
  })

  // Position du panel
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    })
  }, [isOpen])

  // Fermetures
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) {
        return
      }
      setIsOpen(false)
      setIsSoundMenuOpen(false)
      setIsDndMenuOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setIsSoundMenuOpen(false)
        setIsDndMenuOpen(false)
      }
    }
    function handleClose() {
      setIsOpen(false)
      setIsSoundMenuOpen(false)
      setIsDndMenuOpen(false)
    }
    function handleScroll(e: Event) {
      // Ignore les scrolls internes au panel
      if (panelRef.current?.contains(e.target as Node)) return
      handleClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleClose)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleClose)
    }
  }, [isOpen])

  // Ferme le sous-menu son
  useEffect(() => {
    if (!isSoundMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (soundMenuRef.current?.contains(e.target as Node)) return
      setIsSoundMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSoundMenuOpen])

  // Ferme le sous-menu NPD
  useEffect(() => {
    if (!isDndMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dndMenuRef.current?.contains(e.target as Node)) return
      setIsDndMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDndMenuOpen])

  // Handlers
  const handleMarquerLue = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    marquerLueMutation.mutate(id)
  }

  const handleToutMarquerLu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (notifications.length === 0) return
    marquerToutLuMutation.mutate(notifications.map((n) => n.id))
  }

  const handleSelectSound = (id: SoundId) => {
    setSoundId(id)
    setSoundEnabled(true)
    setTimeout(() => playSound(id), 50)
  }

  const handleToggleMute = () => {
    setSoundEnabled((s) => !s)
  }

  const handleActiverDnd = (duration: '1h' | '4h' | 'demain') => {
    let until: number
    if (duration === '1h') until = Date.now() + 60 * 60 * 1000
    else if (duration === '4h') until = Date.now() + 4 * 60 * 60 * 1000
    else until = timestampDemainMatin()

    setDndUntil(until)
    setIsDndMenuOpen(false)
    showToast(
      duration === 'demain'
        ? 'Ne pas déranger jusqu\'à demain 8h'
        : `Ne pas déranger pendant ${duration}`,
      'info',
    )
  }

  const handleAnnulerDnd = () => {
    setDndUntil(null)
    setIsDndMenuOpen(false)
    showToast('Mode Ne pas déranger désactivé', 'info')
  }

  const tempsRestant = isDndActive && dndUntil ? dndUntil - now : 0

  return (
    <>
      {/* Cloche */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={`relative w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
          isOpen
            ? 'bg-ink-100 text-ink-700'
            : isDndActive
              ? 'text-ink-400 hover:text-ink-700 hover:bg-ink-100'
              : 'text-ink-500 hover:text-ink-800 hover:bg-ink-100'
        } ${isShaking && !isDndActive ? 'animate-shake' : ''}`}
        aria-label={`Notifications${nonLues > 0 ? ` (${nonLues} non lues)` : ''}${isDndActive ? ' · Ne pas déranger' : ''}`}
        title={isDndActive ? 'Ne pas déranger actif' : 'Notifications'}
      >
        {isDndActive ? <BellOff size={16} /> : <Bell size={16} />}
        {nonLues > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center leading-none ${
              isDndActive
                ? 'bg-ink-400'
                : 'bg-danger'
            } ${isShaking && !isDndActive ? 'animate-pulse-badge' : ''}`}
          >
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              right: position.right,
              width: 380,
            }}
            className="z-[100] bg-white border border-ink-200 rounded-lg shadow-xl overflow-visible animate-in fade-in slide-in-from-top-1 duration-150"
            role="dialog"
            aria-label="Notifications"
          >
            {/* En-tête */}
            <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold text-ink-900">
                  Notifications
                </h3>
                {nonLues > 0 && (
                  <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded-full tabular-nums">
                    {nonLues} non lue{nonLues > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {nonLues > 0 && (
                  <button
                    type="button"
                    onClick={handleToutMarquerLu}
                    disabled={marquerToutLuMutation.isPending}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-ink-600 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors disabled:opacity-50"
                    title="Marquer tout comme lu"
                  >
                    <CheckCheck size={12} />
                    <span className="hidden sm:inline">Tout lire</span>
                  </button>
                )}

                {/* Son */}
                <div className="relative" ref={soundMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSoundMenuOpen((o) => !o)
                      setIsDndMenuOpen(false)
                    }}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                      isSoundMenuOpen
                        ? 'bg-ink-100 text-ink-700'
                        : 'text-ink-400 hover:text-ink-700 hover:bg-ink-100'
                    }`}
                    aria-label="Paramètres du son"
                    title="Paramètres du son"
                  >
                    {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  </button>

                  {isSoundMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-ink-200 rounded-lg shadow-xl z-10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                      <div className="px-3 py-2 border-b border-ink-100">
                        <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
                          Son de notification
                        </p>
                      </div>
                      <div className="py-1">
                        {SOUNDS.map((s) => {
                          const isActive = soundEnabled && s.id === soundId
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleSelectSound(s.id)}
                              className={`w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors ${
                                isActive
                                  ? 'bg-brand-50 text-brand-700'
                                  : 'text-ink-700 hover:bg-ink-50'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-[12px] font-medium ${
                                    isActive ? 'text-brand-700' : ''
                                  }`}
                                >
                                  {s.label}
                                </div>
                                <div className="text-[10px] text-ink-400 truncate">
                                  {s.description}
                                </div>
                              </div>
                              {isActive && (
                                <Check size={12} className="shrink-0 mt-1" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                      <div className="border-t border-ink-100">
                        <button
                          type="button"
                          onClick={handleToggleMute}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-ink-700 hover:bg-ink-50 transition-colors"
                        >
                          {soundEnabled ? (
                            <>
                              <VolumeX size={12} />
                              <span>Couper le son</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={12} />
                              <span>Activer le son</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ne pas déranger */}
                <div className="relative" ref={dndMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDndMenuOpen((o) => !o)
                      setIsSoundMenuOpen(false)
                    }}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                      isDndMenuOpen
                        ? 'bg-ink-100 text-ink-700'
                        : isDndActive
                          ? 'text-brand-600 bg-brand-50 hover:bg-brand-100'
                          : 'text-ink-400 hover:text-ink-700 hover:bg-ink-100'
                    }`}
                    aria-label="Ne pas déranger"
                    title={
                      isDndActive
                        ? `Ne pas déranger · ${formatTempsRestant(tempsRestant)}`
                        : 'Ne pas déranger'
                    }
                  >
                    <Moon size={14} />
                  </button>

                  {isDndMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-ink-200 rounded-lg shadow-xl z-10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                      <div className="px-3 py-2 border-b border-ink-100">
                        <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
                          Ne pas déranger
                        </p>
                      </div>

                      {isDndActive && (
                        <div className="mx-3 mt-2 px-2.5 py-2 rounded-md bg-brand-50 border border-brand-200 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Moon size={11} className="text-brand-600" />
                            <span className="text-[11px] font-medium text-brand-700">
                              Actif · {formatTempsRestant(tempsRestant)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleAnnulerDnd}
                            className="w-5 h-5 flex items-center justify-center rounded text-brand-600 hover:bg-brand-100 transition-colors"
                            title="Désactiver"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      )}

                      <div className="py-1">
                        {!isDndActive && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleActiverDnd('1h')}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-ink-700 hover:bg-ink-50 transition-colors"
                            >
                              <span className="w-5 text-center">⏱</span>
                              <span>Pendant 1 heure</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleActiverDnd('4h')}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-ink-700 hover:bg-ink-50 transition-colors"
                            >
                              <span className="w-5 text-center">⏱</span>
                              <span>Pendant 4 heures</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleActiverDnd('demain')}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-ink-700 hover:bg-ink-50 transition-colors"
                            >
                              <span className="w-5 text-center">🌙</span>
                              <span>Jusqu'à demain 8h</span>
                            </button>
                          </>
                        )}

                        {isDndActive && (
                          <button
                            type="button"
                            onClick={handleAnnulerDnd}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-danger hover:bg-danger-bg transition-colors"
                          >
                            <X size={12} />
                            <span>Désactiver Ne pas déranger</span>
                          </button>
                        )}
                      </div>

                      <div className="px-3 py-2 border-t border-ink-100 bg-ink-50/40">
                        <p className="text-[10px] text-ink-500 leading-relaxed">
                          Aucun son ne sera joué et la cloche ne se secouera pas.
                          Le compteur reste visible.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bandeau NPD actif */}
            {isDndActive && (
              <div className="px-4 py-2 bg-brand-50 border-b border-brand-100 flex items-center gap-2">
                <Moon size={12} className="text-brand-600 shrink-0" />
                <span className="text-[11px] text-brand-700 font-medium flex-1">
                  Ne pas déranger · {formatTempsRestant(tempsRestant)}
                </span>
                <button
                  type="button"
                  onClick={handleAnnulerDnd}
                  className="text-[10px] text-brand-700 hover:text-brand-900 font-medium underline transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}

            {/* Liste */}
            <div className="max-h-[400px] overflow-y-auto rounded-b-lg">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-ink-400">
                  <Inbox size={32} strokeWidth={1.25} />
                  <p className="text-[12px]">Aucune notification non lue.</p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {notifications.slice(0, 8).map((n: Notification) => (
                    <li key={n.id} className="group">
                      <div className="flex items-start gap-2.5 px-4 py-3 hover:bg-ink-50/60 transition-colors">
                        <div className="pt-1.5 w-1.5 shrink-0">
                          <span className="block w-1.5 h-1.5 rounded-full bg-brand-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-ink-500">
                              {n.type_display}
                            </span>
                            <span className="text-[9px] text-ink-400">
                              {formatRelatif(n.date_creation)}
                            </span>
                          </div>
                          <p className="text-[12px] text-ink-800 leading-snug line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleMarquerLue(n.id, e)}
                          disabled={marquerLueMutation.isPending}
                          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-ink-300 hover:text-success hover:bg-success-bg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          aria-label="Marquer comme lue"
                          title="Marquer comme lue"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pied */}
            <div className="border-t border-ink-100 bg-ink-50/40 rounded-b-lg">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between gap-2 px-4 py-2.5 text-[12px] font-medium text-ink-700 hover:bg-ink-100/60 transition-colors group"
              >
                <span>Voir toutes les notifications</span>
                <ArrowRight
                  size={13}
                  className="text-ink-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all"
                />
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}