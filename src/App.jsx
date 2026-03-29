import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import PermissionGate from './components/common/PermissionGate';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MyFleet from './pages/MyFleet';
import AddVehicle from './pages/AddVehicle';
import AddClient from './pages/AddClient';
import RtoDetails from './pages/RtoDetails';
import Challans from './pages/Challans';
import Profile from './pages/Profile';
import UserActivity from './pages/UserActivity';
import Reports from './pages/Reports';
import VehicleSettings from './pages/VehicleSettings';
import Groups from './pages/Groups';
import SharePlayer from './pages/SharePlayer';
import Alerts from './pages/Alerts';
import Notifications from './pages/Notifications';
import Support from './pages/Support';
import Geofence from './pages/Geofence';
import MyClients from './pages/MyClients';
import ClientDetail from './pages/ClientDetail';
import MasterSettings from './pages/MasterSettings';
const Debug = React.lazy(() => import('./pages/Debug'));

const G = ({ p, role, children }) => (
  <PermissionGate permission={p} role={role}>{children}</PermissionGate>
);

// Show Login at root, or redirect to dashboard if already authenticated
const RootRedirect = () => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return token ? <Navigate to="/dashboard" replace /> : <Login />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing page — Login at root */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/register" element={<Register />} />

          {/* Public share player — no auth required */}
          <Route path="/share/:token" element={<SharePlayer />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="dashboard"        element={<Dashboard />} />
            <Route path="my-fleet"         element={<G p="canTrackVehicle"><MyFleet /></G>} />
            <Route path="groups"           element={<G p="canManageGroups"><Groups /></G>} />
            <Route path="geofences"        element={<G p="canManageGeofences"><Geofence /></G>} />
            <Route path="alerts"           element={<G p="canSetAlerts"><Alerts /></G>} />
            <Route path="notifications"    element={<G p="canViewNotifications"><Notifications /></G>} />
            <Route path="add-vehicle"      element={<G p="canAddVehicle"><AddVehicle /></G>} />
            <Route path="rto-details"      element={<G p="canViewRTO"><RtoDetails /></G>} />
            <Route path="challans"         element={<G p="canViewChallans"><Challans /></G>} />
            <Route path="reports"          element={<G p="canViewReports"><Reports /></G>} />
            <Route path="my-clients"        element={<G role="dealer_or_papa"><MyClients /></G>} />
            <Route path="my-clients/:id"   element={<G role="dealer_or_papa"><ClientDetail /></G>} />
            <Route path="add-client"       element={<G role="dealer_or_papa" p="canAddClient"><AddClient /></G>} />
            <Route path="master-settings"  element={<G role="papa"><MasterSettings /></G>} />
            {/* Always accessible */}
            <Route path="support"          element={<Support />} />
            <Route path="vehicle-settings" element={<VehicleSettings />} />
            <Route path="profile"          element={<Profile />} />
            <Route path="user-activity"    element={<UserActivity />} />
            <Route path="debug"            element={<ProtectedRoute><Suspense fallback={<div>Loading...</div>}><Debug /></Suspense></ProtectedRoute>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </AuthProvider>
  );
}

export default App;
