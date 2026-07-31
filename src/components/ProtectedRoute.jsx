import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';

export default function ProtectedRoute({ children, requireDevice = true }) {
  const { user, loading: authLoading } = useAuth();
  const { hasPairedDevice, loading: deviceLoading } = useDevice();

  if (authLoading || (user && deviceLoading)) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div className="spinner spinner-lg" style={{ color: 'var(--clr-accent)' }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requireDevice && !hasPairedDevice) {
    return <Navigate to="/pair" replace />;
  }

  return children;
}
