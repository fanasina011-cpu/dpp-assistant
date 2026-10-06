/**
 * Dashboard — dispatcher selon le rôle.
 */

import { useQuery } from '@tanstack/react-query'
import Layout from '../components/Layout'
import Card from '../components/ui/Card'
import ErrorState from '../components/ui/ErrorState'
import { ChefSkeleton, DirectorSkeleton, MemberSkeleton } from '../components/dashboard/Skeletons'
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

  const { roles } = usePermissions()
  const isDirection = estDirecteur(roles) || estSecretaire(roles)
  const isChef = estChefDeService(roles) || estConseillere(roles)

  const Skeleton = isDirection
    ? DirectorSkeleton
    : isChef
      ? ChefSkeleton
      : MemberSkeleton

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  })

  if (isLoading || !data) {
    return (
      <Layout title="Tableau de bord">
        <Skeleton />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout title="Tableau de bord">
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Card>
      </Layout>
    )
  }

  const userNom = user?.nom_complet || 'Utilisateur'
  const userId = user?.id || 0

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
