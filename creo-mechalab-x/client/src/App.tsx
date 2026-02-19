import type { ReactElement } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminLayout from './components/admin/AdminLayout';
import OverviewPage from './pages/admin/OverviewPage';
import UsersPage from './pages/admin/UsersPage';
import ReportsPage from './pages/admin/ReportsPage';
import ActivityLogsPage from './pages/admin/ActivityLogsPage';
import { getAuthRole, type AuthRole } from './utils/auth';

const getLandingRoute = (role: AuthRole): '/dashboard' | '/admin' => {
  return role === 'admin' ? '/admin' : '/dashboard';
};

interface RequireAuthProps {
  children: ReactElement;
  role?: AuthRole;
}

const RequireAuth = ({ children, role }: RequireAuthProps) => {
  const currentRole = getAuthRole();
  if (!currentRole) {
    return <Navigate to="/login" replace />;
  }

  if (role && currentRole !== role) {
    return <Navigate to={getLandingRoute(currentRole)} replace />;
  }

  return children;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const currentRole = getAuthRole();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
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
        <Route
          path="/dashboard"
          element={
            <RequireAuth role="student">
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth role="admin">
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="activity-logs" element={<ActivityLogsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}

export default App;
