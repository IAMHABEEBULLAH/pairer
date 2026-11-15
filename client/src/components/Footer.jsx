import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap row">
        <div>
          <div className="logo">parer<i>.</i></div>
          <p className="small" style={{ opacity: 0.8, marginTop: 6 }}>Built for communities, one trade at a time.</p>
        </div>
        <div className="row small">
          <Link to="/pros">Find a pro</Link>
          <Link to="/jobs">Open jobs</Link>
          <Link to="/register">Join as a pro</Link>
        </div>
      </div>
    </footer>
  );
}
