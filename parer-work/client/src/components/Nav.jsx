import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Avatar from './Avatar.jsx';
import { useAuthModal } from './AuthModal.jsx';

export default function Nav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { openAuth } = useAuthModal();
  const close = () => setOpen(false);
  const cls = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  async function onLogout() {
    close();
    await logout();
    navigate('/');
  }

  return (
    <header className="site-header">
      <nav className={`nav${open ? ' open' : ''}`} aria-label="Main">
        <Link to="/" className="logo" onClick={close} aria-label="Parer home"><img src="/favicon.svg" alt="" width="30" height="30" /><span>parer<i>.</i></span></Link>
        <button className="menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
          {open ? '✕' : '☰'}
        </button>
        <div className="nav-links">
          <NavLink to="/pros" className={cls} onClick={close}>Find a pro</NavLink>
          <NavLink to="/jobs" className={cls} onClick={close}>Open jobs</NavLink>
          <NavLink to="/explore" className={cls} onClick={close}>Explore</NavLink>
          {(!user || user.role === 'customer') && <NavLink to="/post-job" className={cls} onClick={close}>Post a job</NavLink>}
          {user && <NavLink to="/dashboard" className={cls} onClick={close}>{user.role === 'pro' ? 'My work' : 'My jobs'}</NavLink>}
        </div>
        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/dashboard" className="row small" style={{ gap: 8, flexWrap: 'nowrap', textDecoration: 'none' }} onClick={close}>
                <Avatar name={user.name} avatar={user.avatar} size={30} />
                <span>{user.name.split(' ')[0]}</span>
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={onLogout}>Log out</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { close(); openAuth('login'); }}>Log in</button>
              <button className="btn btn-primary btn-sm" onClick={() => { close(); openAuth('register'); }}>Get started</button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
