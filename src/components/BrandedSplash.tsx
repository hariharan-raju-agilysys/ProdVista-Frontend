import { useState, useEffect } from 'react';

const basePath = import.meta.env.VITE_BASE_PATH || '';



/* ------------------------------------------------------------------ */
/*  Enterprise loading screen — clean, light, product-standard        */
/* ------------------------------------------------------------------ */
interface BrandedSplashProps {
  message?: string;
  subMessage?: string;
  statusDots?: string[];
}

export default function BrandedSplash({ message, subMessage, statusDots }: BrandedSplashProps) {
  const [dotIdx, setDotIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!statusDots?.length) return;
    const interval = setInterval(() => setDotIdx(p => (p + 1) % statusDots.length), 2200);
    return () => clearInterval(interval);
  }, [statusDots]);

  const steps = statusDots || (message ? [message] : ['Loading workspace']);

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: '#f8fafc' }}
    >
      {/* ── NProgress-style top bar ── */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-[9999] overflow-hidden" style={{ background: '#e0e7ff' }}>
        <div
          style={{
            position: 'absolute',
            height: '100%',
            width: '55%',
            borderRadius: 9999,
            background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 60%, #8b5cf6 100%)',
            animation: 'pvTopBar 2s cubic-bezier(0.4,0,0.2,1) infinite',
          }}
        />
      </div>

      {/* ── Center content ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className="flex flex-col items-center"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.35s ease-out, transform 0.35s ease-out',
          }}
        >
          {/* Logo + wordmark */}
          <div className="flex items-center gap-3 mb-10">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                boxShadow: '0 4px 20px rgba(99,102,241,0.28)',
              }}
            >
              <img src={`${basePath}/favicon.svg`} alt="ProdVista" className="w-7 h-7" />
            </div>
            <span className="text-[22px] font-bold tracking-tight text-gray-900" style={{ letterSpacing: '-0.3px' }}>
              ProdVista
            </span>
          </div>

          {/* Step indicators */}
          <div className="flex flex-col items-start gap-3 mb-8" style={{ minWidth: 220 }}>
            {steps.map((step, i) => {
              const isActive = i === dotIdx;
              const isDone = i < dotIdx;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{
                    opacity: isActive ? 1 : isDone ? 0.5 : 0.22,
                    transition: 'opacity 0.4s ease',
                  }}
                >
                  {/* Dot / check */}
                  <div
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                        : isDone ? '#d1fae5' : '#e5e7eb',
                      transition: 'background 0.4s ease',
                    }}
                  >
                    {isDone ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : isActive ? (
                      <div className="w-2 h-2 rounded-full bg-white" style={{ animation: 'pvDotPulse 1.2s ease-in-out infinite' }} />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: isActive ? '#1e40af' : isDone ? '#6b7280' : '#9ca3af',
                      transition: 'color 0.4s ease',
                    }}
                  >
                    {step}
                    {isActive && (
                      <span className="ml-0.5 text-blue-400" style={{ animation: 'pvBlink 1.2s steps(3, end) infinite' }}>
                        ...
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Thin shimmer bar */}
          <div className="w-48 rounded-full overflow-hidden" style={{ height: 3, background: '#e5e7eb' }}>
            <div
              style={{
                height: '100%',
                width: '52%',
                borderRadius: 9999,
                background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                animation: 'pvBarSlide 1.7s ease-in-out infinite',
              }}
            />
          </div>

          {/* Sub-message */}
          {subMessage && (
            <p className="mt-5 text-xs font-medium text-gray-400" style={{ letterSpacing: '0.02em' }}>
              {subMessage}
            </p>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-center gap-2.5 pb-8 text-[11px] text-gray-300 font-medium tracking-wide select-none">
        <span>© {new Date().getFullYear()} ProdVista</span>
        <span>·</span>
        <span>Secured by Microsoft Azure</span>
      </div>

      <style>{`
        @keyframes pvTopBar {
          0%   { left: -60%; }
          100% { left: 130%; }
        }
        @keyframes pvBarSlide {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(310%); }
        }
        @keyframes pvDotPulse {
          0%, 100% { transform: scale(1);    opacity: 1;   }
          50%       { transform: scale(0.55); opacity: 0.5; }
        }
        @keyframes pvBlink {
          0%   { opacity: 0.2; }
          50%  { opacity: 1;   }
          100% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
