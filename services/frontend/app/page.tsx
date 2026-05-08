import Link from 'next/link';
import { Sparkles, Brain, Radar } from 'lucide-react';
import './home.css';

export default function Home() {
  return (
    <main className="home-layout">
      {/* Hero Section */}
      <section className="hero">
        {/* Decorative V-triangles for playful atmosphere */}
        <div className="dot-triangle large top-right landing-hero"></div>
        <div className="dot-triangle medium top-left landing-hero"></div>
        <div className="dot-triangle small bottom-left landing-hero"></div>
        
        <div className="hero-content">
          <div className="hero-text">
            <h1>Decode Emotions Behind Every Post</h1>
            <p>
              Verbascope is an AI-powered social media analysis platform that detects sarcasm,
              sentiment, and emotional tone—understanding the real meaning in social signals.
            </p>

            <div className="hero-cta">
              <Link href="/auth/login" className="btn btn-primary btn-lg">
                Sign In
              </Link>
              <Link href="/auth/register" className="btn btn-ghost btn-lg">
                Create Account
              </Link>
            </div>

            {/* Features List */}
            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-icon">
                  <Sparkles size={28} strokeWidth={1.5} />
                </div>
                <div className="feature-text">
                  <h3>Sarcasm Detection</h3>
                  <p>Understand when people aren&apos;t saying what they mean.</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <Radar size={28} strokeWidth={1.5} />
                </div>
                <div className="feature-text">
                  <h3>Sentiment Analysis</h3>
                  <p>Decode the emotional tone in real-time.</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <Brain size={28} strokeWidth={1.5} />
                </div>
                <div className="feature-text">
                  <h3>ML Intelligence</h3>
                  <p>Powered by advanced machine learning models.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="hero-visual">
            <div className="visual-card">
              <div className="card-header">
                <div className="avatar">A</div>
                <div className="header-text">
                  <div className="name">Sarah Anderson</div>
                  <div className="timestamp">Just now</div>
                </div>
              </div>

              <div className="card-content">
                <p>Just finished the most boring presentation ever... said nobody who attended 😏</p>
              </div>

              <div className="card-signals">
                <span className="badge badge-yellow">
                  <span className="symbol-sarcasm"></span> SARCASM CUE
                </span>
                <span className="badge badge-red">
                  <span className="symbol-emotion"></span> TONE ALERT
                </span>
              </div>
            </div>

            {/* Floating decoration */}
            <div className="floating-orbs">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="orb" style={{
                  '--delay': `${i * 0.3}s`,
                } as React.CSSProperties}></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>Verbascope — AI-Powered Social Intelligence</p>
      </footer>
    </main>
  );
}
