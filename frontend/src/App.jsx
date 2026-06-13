import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';
import { HealthProvider } from './store/HealthContext';
import Landing from './pages/Landing';
import UserDashboard from './pages/UserDashboard';
import HospitalsPage from './pages/HospitalsPage';
import Consultation from './pages/Consultation';
import Report from './pages/Report';
import Emergency from './pages/Emergency';
import Appointments from './pages/Appointments';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import MapPage from './pages/MapPage';
import MedicalCardPage from './pages/MedicalCardPage';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import GlobalCopilot from './components/GlobalCopilot';
import './App.css';

// Higher-order component for public-only routes (login, signup)
const PublicRoute = ({ children }) => {
  const { isLoggedIn, isLoading } = useUserStore();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : children;
};

function App() {
  const { isLoggedIn, isLoading, checkSession } = useUserStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <HealthProvider>
      <Router>
        <Routes>
          {/* Marketing Landing with auto-redirect */}
          <Route 
            path="/" 
            element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Landing />} 
          />
          
          {/* Auth routes - only accessible if NOT logged in */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          
          {/* User Dashboard - Protected */}
          <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />

          {/* Hospitals Page - Protected */}
          <Route path="/hospitals" element={<ProtectedRoute><HospitalsPage /></ProtectedRoute>} />

          {/* Map Page - Protected */}
          <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />

          {/* Consultation Page - Protected */}
          <Route path="/consultation" element={<ProtectedRoute><Consultation /></ProtectedRoute>} />

          {/* Report Page - Protected */}
          <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />

          {/* Emergency Page - Protected */}
          <Route path="/emergency" element={<ProtectedRoute><Emergency /></ProtectedRoute>} />

          {/* Profile Page - Protected */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Appointments Page - Protected */}
          <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
          
          {/* Public Medical Card Scan Lookup */}
          <Route path="/medical-card/:qrId" element={<MedicalCardPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GlobalCopilot />
      </Router>
    </HealthProvider>
  );
}

export default App;
