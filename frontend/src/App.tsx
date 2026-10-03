import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MonProfil from './pages/MonProfil'
import MesTaches from './pages/MesTaches'
import Taches from './pages/Taches'
import TacheDetail from './pages/TacheDetail'
import Activites from './pages/Activites'
import ActiviteDetail from './pages/ActiviteDetail'
import Instructions from './pages/Instructions'
import InstructionDetail from './pages/InstructionDetail'
import Blocages from './pages/Blocages'
import BlocageDetail from './pages/BlocageDetail'
import Agenda from './pages/Agenda'
import CRQ from './pages/CRQ'
import CRQDetail from './pages/CRQDetail'
import Notifications from './pages/Notifications'
import Historique from './pages/Historique'
import Utilisateurs from './pages/Utilisateurs'
import UtilisateurDetail from './pages/UtilisateurDetail'
import Syntheses from './pages/Syntheses'
import SyntheseDetail from './pages/SyntheseDetail'
import Delegations from './pages/Delegations'
import NotFound from './pages/NotFound'
import ProtectedRoute from './routes/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profil"
              element={
                <ProtectedRoute>
                  <MonProfil />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mes-taches"
              element={
                <ProtectedRoute>
                  <MesTaches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/taches"
              element={
                <ProtectedRoute>
                  <Taches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/taches/:id"
              element={
                <ProtectedRoute>
                  <TacheDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activites"
              element={
                <ProtectedRoute>
                  <Activites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activites/:id"
              element={
                <ProtectedRoute>
                  <ActiviteDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructions"
              element={
                <ProtectedRoute>
                  <Instructions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructions/:id"
              element={
                <ProtectedRoute>
                  <InstructionDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/blocages"
              element={
                <ProtectedRoute>
                  <Blocages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/blocages/:id"
              element={
                <ProtectedRoute>
                  <BlocageDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agenda"
              element={
                <ProtectedRoute>
                  <Agenda />
                </ProtectedRoute>
              }
            />
            <Route
              path="/crq"
              element={
                <ProtectedRoute>
                  <CRQ />
                </ProtectedRoute>
              }
            />
            <Route
              path="/crq/:id"
              element={
                <ProtectedRoute>
                  <CRQDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/historique"
              element={
                <ProtectedRoute>
                  <Historique />
                </ProtectedRoute>
              }
            />
            <Route
              path="/utilisateurs"
              element={
                <ProtectedRoute>
                  <Utilisateurs />
                </ProtectedRoute>
              }
            />
                      <Route
            path="/utilisateurs/:id"
            element={
              <ProtectedRoute>
                <UtilisateurDetail />
              </ProtectedRoute>
            }
          />
            <Route
              path="/syntheses"
              element={
                <ProtectedRoute>
                  <Syntheses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/syntheses/:id"
              element={
                <ProtectedRoute>
                  <SyntheseDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/delegations"
              element={
                <ProtectedRoute>
                  <Delegations />
                </ProtectedRoute>
              }
            />

            {/* Route 404 — doit être en dernier */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App