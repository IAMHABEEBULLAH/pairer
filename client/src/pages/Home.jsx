import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TRADES, TRADE_BLURBS } from '../trades.js';

export default function Home() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  function search(e) {
    e.preventDefault();
    navigate(q.trim() ? `/pros?q=${encodeURIComponent(q.trim())}` : '/pros');
  }

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="tag-outline">Verified local pros</span>
            <h1>Find people who <span>actually show up.</span></h1>
            <p className="hero-sub">
              Electricians, plumbers, carpenters, tutors and more, right in your neighbourhood. Describe the problem, compare quotes, and hire with confidence.
            </p>
            <form className="search-bar" onSubmit={search} role="search">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What needs fixing?" aria-label="Search professionals" />
              <button className="btn btn-primary" type="submit">Find a pro</button>
            </form>
            <div className="chips">
              {['Plumber', 'Electrician', 'Carpenter', 'Mechanic', 'Cleaner'].map((t) => (
                <Link key={t} className="chip" to={`/pros?trade=${t}`}>{t}</Link>
              ))}
            </div>
            <div className="trust"><span>✓ Real reviews</span><span>✓ Compare quotes</span><span>✓ Pay only for finished work</span></div>
          </div>

          <div className="board" aria-label="Trades on Parer">
            <div className="board-title">Skilled professionals near you</div>
            <div className="board-grid">
              {TRADES.filter((t) => TRADE_BLURBS[t]).slice(0, 7).map((t) => (
                <Link key={t} to={`/pros?trade=${t}`} className="tile">
                  <b>{t}</b>
                  <span>{TRADE_BLURBS[t]}</span>
                </Link>
              ))}
              <Link to="/pros" className="tile more">+ more trades</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Three steps from problem to done</h2>
          <div className="steps">
            <div className="step"><h3>Describe it</h3><p className="muted">Tell Parer what is wrong in your own words. The job assistant works out which trade you need.</p></div>
            <div className="step"><h3>Compare quotes</h3><p className="muted">Professionals nearby send you a price. See their ratings and past work before you choose.</p></div>
            <div className="step"><h3>Hire and review</h3><p className="muted">Accept a quote, get the work done, then leave a review so the next person can trust it.</p></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap hero-grid" style={{ alignItems: 'center' }}>
          <div>
            <h2>Not sure who you need? Just say it.</h2>
            <p className="muted" style={{ maxWidth: '46ch' }}>
              Type the problem the way you would tell a friend. Parer suggests the right trade and a plain-language summary, then you post the job in one step.
            </p>
            <Link to="/post-job" className="btn btn-dark" style={{ marginTop: 22 }}>Post a job</Link>
          </div>
          <div className="chat" aria-hidden="true">
            <div className="bubble me">My kitchen tap won't stop dripping and the floor is wet.</div>
            <div className="bubble bot"><b>Sounds like a plumber.</b><br />Probably a worn washer or a loose fitting. Usually a short visit.</div>
          </div>
        </div>
      </section>

      <div className="split">
        <div>
          <span className="pill line">For households and businesses</span>
          <h3>Stop asking around for a number that might not answer.</h3>
          <ul>
            <li>Describe the job once, get quotes from nearby pros</li>
            <li>See ratings and finished jobs before you commit</li>
            <li>Agree the price before anyone shows up</li>
          </ul>
          <Link to="/post-job" className="btn btn-primary">Post a job</Link>
        </div>
        <div>
          <span className="pill line">For skilled professionals</span>
          <h3>Turn your skill into a business people can find.</h3>
          <ul>
            <li>Build a profile that proves your work, not just your word</li>
            <li>See real jobs near you and send quotes</li>
            <li>Collect reviews and grow through repeat customers</li>
          </ul>
          <Link to="/register?role=pro" className="btn btn-dark">Join as a pro</Link>
        </div>
      </div>

      <section className="cta-band">
        <div className="wrap">
          <h2>Building the digital infrastructure for skilled work.</h2>
          <Link to="/register" className="btn btn-primary">Create a free account</Link>
          <div className="roadmap">
            <span className="pill lime">Now: Find and hire</span>
            <span className="pill line" style={{ color: 'var(--paper)', borderColor: 'var(--paper)' }}>Next: Payments and contracts</span>
            <span className="pill line" style={{ color: 'var(--paper)', borderColor: 'var(--paper)' }}>Then: Training and certification</span>
            <span className="pill line" style={{ color: 'var(--paper)', borderColor: 'var(--paper)' }}>Later: Workforce insights</span>
          </div>
        </div>
      </section>
    </>
  );
}
