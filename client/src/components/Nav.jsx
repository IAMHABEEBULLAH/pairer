import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Nav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
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
        <Link to="/" className="logo" onClick={close}>parer<i>.</i></Link>
        <button className="menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
          {open ? '✕' : '☰'}
        </button>
        <div className="nav-links">
          <NavLink to="/pros" className={cls} onClick={close}>Find a pro</NavLink>
          <NavLink to="/jobs" className={cls} onClick={close}>Open jobs</NavLink>
          {(!user || user.role === 'customer') && <NavLink to="/post-job" className={cls} onClick={close}>Post a job</NavLink>}
          {user && <NavLink to="/dashboard" className={cls} onClick={close}>{user.role === 'pro' ? 'My work' : 'My jobs'}</NavLink>}
        </div>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="small muted">{user.name.split(' ')[0]}</span>
              <button className="btn btn-ghost btn-sm" onClick={onLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm" onClick={close}>Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={close}>Get started</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
