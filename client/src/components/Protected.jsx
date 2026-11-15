import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Sends logged-out visitors to log in, then back to where they were going.
export default function Protected({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="wrap page"><div className="skeleton" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) {
    return (
      <div className="wrap page">
        <div className="page-head">
          <h1>This page is for {role === 'customer' ? 'customers' : 'professionals'}</h1>
          <p>You are signed in as a {user.role === 'pro' ? 'professional' : 'customer'}.</p>
        </div>
      </div>
    );
  }
  return children;
}
