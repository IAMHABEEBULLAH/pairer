import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import Protected from './components/Protected.jsx';
import Home from './pages/Home.jsx';
import Pros from './pages/Pros.jsx';
import ProDetail from './pages/ProDetail.jsx';
import Jobs from './pages/Jobs.jsx';
import JobDetail from './pages/JobDetail.jsx';
import PostJob from './pages/PostJob.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/AuthPages.jsx';

function NotFound() {
  return (
    <div className="wrap page">
      <div className="page-head">
        <h1>We can't find that page</h1>
        <p>The link may be old or mistyped.</p>
      </div>
      <a className="btn btn-primary" href="/">Go to the home page</a>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pros" element={<Pros />} />
          <Route path="/pros/:id" element={<ProDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/post-job" element={<Protected role="customer"><PostJob /></Protected>} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
