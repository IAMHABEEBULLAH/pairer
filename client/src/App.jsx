import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
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
import { ForgotPassword, ResetPassword } from './pages/AuthPages.jsx';
import { useAuthModal } from './components/AuthModal.jsx';

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

// Old /login and /register links now open the popup over the home page.
function OpenAuth({ mode }) {
  const { openAuth } = useAuthModal();
  const [params] = useSearchParams();
  useEffect(() => { openAuth(mode, { role: params.get('role') }); }, [mode, openAuth, params]);
  return <Navigate to="/" replace />;
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
          <Route path="/login" element={<OpenAuth mode="login" />} />
          <Route path="/register" element={<OpenAuth mode="register" />} />
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
