import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
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

  return children;
}
