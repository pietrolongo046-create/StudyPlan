import { useEffect, useState } from 'react';
import api from '../api';

/**
 * Privacy Shield — blur overlay when window loses focus.
 */
export default function PrivacyShield() {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    if (api.onBlur) {
      api.onBlur((val) => setBlurred(val));
    }
  }, []);

  if (!blurred) return null;

  return (
    <div
      className="privacy-shield animate-fade-in"
      onClick={() => setBlurred(false)}
    >
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4"
             style={{ animation: 'pulse 2s infinite' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8070d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Protetto</h2>
        <p className="text-xs text-white/50 mt-2">Clicca per sbloccare</p>
      </div>
    </div>
  );
}
