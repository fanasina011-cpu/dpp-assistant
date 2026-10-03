/**
 * Page Mon profil v3 — design pro.
 * 2 colonnes : identité + infos à gauche, stats + accès rapide à droite.
 */

import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Activity,
  Bell,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Hash,
  Key,
  Mail,
  Pencil,
  Shield,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react'
import Layout from '../components/Layout'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fetchTaches } from '../api/taches'
import { fetchNotifications } from '../api/notifications'
import {
  changerMonMotDePasse,
  modifierMonProfil,
} from '../api/utilisateurs'

// ============================================================================
// UTILITAIRES
// ============================================================================

function Ligne({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-ink-100 text-ink-500 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-0.5">
          {label}
        </p>
        <div className="text-[13px] text-ink-900 font-medium break-words">
          {value}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  icon,
  label,
  value,
  accent,
  to,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent: 'info' | 'danger' | 'success' | 'warning' | 'brand'
  to?: string
}) {
  const accentMap = {
    info: 'text-info bg-info-bg',
    danger: 'text-danger bg-danger-bg',
    success: 'text-success bg-success-bg',
    warning: 'text-warning bg-warning-bg',
    brand: 'text-brand-600 bg-brand-50',
  }

  const content = (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-ink-50/60 transition-colors group">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accentMap[accent]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-ink-500 font-medium">
          {label}
        </div>
        <div className="text-[18px] font-semibold text-ink-900 tabular-nums leading-tight mt-0.5">
          {value}
        </div>
      </div>
    </div>
  )

  if (to) return <Link to={to}>{content}</Link>
  return content
}

// ============================================================================
// MODALE : Modifier profil
// ============================================================================

function ModifierProfilModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, refreshUser } = useAuth()
  const { showToast } = useToast()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (isOpen && user) {
      setFirstName(user.first_name || '')
      setLastName(user.last_name || '')
      setEmail(user.email || '')
    }
  }, [isOpen, user])

  const mutation = useMutation({
    mutationFn: () =>
      modifierMonProfil({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
      }),
    onSuccess: async () => {
      await refreshUser?.()
      showToast('Profil mis à jour avec succès', 'success')
      onClose()
    },
    onError: (err: any) => {
      showToast(
        err?.response?.data?.detail ||
          err?.response?.data?.email?.[0] ||
          'Erreur lors de la mise à jour',
        'error',
      )
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      showToast('Prénom et nom doivent contenir au moins 2 caractères', 'warning')
      return
    }
    mutation.mutate()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Pencil size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink-900">Modifier mon profil</h3>
            <p className="text-[11px] text-ink-500 mt-0.5">
              Le Directeur sera notifié de vos modifications.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Prénom"
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Votre prénom"
          />
          <Input
            label="Nom"
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Votre nom"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre.email@dpp.local"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ============================================================================
// MODALE : Changer mot de passe
// ============================================================================

function ChangerMotDePasseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showToast } = useToast()
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    if (isOpen) {
      setAncien('')
      setNouveau('')
      setConfirmation('')
    }
  }, [isOpen])

  const mutation = useMutation({
    mutationFn: () =>
      changerMonMotDePasse({
        ancien_mot_de_passe: ancien,
        nouveau_mot_de_passe: nouveau,
        confirmation,
      }),
    onSuccess: () => {
      showToast('Mot de passe modifié avec succès', 'success')
      onClose()
    },
    onError: (err: any) => {
      showToast(
        err?.response?.data?.detail ||
          err?.response?.data?.confirmation?.[0] ||
          err?.response?.data?.nouveau_mot_de_passe?.[0] ||
          'Erreur lors du changement',
        'error',
      )
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (nouveau.length < 8) {
      showToast('Le nouveau mot de passe doit contenir au moins 8 caractères', 'warning')
      return
    }
    if (nouveau !== confirmation) {
      showToast('Les deux mots de passe ne correspondent pas', 'warning')
      return
    }
    mutation.mutate()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-warning-bg text-warning flex items-center justify-center shrink-0">
            <Key size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink-900">Changer mon mot de passe</h3>
            <p className="text-[11px] text-ink-500 mt-0.5">
              Le Directeur sera notifié de ce changement.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Mot de passe actuel"
            type="password"
            required
            value={ancien}
            onChange={(e) => setAncien(e.target.value)}
            placeholder="Votre mot de passe actuel"
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            required
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
            placeholder="Au moins 8 caractères"
          />
          <Input
            label="Confirmation"
            type="password"
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Répétez le nouveau mot de passe"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Changement...' : 'Changer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ============================================================================
// PAGE PRINCIPALE
// ============================================================================

export default function MonProfil() {
  const { user } = useAuth()
  const [isModifierOpen, setIsModifierOpen] = useState(false)
  const [isMotDePasseOpen, setIsMotDePasseOpen] = useState(false)

  const { data: taches = [] } = useQuery({
    queryKey: ['taches', 'me', user?.id],
    queryFn: () => fetchTaches({ responsable: user?.id }),
    enabled: Boolean(user?.id),
  })

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => fetchNotifications({ lue: false }),
    enabled: Boolean(user?.id),
  })

  if (!user) return null

  const dateInscription = user.date_joined
    ? new Date(user.date_joined).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  const tachesActives = taches.filter(
    (t) => t.statut !== 'TERMINEE' && t.statut !== 'ANNULEE',
  )
  const tachesEnRetard = taches.filter((t) => t.est_en_retard)
  const tachesTerminees = taches.filter((t) => t.statut === 'TERMINEE')
  const nbNonLues = notifications.length

  return (
    <Layout title="Mon profil">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* 2 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
          {/* ===== Colonne gauche ===== */}
          <div className="space-y-5">
            {/* Carte identité */}
            <Card>
              <div className="flex items-start gap-5">
                <Avatar
                  name={user.nom_complet || user.username}
                  size="lg"
                  className="!w-20 !h-20 !text-xl shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h1 className="text-[22px] font-semibold text-ink-900 leading-tight">
                    {user.nom_complet}
                  </h1>
                  <p className="text-[13px] text-ink-500 mt-1">
                    {user.role_display}
                    {user.service && (
                      <>
                        <span className="mx-1.5 text-ink-300">·</span>
                        {user.service}
                      </>
                    )}
                  </p>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border bg-success-bg text-success border-success-border">
                      <CheckCircle2 size={10} />
                      Compte actif
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border bg-brand-50 text-brand-700 border-brand-200">
                      <Shield size={10} />
                      {user.role_display}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-5 pt-5 border-t border-ink-100">
                <Button
                  size="sm"
                  onClick={() => setIsModifierOpen(true)}
                  leftIcon={<Pencil size={12} />}
                >
                  Modifier le profil
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsMotDePasseOpen(true)}
                  leftIcon={<Key size={12} />}
                >
                  Changer le mot de passe
                </Button>
              </div>
            </Card>

            {/* Informations détaillées */}
            <Card title="Informations personnelles">
              <div className="divide-y divide-ink-100 -mt-2">
                <Ligne icon={<Hash size={14} />} label="Nom d'utilisateur" value={user.username} />
                <Ligne
                  icon={<Mail size={14} />}
                  label="Email"
                  value={user.email || <span className="text-ink-400 italic">Non renseigné</span>}
                />
                <Ligne
                  icon={<UserIcon size={14} />}
                  label="Prénom"
                  value={user.first_name || <span className="text-ink-400 italic">—</span>}
                />
                <Ligne
                  icon={<UserIcon size={14} />}
                  label="Nom"
                  value={user.last_name || <span className="text-ink-400 italic">—</span>}
                />
                <Ligne icon={<Shield size={14} />} label="Rôle" value={user.role_display} />
                <Ligne
                  icon={<Building2 size={14} />}
                  label="Service"
                  value={user.service || <span className="text-ink-400 italic">Non affecté</span>}
                />
                <Ligne
                  icon={<Calendar size={14} />}
                  label="Compte créé le"
                  value={<span className="capitalize">{dateInscription}</span>}
                />
              </div>
            </Card>
          </div>

          {/* ===== Colonne droite ===== */}
          <div className="space-y-5">
            {/* Statistiques */}
            <Card title="Ma charge de travail">
              <div className="space-y-0.5 -mt-2">
                <StatCard
                  icon={<ClipboardList size={16} />}
                  label="Tâches actives"
                  value={tachesActives.length}
                  accent="info"
                  to="/mes-taches"
                />
                <StatCard
                  icon={<Clock size={16} />}
                  label="En retard"
                  value={tachesEnRetard.length}
                  accent="danger"
                  to="/mes-taches"
                />
                <StatCard
                  icon={<CheckCircle2 size={16} />}
                  label="Terminées"
                  value={tachesTerminees.length}
                  accent="success"
                />
              </div>
            </Card>

            {/* Accès rapides */}
            <Card title="Accès rapides">
              <div className="space-y-0.5 -mt-2">
                <Link
                  to="/mes-taches"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-ink-50/60 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <ClipboardList size={15} />
                  </div>
                  <span className="flex-1 text-[13px] font-medium text-ink-800 group-hover:text-brand-600 transition-colors">
                    Mes tâches
                  </span>
                  <span className="text-ink-300 text-[11px] tabular-nums">
                    {tachesActives.length}
                  </span>
                </Link>

                <Link
                  to="/notifications"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-ink-50/60 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-warning-bg text-warning flex items-center justify-center shrink-0">
                    <Bell size={15} />
                  </div>
                  <span className="flex-1 text-[13px] font-medium text-ink-800 group-hover:text-brand-600 transition-colors">
                    Notifications
                  </span>
                  {nbNonLues > 0 && (
                    <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded-full tabular-nums">
                      {nbNonLues}
                    </span>
                  )}
                </Link>

                <Link
                  to="/agenda"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-ink-50/60 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-info-bg text-info flex items-center justify-center shrink-0">
                    <CalendarDays size={15} />
                  </div>
                  <span className="flex-1 text-[13px] font-medium text-ink-800 group-hover:text-brand-600 transition-colors">
                    Mon agenda
                  </span>
                </Link>

                <Link
                  to="/historique"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-ink-50/60 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-ink-100 text-ink-500 flex items-center justify-center shrink-0">
                    <Activity size={15} />
                  </div>
                  <span className="flex-1 text-[13px] font-medium text-ink-800 group-hover:text-brand-600 transition-colors">
                    Mon activité
                  </span>
                </Link>
              </div>
            </Card>

            {/* Note de sécurité */}
            <div className="bg-info-bg border border-info-border rounded-lg p-3.5 flex items-start gap-2.5">
              <TrendingUp size={14} className="text-info shrink-0 mt-0.5" />
              <div className="text-[11px] text-ink-700 leading-relaxed">
                <p className="font-medium text-ink-900 mb-0.5">Suivi des modifications</p>
                <p>
                  Le Directeur est automatiquement notifié de chaque modification
                  de votre profil ou mot de passe. Ces actions sont tracées dans
                  l'historique.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModifierProfilModal
        isOpen={isModifierOpen}
        onClose={() => setIsModifierOpen(false)}
      />

      <ChangerMotDePasseModal
        isOpen={isMotDePasseOpen}
        onClose={() => setIsMotDePasseOpen(false)}
      />
    </Layout>
  )
}