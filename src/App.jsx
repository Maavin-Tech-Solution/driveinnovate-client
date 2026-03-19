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
// import React, { Suspense } from 'react';
const Debug = React.lazy(() => import('./pages/Debug'));

// Component to handle root redirect
const RootRedirect = () => {
  const { token, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }
  
  return <Navigate to={token ? "/dashboard" : "/login"} replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="my-fleet" element={<MyFleet />} />
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

          {/* Fallback - redirect based on auth status */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </AuthProvider>
  );
}

export default App;
