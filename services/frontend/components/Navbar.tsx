'use client';

import Link from 'next/link';
import { Activity } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  return (
    <nav className="navbar">
      <Link href="/feed" className="navbar-logo">
        <svg className="v-mark" viewBox="0 0 42 42" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="4,6 21,36 38,6 32,6 21,26 10,6" />
        </svg>
        <div>
          <span className="v-logo-name">Verbascope</span>
          <span className="v-logo-sub">Social · Intelligence</span>
        </div>
      </Link>

      <div className="navbar-center">
        <div className="live-indicator">
          <span className="pulse-dot"></span>
          <span>Live Feed</span>
        </div>
      </div>

      <div className="navbar-end">
        <button className="btn btn-ghost navbar-icon-btn">
          <Activity size={18} strokeWidth={1.5} />
        </button>
      </div>
    </nav>
  );
}
