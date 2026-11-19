import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TRADES, TRADE_BLURBS } from '../trades.js';
import { useAuthModal } from '../components/AuthModal.jsx';
import { useAuth } from '../auth.jsx';

// Put your own licensed photo at client/public/hero.jpg and it is used automatically.
const FALLBACK_HERO = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85';

const categories = [
  { title: 'Services', detail: 'Find skilled professionals', icon: '🔧', to: '/pros', tone: 'mint' },
  { title: 'Properties', detail: 'Buy, rent or sell homes', icon: '⌂', to: '/explore?category=house', tone: 'sand' },
  { title: 'Vehicles', detail: 'Cars, bikes and more', icon: '🚘', to: '/explore?category=car', tone: 'blue' },
  { title: 'Land', detail: 'Explore land listings', icon: '🌳', to: '/explore?category=land', tone: 'lime' },
  { title: 'Jobs', detail: 'Find your next opportunity', icon: '💼', to: '/jobs', tone: 'peach' },
  { title: 'More', detail: 'Explore the marketplace', icon: '•••', to: '/explore', tone: 'lavender' },
];

export default function Home() {
  const { openAuth } = useAuthModal();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  function search(e) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/pros?q=${encodeURIComponent(term)}` : '/pros');
  }

  return (
    <>
      <section className="market-hero">
        <div className="market-hero-photo" aria-hidden="true" />
        <div className="market-hero-inner wrap">
          <div className="market-copy">
            <span className="market-eyebrow"><span /> YOUR MARKETPLACE, MADE SIMPLE</span>
            <h1>Find services.<br />Buy &amp; sell.<br /><em>Move forward.</em></h1>
            <p className="market-lede">Discover trusted professionals, properties, vehicles, land and job opportunities — all in one place.</p>
            <form className="market-search" onSubmit={search} role="search">
              <span className="market-search-icon" aria-hidden="true">⌕</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are you looking for today?" aria-label="Search Parer" />
              <button className="btn btn-primary" type="submit">Search <span aria-hidden="true">→</span></button>
            </form>
            <div className="market-popular">
              <span>Popular:</span>
              {['Plumber', 'Electrician', 'House for sale', 'Cars', 'Land'].map((item) => (
                <Link key={item} to={item === 'House for sale' ? '/explore?category=house' : item === 'Cars' ? '/explore?category=car' : item === 'Land' ? '/explore?category=land' : `/pros?trade=${encodeURIComponent(item)}`}>{item}</Link>
              ))}
            </div>
            <div className="market-proof">
              <span><b>✓</b> Discover local opportunities</span>
              <span><b>✓</b> Connect with confidence</span>
            </div>
          </div>
          <div className="market-visual">
            <div className="market-photo-frame">
              <img src="/hero.jpg" alt="Contemporary modern home" onError={(e) => { const img = e.currentTarget; if (img.src.includes('unsplash')) { img.style.display = 'none'; return; } img.src = FALLBACK_HERO; }} />
              <div className="market-photo-caption"><span className="caption-dot" /> Explore what’s possible <strong>on Parer</strong></div>
            </div>
            <div className="market-float-card">
              <span className="market-float-icon">✦</span>
              <div><strong>One marketplace.</strong><small>So many ways forward.</small></div>
            </div>
          </div>
        </div>
        <div className="market-hero-glow" aria-hidden="true" />
      </section>

      <section className="market-categories section">
        <div className="wrap">
          <div className="market-section-head">
            <div><span className="market-kicker">EXPLORE PARER</span><h2>What are you here for?</h2></div>
            <Link to="/explore" className="market-text-link">Explore marketplace <span>→</span></Link>
          </div>
          <div className="market-category-grid">
            {categories.map((category) => (
              <Link to={category.to} className="market-category-card" key={category.title}>
                <span className={`market-category-icon ${category.tone}`}>{category.icon}</span>
                <span className="market-category-name">{category.title}</span>
                <span className="market-category-detail">{category.detail}</span>
                <span className="market-category-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="market-how section">
        <div className="wrap">
          <div className="market-section-head">
            <div><span className="market-kicker">MADE FOR EVERYDAY NEEDS</span><h2>Good things start with a connection.</h2></div>
            <p>Whether you’re looking for help or ready to offer what you do best, Parer makes the next step easier.</p>
          </div>
          <div className="market-audience-grid">
            <article className="market-audience-card customer">
              <span className="market-audience-label">FOR CUSTOMERS</span>
              <h3>Find the right help.<br />Without the hassle.</h3>
              <p>Discover skilled professionals, compare their profiles and take the next step with confidence.</p>
              <Link to="/pros" className="btn btn-primary">Find a professional <span>→</span></Link>
              <div className="audience-art" aria-hidden="true">⌂</div>
            </article>
            <article className="market-audience-card pro">
              <span className="market-audience-label">FOR PROFESSIONALS</span>
              <h3>Let your skills<br />open new doors.</h3>
              <p>Build your profile, discover available jobs and help more people find your work.</p>
              {!user && <button className="btn btn-dark" onClick={() => openAuth('register', { role: 'pro' })}>Join as a professional <span>→</span></button>}
              {user?.role === 'pro' && <Link to="/dashboard" className="btn btn-dark">Open my dashboard <span>→</span></Link>}
              {user?.role === 'customer' && <Link to="/post-job" className="btn btn-dark">Post a job <span>→</span></Link>}
              <div className="audience-art" aria-hidden="true">✳</div>
            </article>
          </div>
        </div>
      </section>

      <section className="market-trades section">
        <div className="wrap">
          <div className="market-section-head">
            <div><span className="market-kicker">FIND YOUR EXPERT</span><h2>Skilled people, ready to help.</h2></div>
            <Link to="/pros" className="market-text-link">Browse professionals <span>→</span></Link>
          </div>
          <div className="market-trade-list">
            {TRADES.filter((trade) => TRADE_BLURBS[trade]).slice(0, 8).map((trade) => (
              <Link key={trade} to={`/pros?trade=${encodeURIComponent(trade)}`} className="market-trade-chip">{trade}<span>↗</span></Link>
            ))}
          </div>
        </div>
      </section>

      <section className="market-final-cta">
        <div className="wrap market-final-inner">
          <div><span className="market-kicker">YOUR NEXT STEP STARTS HERE</span><h2>Make your next move<br />with Parer.</h2><p>Join a marketplace built to bring people, skills and opportunities closer.</p></div>
          {!user && <button className="btn btn-light" onClick={() => openAuth('register')}>Get started for free <span>→</span></button>}
          {user?.role === 'pro' && <Link to="/jobs" className="btn btn-light">Find open jobs <span>→</span></Link>}
          {user?.role === 'customer' && <Link to="/post-job" className="btn btn-light">Post a job <span>→</span></Link>}
        </div>
      </section>
    </>
  );
}
