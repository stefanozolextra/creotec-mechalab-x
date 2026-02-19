/* SECTION: IMPORTS 
   - USE: Loads routing tools, animation libraries, security utilities, and page components.
*/
import type { ReactElement } from 'react';
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
import LessonsPage from './pages/admin/LessonsPage';
import ActivityLogsPage from './pages/admin/ActivityLogsPage';

// Security Utilities
import { getAuthRole, type AuthRole } from './utils/auth';

/* SECTION: ROUTING ARCHITECTURE & SECURITY LOGIC
   - USE: Determines where a user should land based on their role.
*/
const getLandingRoute = (role: AuthRole): '/dashboard' | '/admin/dashboard' => {
  return role === 'admin' ? '/admin/dashboard' : '/dashboard';
};

interface RequireAuthProps {
  children: ReactElement;
  role?: AuthRole;
}

/* SECTION: AUTHENTICATION WRAPPER
   - USE: Protects URLs from unauthorized access.
   - HOW IT WORKS: If a user has no role, they are kicked back to '/login'. 
     If they try to access the wrong role's page, they are redirected to their proper dashboard.
*/
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

/* SECTION: ANIMATION WRAPPER (AnimatedRoutes)
   - USE: Syncs page transitions with URL changes.
   - HOW IT WORKS: 'useLocation' tracks the current path to trigger Framer Motion animations.
*/
const AnimatedRoutes = () => {
  const location = useLocation();
  const currentRole = getAuthRole();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>

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

        {/* SECTION: TRAINEE PROTECTED ROUTES
            - USE: Pages accessible only to students. 
        */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth role="student">
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/module/:id"
          element={
            <RequireAuth role="student">
              <ModuleView />
            </RequireAuth>
          }
        />
        <Route
          path="/simulation/:id"
          element={
            <RequireAuth role="student">
              <SimulationView />
            </RequireAuth>
          }
        />

        {/* SECTION: ADMIN PROTECTED ROUTES
            - USE: Nested layout for the Admin Control Panel.
        */}
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
          <Route path="lessons" element={<LessonsPage />} />
          <Route path="activity-logs" element={<ActivityLogsPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* SECTION: CATCH-ALL (404 BEHAVIOR)
            - USE: If a user types a URL that doesn't exist, kick them to the root logic.
        */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

/* SECTION: MAIN APP COMPONENT */
function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}

export default App;
