import React from 'react';
import { useEffect } from 'react';
import { useAuth } from '../auth.jsx';
import { useAuthModal } from './AuthModal.jsx';

// Logged-out visitors get the login popup on top of this page; once signed in the page appears.
export default function Protected({ role, children }) {
  const { user, loading } = useAuth();
  const { openAuth } = useAuthModal();
  useEffect(() => { if (!loading && !user) openAuth('login'); }, [loading, user, openAuth]);

  if (loading) return <div className="wrap page"><div className="skeleton" /></div>;
  if (!user) {
    return (
      <div className="wrap page">
        <div className="page-head"><h1>Please log in</h1><p>You need an account to see this page.</p></div>
        <button className="btn btn-primary" onClick={() => openAuth('login')}>Log in or sign up</button>
      </div>
    );
  }
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
