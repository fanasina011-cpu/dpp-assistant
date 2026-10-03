/**
 * Dashboard — dispatcher selon le rôle.
 */

import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import Layout from '../components/Layout'
import Card from '../components/ui/Card'
import MemberView from '../components/dashboard/views/MemberView'
import DirectorView from '../components/dashboard/views/DirectorView'
import ChefView from '../components/dashboard/views/ChefView'
import { fetchDashboard } from '../api/dashboard'
import { useAuth } from '../context/AuthContext'
import {
  estChefDeService,
  estConseillere,
  estDirecteur,
  estSecretaire,
  usePermissions,
} from '../hooks/usePermissions'

export default function Dashboard() {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <Layout title="Tableau de bord">
        <div className="space-y-5">
          <div className="h-16 bg-ink-100 rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 bg-ink-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-56 bg-ink-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout title="Tableau de bord">
        <Card>
          <div className="py-12 flex flex-col items-center gap-2 text-danger">
            <AlertCircle size={24} />
            <p className="text-sm">
              Erreur lors du chargement du tableau de bord.
            </p>
          </div>
        </Card>
      </Layout>
    )
  }

  const { roles } = usePermissions()
  const userNom = user?.nom_complet || 'Utilisateur'
  const userId = user?.id || 0

  // ---- Dispatch par rôles EFFECTIFS (délégations comprises) ----
  const isDirection = estDirecteur(roles) || estSecretaire(roles)
  const isChef = estChefDeService(roles) || estConseillere(roles)

  return (
    <Layout title="Tableau de bord">
      {isDirection ? (
        <DirectorView data={data} userNom={userNom} />
      ) : isChef ? (
        <ChefView data={data} userNom={userNom} userId={userId} />
      ) : (
        <MemberView data={data} userNom={userNom} />
      )}
    </Layout>
  )
}
