/* SECTION: IMPORTS 
   - USE: Loads routing tools, animation libraries, security utilities, and page components.
*/
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ModuleView from './pages/ModuleView';
import SimulationView from './pages/SimulationView';
import NotFound from './pages/NotFound';

// Admin Components
import AdminLayout from './components/admin/AdminLayout';
import OverviewPage from './pages/admin/OverviewPage';
import UsersPage from './pages/admin/UsersPage';
import CohortsPage from './pages/admin/CohortsPage';
import ReportsPage from './pages/admin/ReportsPage';
import LessonsPage from './pages/admin/LessonsPage';
import ActivityLogsPage from './pages/admin/ActivityLogsPage';

// Security Utilities
import { getAuthRole, type AuthRole } from './utils/auth';
import GodModeListener from './components/GodModeListener';
import DeveloperDock from './components/DeveloperDock';

/* SECTION: ROUTING ARCHITECTURE & SECURITY LOGIC */
const getLandingRoute = (role: string): '/dashboard' | '/admin/dashboard' => {
  return role === 'admin' || role === 'developer' ? '/admin/dashboard' : '/dashboard';
};

interface RequireAuthProps {
  children: ReactElement;
  role?: AuthRole;
}

/* SECTION: AUTHENTICATION WRAPPER */
const RequireAuth = ({ children, role }: RequireAuthProps) => {
  const currentRole = getAuthRole();

  if (!currentRole) {
    return <Navigate to="/login" replace />;
  }

  // 🌟 GOD MODE OVERRIDE: Let the Developer access EVERYTHING 🌟
  if (currentRole === 'developer') {
    return children;
  }

  // Standard route protection for normal users
  if (role && currentRole !== role) {
    return <Navigate to={getLandingRoute(currentRole)} replace />;
  }

  return children;
};

/* SECTION: ANIMATION WRAPPER (AnimatedRoutes) */
const AnimatedRoutes = () => {
  const location = useLocation();
  const currentRole = getAuthRole();

  // 🔥 Smart UI Scaling Logic 🔥
  // We apply the zoomed-out look universally, UNLESS we are in the simulation.
  // The Canvas engine requires native 100% scale to calculate mouse physics accurately.
  useEffect(() => {
    if (location.pathname.includes('/simulation')) {
      document.documentElement.classList.remove('zoomed-ui');
    } else {
      document.documentElement.classList.add('zoomed-ui');
    }
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname.split('/')[1]}>

        {/* DEFAULT & LOGIN ROUTES */}
        <Route
          path="/"
          element={
            currentRole ? (
              <Navigate to={getLandingRoute(currentRole)} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/login"
          element={currentRole ? <Navigate to={getLandingRoute(currentRole)} replace /> : <Login />}
        />

        {/* SECTION: TRAINEE PROTECTED ROUTES */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth role="trainee">
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/module/:id"
          element={
            <RequireAuth role="trainee">
              <ModuleView />
            </RequireAuth>
          }
        />
        <Route
          path="/simulation/:id"
          element={
            <RequireAuth role="trainee">
              <SimulationView />
            </RequireAuth>
          }
        />

        {/* SECTION: ADMIN PROTECTED ROUTES */}
        <Route
          path="/admin"
          element={
            <RequireAuth role="admin">
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<OverviewPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="cohorts" element={<CohortsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="lessons" element={<LessonsPage />} />
          <Route path="activity-logs" element={<ActivityLogsPage />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

import { ToastProvider } from './contexts/ToastContext';

/* SECTION: MAIN APP COMPONENT */
function App() {
  return (
    <ToastProvider>
      <Router>
        <GodModeListener />
        <DeveloperDock />
        <AnimatedRoutes />
      </Router>
    </ToastProvider>
  );
}
  
export default App;