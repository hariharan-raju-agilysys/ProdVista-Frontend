import { useState, useEffect } from 'react';

const basePath = import.meta.env.VITE_BASE_PATH || '';

/* ------------------------------------------------------------------ */
/*  Rotating quotes — tech-themed, inspirational, fun                 */
/* ------------------------------------------------------------------ */
const quotes = [
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { text: 'Code is like humor. When you have to explain it, it\'s bad.', author: 'Cory House' },
  { text: 'The best error message is the one that never shows up.', author: 'Thomas Fuchs' },
  { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  { text: 'Any fool can write code that a computer can understand.', author: 'Martin Fowler' },
  { text: 'Programming isn\'t about what you know; it\'s about what you can figure out.', author: 'Chris Pine' },
  { text: 'The only way to go fast, is to go well.', author: 'Robert C. Martin' },
  { text: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.', author: 'Antoine de Saint-Exupéry' },
  { text: 'Every great developer you know got there by solving problems they were unqualified to solve until they actually did it.', author: 'Patrick McKenzie' },
  { text: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein' },
];

/* ------------------------------------------------------------------ */
/*  CSS-only animated astronaut character                              */
/* ------------------------------------------------------------------ */
function AstroCharacter() {
  return (
    <div className="relative w-28 h-36 select-none" aria-hidden="true">
      {/* Floating wrapper */}
      <div
        className="w-full h-full"
        style={{
          animation: 'astroFloat 3s ease-in-out infinite',
        }}
      >
        {/* === Helmet / Head === */}
        <div className="relative mx-auto w-[68px] h-[68px] rounded-[20px] bg-gradient-to-br from-slate-100 via-white to-slate-200 border-2 border-slate-300 shadow-lg">
          {/* Visor */}
          <div className="absolute inset-[6px] rounded-[14px] bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 overflow-hidden">
            {/* Visor glare */}
            <div
              className="absolute top-1 right-1 w-4 h-6 rounded-full bg-white/10"
              style={{ transform: 'rotate(-20deg)' }}
            />
            {/* Eyes */}
            <div className="flex gap-[10px] justify-center pt-[14px]">
              <div
                className="w-[9px] h-[9px] rounded-full bg-cyan-400"
                style={{
                  boxShadow: '0 0 8px rgba(34,211,238,0.7), 0 0 16px rgba(34,211,238,0.3)',
                  animation: 'astroBlink 4s ease-in-out infinite',
                }}
              />
              <div
                className="w-[9px] h-[9px] rounded-full bg-cyan-400"
                style={{
                  boxShadow: '0 0 8px rgba(34,211,238,0.7), 0 0 16px rgba(34,211,238,0.3)',
                  animation: 'astroBlink 4s ease-in-out infinite 0.15s',
                }}
              />
            </div>
            {/* Smile */}
            <div className="mx-auto mt-[6px] w-[14px] h-[6px] border-b-2 border-cyan-400/80 rounded-b-full" />
          </div>
          {/* Antenna */}
          <div className="absolute -top-[10px] left-1/2 -ml-[2px] w-[4px] h-[10px] bg-slate-300 rounded-t-full">
            <div
              className="absolute -top-[5px] left-1/2 -ml-[5px] w-[10px] h-[10px] rounded-full bg-blue-400"
              style={{
                boxShadow: '0 0 10px rgba(96,165,250,0.6)',
                animation: 'antennaPulse 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* === Body === */}
        <div className="relative mx-auto w-[52px] h-[42px] rounded-b-[14px] bg-gradient-to-b from-slate-200 to-slate-300 border-2 border-t-0 border-slate-300">
          {/* Chest indicator */}
          <div
            className="mx-auto mt-[7px] w-[12px] h-[12px] rounded-full bg-gradient-to-br from-cyan-300 to-blue-500"
            style={{
              boxShadow: '0 0 10px rgba(34,211,238,0.5)',
              animation: 'chestPulse 2.5s ease-in-out infinite',
            }}
          />
          {/* Belt */}
          <div className="mx-auto mt-[3px] w-[36px] h-[3px] rounded-full bg-slate-400/50" />
        </div>

        {/* === Left Arm (waving!) === */}
        <div
          className="absolute top-[62px] left-[8px] w-[12px] h-[30px] rounded-full bg-gradient-to-b from-slate-200 to-slate-300 border border-slate-300"
          style={{
            transformOrigin: 'top center',
            animation: 'armWave 2.5s ease-in-out infinite',
          }}
        >
          {/* Glove */}
          <div className="absolute -bottom-[3px] left-1/2 -ml-[5px] w-[10px] h-[10px] rounded-full bg-white border border-slate-300" />
        </div>

        {/* === Right Arm === */}
        <div
          className="absolute top-[62px] right-[8px] w-[12px] h-[30px] rounded-full bg-gradient-to-b from-slate-200 to-slate-300 border border-slate-300"
          style={{ transform: 'rotate(8deg)' }}
        >
          <div className="absolute -bottom-[3px] left-1/2 -ml-[5px] w-[10px] h-[10px] rounded-full bg-white border border-slate-300" />
        </div>

        {/* === Legs === */}
        <div className="flex justify-center gap-[6px] -mt-[1px]">
          <div className="w-[16px] h-[18px] rounded-b-lg bg-gradient-to-b from-slate-300 to-slate-400 border border-t-0 border-slate-300">
            <div className="mt-[10px] w-full h-[8px] rounded-b-lg bg-white/80 border-t border-slate-300" />
          </div>
          <div className="w-[16px] h-[18px] rounded-b-lg bg-gradient-to-b from-slate-300 to-slate-400 border border-t-0 border-slate-300">
            <div className="mt-[10px] w-full h-[8px] rounded-b-lg bg-white/80 border-t border-slate-300" />
          </div>
        </div>
      </div>

      {/* Shadow on ground */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-[6px] rounded-full bg-slate-300/50 blur-[2px]"
        style={{ animation: 'shadowPulse 3s ease-in-out infinite' }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkle particles around the character                            */
/* ------------------------------------------------------------------ */
function Sparkles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {[
        { top: '18%', left: '20%', delay: '0s', size: 3 },
        { top: '25%', right: '22%', delay: '1.2s', size: 2 },
        { top: '60%', left: '15%', delay: '0.6s', size: 2.5 },
        { top: '55%', right: '18%', delay: '1.8s', size: 3 },
        { top: '40%', left: '28%', delay: '2.4s', size: 2 },
        { top: '35%', right: '30%', delay: '0.3s', size: 2 },
      ].map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-blue-400/60"
          style={{
            top: s.top,
            left: s.left,
            right: s.right,
            width: s.size,
            height: s.size,
            animation: `sparkle 3s ease-in-out infinite ${s.delay}`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Branded Splash                                               */
/* ------------------------------------------------------------------ */
interface BrandedSplashProps {
  /** Status message below the character, e.g. "Authenticating..." */
  message?: string;
  /** Sub-message, e.g. "Signing in to Versa" */
  subMessage?: string;
  /** Animated status dots cycling (overrides message when provided) */
  statusDots?: string[];
}

export default function BrandedSplash({ message, subMessage, statusDots }: BrandedSplashProps) {
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * quotes.length));
  const [dotIdx, setDotIdx] = useState(0);
  const [quoteVisible, setQuoteVisible] = useState(true);

  // Rotate quotes every 5s with fade transition
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteVisible(false);
      setTimeout(() => {
        setQuoteIdx((prev) => (prev + 1) % quotes.length);
        setQuoteVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cycle status dots
  useEffect(() => {
    if (!statusDots?.length) return;
    const interval = setInterval(() => setDotIdx((p) => (p + 1) % statusDots.length), 2200);
    return () => clearInterval(interval);
  }, [statusDots]);

  const quote = quotes[quoteIdx];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      <Sparkles />

      {/* Quote at top */}
      <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-full max-w-lg px-6 text-center">
        <div
          className="transition-all duration-400"
          style={{
            opacity: quoteVisible ? 1 : 0,
            transform: quoteVisible ? 'translateY(0)' : 'translateY(-8px)',
          }}
        >
          <p
            className="text-[15px] leading-relaxed text-slate-500 italic"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            "{quote.text}"
          </p>
          <p className="mt-2 text-[11px] font-medium tracking-wider uppercase text-slate-400">
            — {quote.author}
          </p>
        </div>
      </div>

      {/* Animated character */}
      <div className="relative mb-8">
        <AstroCharacter />
      </div>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-6">
        <img
          src={`${basePath}/favicon.svg`}
          alt="ProdVista"
          className="w-9 h-9 rounded-xl shadow-md"
        />
        <span
          className="text-xl font-bold text-gray-900"
          style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif", letterSpacing: '-0.02em' }}
        >
          ProdVista
        </span>
      </div>

      {/* Loading ring */}
      <div className="relative mb-6">
        <div
          className="w-10 h-10 rounded-full border-[3px] border-blue-100"
          style={{
            borderTopColor: '#3b82f6',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>

      {/* Status message */}
      {statusDots ? (
        <div className="h-6 flex items-center">
          <p
            key={dotIdx}
            className="text-sm font-medium text-slate-500"
            style={{
              fontFamily: "'Inter', -apple-system, sans-serif",
              animation: 'fadeSlideIn 0.3s ease-out',
            }}
          >
            {statusDots[dotIdx]}
            <span style={{ animation: 'dotPulse 1.4s ease-in-out infinite' }}>...</span>
          </p>
        </div>
      ) : message ? (
        <p
          className="text-sm text-slate-400"
          style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
        >
          {message}
        </p>
      ) : null}

      {/* Sub-message (e.g. org name) */}
      {subMessage && (
        <p
          className="mt-2 text-xs text-slate-400"
          style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
        >
          {subMessage}
        </p>
      )}

      {/* Keyframe styles — injected once */}
      <style>{`
        @keyframes astroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes astroBlink {
          0%, 42%, 44%, 100% { transform: scaleY(1); }
          43% { transform: scaleY(0.1); }
        }
        @keyframes antennaPulse {
          0%, 100% { opacity: 0.6; transform: scale(0.8) translateX(-50%); }
          50% { opacity: 1; transform: scale(1.1) translateX(-50%); }
        }
        @keyframes chestPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; box-shadow: 0 0 16px rgba(34,211,238,0.7); }
        }
        @keyframes armWave {
          0%, 100% { transform: rotate(-8deg); }
          25% { transform: rotate(-35deg); }
          50% { transform: rotate(-15deg); }
          75% { transform: rotate(-40deg); }
        }
        @keyframes shadowPulse {
          0%, 100% { transform: translateX(-50%) scaleX(1); opacity: 0.4; }
          50% { transform: translateX(-50%) scaleX(0.75); opacity: 0.25; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
