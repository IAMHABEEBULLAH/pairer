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
    <header className="site-header market-header">
      <nav className={`nav${open ? ' open' : ''}`} aria-label="Main">
        <Link to="/" className="logo" onClick={close} aria-label="Parer home"><img src="/favicon.svg" alt="" width="32" height="32" /><span>Parer<i>.</i></span></Link>
        <button className="menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
          {open ? '✕' : '☰'}
        </button>
        <div className="nav-links">
          <NavLink to="/" end className={cls} onClick={close}>Home</NavLink>
          <NavLink to="/pros" className={cls} onClick={close}>Services</NavLink>
          <NavLink to="/explore?category=house" className={cls} onClick={close}>Properties</NavLink>
          <NavLink to="/explore?category=car" className={cls} onClick={close}>Vehicles</NavLink>
          <NavLink to="/explore?category=land" className={cls} onClick={close}>Land</NavLink>
          <NavLink to="/jobs" className={cls} onClick={close}>Jobs</NavLink>
          <NavLink to="/explore" className={cls} onClick={close}>More</NavLink>
        </div>
        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/dashboard" className="row small market-user-link" style={{ gap: 8, flexWrap: 'nowrap', textDecoration: 'none' }} onClick={close}>
                <Avatar name={user.name} avatar={user.avatar} size={30} />
                <span>{user.name.split(' ')[0]}</span>
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={onLogout}>Log out</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { close(); openAuth('login'); }}>Log in</button>
              <button className="btn btn-primary btn-sm" onClick={() => { close(); openAuth('register'); }}>Sign up</button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
