/* SECTION: IMPORTS 
   - USE: Loads routing tools, animation libraries, and page components[cite: 32].
   - EDIT: Add new imports here when you create new features or pages.
   - IF REMOVED: The app will fail to compile as it won't find the necessary files.
*/
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';

/* SECTION: ANIMATION WRAPPER (AnimatedRoutes)
   - USE: Syncs page transitions with URL changes.
   - HOW IT WORKS: 'useLocation' tracks the current path to trigger Framer Motion animations.
   - IF REWRITTEN: Transitions will become instant/abrupt rather than fluid.
   - HOW TO EDIT: Adjust 'mode' to change how pages exit and enter.
*/
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      {/* SECTION: ROUTE DEFINITIONS
          - [cite_start]USE: Defines the app structure and URLs[cite: 20, 107].
          - HOW IT WORKS: Maps a specific URL path to a React component.
          - HOW TO EDIT: Add a new <Route /> tag here to add a new page to the app.
      */}
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </AnimatePresence>
  );
};

/* SECTION: MAIN APP COMPONENT
   - USE: The root entry point of the frontend.
   - HOW IT WORKS: Wraps the app in a Router to enable browser navigation.
   - IF REWRITTEN: Navigation links and redirects will stop functioning globally.
*/
function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}

export default App;