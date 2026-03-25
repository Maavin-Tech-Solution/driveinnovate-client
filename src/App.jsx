import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
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
// import React, { Suspense } from 'react';
const Debug = React.lazy(() => import('./pages/Debug'));

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
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="my-fleet" element={<MyFleet />} />
            <Route path="groups" element={<Groups />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="support" element={<Support />} />
            <Route path="add-vehicle" element={<AddVehicle />} />
            <Route path="add-client" element={<AddClient />} />
            <Route path="rto-details" element={<RtoDetails />} />
            <Route path="challans" element={<Challans />} />
            <Route path="reports" element={<Reports />} />
            <Route path="profile" element={<Profile />} />
            <Route path="user-activity" element={<UserActivity />} />
            <Route path="vehicle-settings" element={<VehicleSettings />} />
            <Route path="debug" element={<ProtectedRoute><Suspense fallback={<div>Loading...</div>}><Debug /></Suspense></ProtectedRoute>} />
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
