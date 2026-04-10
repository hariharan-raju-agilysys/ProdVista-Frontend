import { useState, useEffect, useMemo } from 'react';

const basePath = import.meta.env.VITE_BASE_PATH || '';

/* ------------------------------------------------------------------ */
/*  Rotating quotes — bottom-center (Slack-style)                     */
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
/*  Particle constellation background (nodes + connecting lines)      */
/* ------------------------------------------------------------------ */
const PARTICLE_COUNT = 40;

function useParticles() {
  return useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.5 + Math.random() * 2.5,
      duration: 20 + Math.random() * 30,
      delay: -(Math.random() * 40),
      driftX: (Math.random() - 0.5) * 30,
      driftY: (Math.random() - 0.5) * 30,
      opacity: 0.15 + Math.random() * 0.35,
    })),
  []);
}

function ParticleNetwork() {
  const particles = useParticles();
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `rgba(99, 179, 237, ${p.opacity})`,
            boxShadow: `0 0 ${p.size * 3}px rgba(99, 179, 237, ${p.opacity * 0.5})`,
            animation: `particleDrift ${p.duration}s ease-in-out infinite ${p.delay}s`,
            ['--drift-x' as string]: `${p.driftX}px`,
            ['--drift-y' as string]: `${p.driftY}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Aurora gradient blobs — animated background glow                  */
/* ------------------------------------------------------------------ */
function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Primary aurora blob */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.07]"
        style={{
          background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
          left: '10%',
          top: '10%',
          animation: 'auroraMove1 20s ease-in-out infinite',
          filter: 'blur(60px)',
        }}
      />
      {/* Secondary aurora blob */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
          right: '5%',
          bottom: '15%',
          animation: 'auroraMove2 25s ease-in-out infinite',
          filter: 'blur(80px)',
        }}
      />
      {/* Tertiary accent */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'auroraMove3 18s ease-in-out infinite',
          filter: 'blur(70px)',
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Core orb with orbital rings                                       */
/* ------------------------------------------------------------------ */
function ProcessingOrb() {
  return (
    <div className="relative w-44 h-44 select-none" aria-hidden="true">
      {/* Outer glow pulse */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
          animation: 'orbGlow 3s ease-in-out infinite',
        }}
      />

      {/* Orbital ring 1 — tilted, slow */}
      <div
        className="absolute inset-2"
        style={{
          animation: 'orbitSpin1 8s linear infinite',
          transformStyle: 'preserve-3d',
          transform: 'rotateX(65deg) rotateY(10deg)',
        }}
      >
        <div className="w-full h-full rounded-full border border-blue-400/20" />
        {/* Orbiting dot */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-400"
          style={{ boxShadow: '0 0 10px rgba(59,130,246,0.8), 0 0 20px rgba(59,130,246,0.4)' }}
        />
      </div>

      {/* Orbital ring 2 — different tilt, medium speed */}
      <div
        className="absolute inset-5"
        style={{
          animation: 'orbitSpin2 6s linear infinite',
          transformStyle: 'preserve-3d',
          transform: 'rotateX(72deg) rotateY(-20deg)',
        }}
      >
        <div className="w-full h-full rounded-full border border-cyan-400/15" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400"
          style={{ boxShadow: '0 0 8px rgba(6,182,212,0.8), 0 0 16px rgba(6,182,212,0.3)' }}
        />
      </div>

      {/* Orbital ring 3 — fast, tight */}
      <div
        className="absolute inset-9"
        style={{
          animation: 'orbitSpin3 4.5s linear infinite',
          transformStyle: 'preserve-3d',
          transform: 'rotateX(60deg) rotateY(30deg)',
        }}
      >
        <div className="w-full h-full rounded-full border border-violet-400/15" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-400"
          style={{ boxShadow: '0 0 8px rgba(167,139,250,0.8)' }}
        />
      </div>

      {/* Central core sphere */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-16 h-16 rounded-full relative"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #60a5fa 0%, #3b82f6 40%, #1d4ed8 80%, #1e3a5f 100%)',
            boxShadow: '0 0 30px rgba(59,130,246,0.4), 0 0 60px rgba(59,130,246,0.15), inset 0 -4px 12px rgba(0,0,0,0.2)',
            animation: 'corePulse 3s ease-in-out infinite',
          }}
        >
          {/* Surface highlight */}
          <div
            className="absolute top-1.5 left-2 w-6 h-4 rounded-full bg-white/25"
            style={{ filter: 'blur(3px)' }}
          />
          {/* Inner pulse ring */}
          <div
            className="absolute inset-0 rounded-full border border-blue-300/30"
            style={{ animation: 'innerRingPulse 2s ease-in-out infinite' }}
          />
        </div>
      </div>

      {/* Scanning sweep line */}
      <div
        className="absolute inset-0"
        style={{ animation: 'scanSweep 4s linear infinite' }}
      >
        <div
          className="absolute top-1/2 left-1/2 h-[1px] origin-left"
          style={{
            width: '50%',
            background: 'linear-gradient(90deg, rgba(59,130,246,0.4) 0%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rising data particles (the "processing" effect)                   */
/* ------------------------------------------------------------------ */
function DataStream() {
  const streams = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: 15 + Math.random() * 70,
      size: 2 + Math.random() * 3,
      duration: 4 + Math.random() * 6,
      delay: Math.random() * 8,
      opacity: 0.1 + Math.random() * 0.25,
    })),
  []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {streams.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            bottom: '-5%',
            width: s.size,
            height: s.size,
            background: `rgba(147, 197, 253, ${s.opacity})`,
            boxShadow: `0 0 ${s.size * 2}px rgba(147, 197, 253, ${s.opacity * 0.6})`,
            animation: `dataRise ${s.duration}s ease-out infinite ${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Perspective grid floor                                            */
/* ------------------------------------------------------------------ */
function GridFloor() {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-[35%] overflow-hidden pointer-events-none opacity-[0.04]"
      aria-hidden="true"
      style={{
        perspective: '500px',
        perspectiveOrigin: '50% 0%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          transform: 'rotateX(55deg)',
          transformOrigin: 'bottom center',
          animation: 'gridScroll 10s linear infinite',
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Branded Splash                                               */
/* ------------------------------------------------------------------ */
interface BrandedSplashProps {
  message?: string;
  subMessage?: string;
  statusDots?: string[];
}

export default function BrandedSplash({ message, subMessage, statusDots }: BrandedSplashProps) {
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * quotes.length));
  const [dotIdx, setDotIdx] = useState(0);
  const [quoteVisible, setQuoteVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteVisible(false);
      setTimeout(() => {
        setQuoteIdx((prev) => (prev + 1) % quotes.length);
        setQuoteVisible(true);
      }, 400);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!statusDots?.length) return;
    const interval = setInterval(() => setDotIdx((p) => (p + 1) % statusDots.length), 2200);
    return () => clearInterval(interval);
  }, [statusDots]);

  const quote = quotes[quoteIdx];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #0c1222 0%, #0f172a 30%, #111827 60%, #0c1222 100%)',
      }}
    >
      {/* Animated aurora gradient blobs */}
      <AuroraBackground />

      {/* Perspective grid floor */}
      <GridFloor />

      {/* Floating constellation particles */}
      <ParticleNetwork />

      {/* Rising data stream particles */}
      <DataStream />

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* === Central content === */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Processing orb with orbital rings */}
        <ProcessingOrb />

        {/* Logo + wordmark */}
        <div className="flex items-center gap-3 mt-8 mb-5">
          <img
            src={`${basePath}/favicon.svg`}
            alt="ProdVista"
            className="w-9 h-9 rounded-xl"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.3))',
            }}
          />
          <span
            className="text-[22px] font-bold text-white/90 tracking-tight"
            style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif" }}
          >
            ProdVista
          </span>
        </div>

        {/* Status message */}
        <div className="h-6 flex items-center mb-2">
          {statusDots ? (
            <p
              key={dotIdx}
              className="text-sm font-medium text-blue-300/80"
              style={{
                fontFamily: "'Inter', -apple-system, sans-serif",
                animation: 'fadeSlideIn 0.3s ease-out',
              }}
            >
              {statusDots[dotIdx]}
              <span style={{ animation: 'dotPulse 1.4s ease-in-out infinite' }}>...</span>
            </p>
          ) : message ? (
            <p
              className="text-sm text-slate-400/80"
              style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
            >
              {message}
            </p>
          ) : null}
        </div>

        {/* Sub-message */}
        {subMessage && (
          <p
            className="text-xs text-slate-500/70"
            style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
          >
            {subMessage}
          </p>
        )}

        {/* Minimal progress bar */}
        <div className="mt-6 w-48 h-[2px] rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
              animation: 'progressSweep 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* === Quote at bottom-center (Slack-style) === */}
      <div className="absolute bottom-[7%] left-1/2 -translate-x-1/2 w-full max-w-md px-8 text-center z-10">
        <div
          className="transition-all duration-500"
          style={{
            opacity: quoteVisible ? 1 : 0,
            transform: quoteVisible ? 'translateY(0)' : 'translateY(6px)',
          }}
        >
          <p className="text-[13px] leading-relaxed text-slate-400/60 italic">
            "{quote.text}"
          </p>
          <p className="mt-1.5 text-[10px] font-medium tracking-widest uppercase text-slate-500/40">
            {quote.author}
          </p>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes particleDrift {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(var(--drift-x), calc(var(--drift-y) * -1)); }
          50% { transform: translate(calc(var(--drift-x) * -0.5), var(--drift-y)); }
          75% { transform: translate(calc(var(--drift-x) * 0.7), calc(var(--drift-y) * -0.3)); }
        }
        @keyframes auroraMove1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, 40px) scale(1.1); }
          66% { transform: translate(-30px, 60px) scale(0.9); }
        }
        @keyframes auroraMove2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, -30px) scale(1.15); }
          66% { transform: translate(40px, -50px) scale(0.95); }
        }
        @keyframes auroraMove3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.3); }
        }
        @keyframes orbitSpin1 {
          from { transform: rotateX(65deg) rotateY(10deg) rotateZ(0deg); }
          to { transform: rotateX(65deg) rotateY(10deg) rotateZ(360deg); }
        }
        @keyframes orbitSpin2 {
          from { transform: rotateX(72deg) rotateY(-20deg) rotateZ(0deg); }
          to { transform: rotateX(72deg) rotateY(-20deg) rotateZ(-360deg); }
        }
        @keyframes orbitSpin3 {
          from { transform: rotateX(60deg) rotateY(30deg) rotateZ(0deg); }
          to { transform: rotateX(60deg) rotateY(30deg) rotateZ(360deg); }
        }
        @keyframes orbGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes corePulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(59,130,246,0.4), 0 0 60px rgba(59,130,246,0.15), inset 0 -4px 12px rgba(0,0,0,0.2); }
          50% { transform: scale(1.04); box-shadow: 0 0 40px rgba(59,130,246,0.5), 0 0 80px rgba(59,130,246,0.2), inset 0 -4px 12px rgba(0,0,0,0.2); }
        }
        @keyframes innerRingPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes scanSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes dataRise {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-110vh) scale(0.3); opacity: 0; }
        }
        @keyframes gridScroll {
          0% { background-position: 0 0; }
          100% { background-position: 0 60px; }
        }
        @keyframes progressSweep {
          0% { transform: translateX(-100%); width: 60%; }
          50% { width: 40%; }
          100% { transform: translateX(250%); width: 60%; }
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
