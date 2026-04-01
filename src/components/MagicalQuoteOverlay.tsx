import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, X, Star, Zap, Heart } from 'lucide-react';
import api from '../services/api';

// ── Fallback quotes (used when AI is unavailable) ──────────────────────
const fallbackQuotes = [
  { text: "Every production issue you resolve makes the world a little smoother for thousands of guests. You're not just shipping code — you're crafting experiences.", author: "ProdVista AI" },
  { text: "Behind every healthy dashboard is someone who cared enough to check. That someone is you. Keep going.", author: "ProdVista AI" },
  { text: "You manage systems that never sleep so that people can rest easy. That's quiet heroism.", author: "ProdVista AI" },
  { text: "The best engineers don't just fix bugs — they prevent the next hundred. Today's vigilance is tomorrow's uptime.", author: "ProdVista AI" },
  { text: "Production stability isn't luck. It's the result of a thousand good decisions, maintained by people like you.", author: "ProdVista AI" },
  { text: "Code is poetry that runs hotels. Every deployment you shepherd is a verse in the story of great hospitality.", author: "ProdVista AI" },
  { text: "Resilience isn't about never having incidents. It's about the speed and grace with which you respond. You've got this.", author: "ProdVista AI" },
  { text: "Complex systems serve simple joys — a smooth check-in, a perfect round of golf, a relaxing spa day. You power all of it.", author: "ProdVista AI" },
  { text: "Shipping to production takes courage. Maintaining it takes grit. You have both in abundance.", author: "ProdVista AI" },
  { text: "Every version upgrade you plan, every migration you execute, pushes hospitality technology forward. Don't underestimate your impact.", author: "ProdVista AI" },
];

export function getRandomQuote() {
  return fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
}

/** Fetch an AI-generated quote from the backend; falls back to a hardcoded one. */
export async function fetchAiQuote(): Promise<{ text: string; author: string; isAiGenerated?: boolean }> {
  try {
    const { data } = await api.get('/ai/motivational-quote');
    if (data?.text) return data;
  } catch { /* ignore - use fallback */ }
  return getRandomQuote();
}

// ── Floating Particle ──────────────────────────────────────────────────
function FloatingParticle({ delay, size, left, dur, icon }: {
  delay: number; size: number; left: string; dur: number;
  icon: 'sparkle' | 'star' | 'dot' | 'heart';
}) {
  const icons: Record<string, React.ReactNode> = {
    sparkle: <Sparkles style={{ width: size, height: size }} />,
    star: <Star style={{ width: size, height: size }} />,
    heart: <Heart style={{ width: size, height: size }} />,
    dot: <div style={{ width: size * 0.5, height: size * 0.5 }} className="rounded-full bg-current" />,
  };
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left,
        bottom: '-20px',
        color: 'rgba(148,163,184,0.35)',
        animation: `floatUp ${dur}s ease-in-out ${delay}s infinite`,
      }}
    >
      {icons[icon]}
    </div>
  );
}

// ── Typewriter Hook ────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 30, startDelay = 600) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const startTyping = () => {
      timeout = setTimeout(function tick() {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1));
          i++;
          timeout = setTimeout(tick, speed + Math.random() * 20);
        } else {
          setDone(true);
        }
      }, speed);
    };

    const delayTimer = setTimeout(startTyping, startDelay);
    return () => { clearTimeout(timeout); clearTimeout(delayTimer); };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

// ── Magical Quote Overlay ──────────────────────────────────────────────
export default function MagicalQuoteOverlay({ quote, onDismiss }: {
  quote: { text: string; author: string; isAiGenerated?: boolean };
  onDismiss: () => void;
}) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'leaving' | 'gone'>('entering');
  const { displayed, done: typingDone } = useTypewriter(quote.text, 28, 800);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setPhase('visible'), 50);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = useCallback(() => {
    setPhase('leaving');
    setTimeout(() => { setPhase('gone'); onDismiss(); }, 600);
  }, [onDismiss]);

  // Auto-dismiss after reading time (min 6s after typing done)
  useEffect(() => {
    if (!typingDone) return;
    const t = setTimeout(handleDismiss, 8000);
    return () => clearTimeout(t);
  }, [typingDone, handleDismiss]);

  if (phase === 'gone') return null;

  const isVisible = phase === 'visible' || phase === 'entering';
  const isLeaving = phase === 'leaving';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      onClick={handleDismiss}
      style={{
        background: isLeaving ? 'transparent' : undefined,
        transition: 'background 0.6s ease',
      }}
    >
      {/* Soft frosted background */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: isLeaving ? 0 : isVisible ? 1 : 0,
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.95) 0%, rgba(241,245,249,0.92) 70%)',
          backdropFilter: 'blur(16px)',
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ opacity: isLeaving ? 0 : isVisible ? 1 : 0, transition: 'opacity 0.5s' }}>
        <FloatingParticle delay={0} size={14} left="10%" dur={7} icon="sparkle" />
        <FloatingParticle delay={1.2} size={10} left="25%" dur={9} icon="star" />
        <FloatingParticle delay={0.5} size={8} left="40%" dur={6} icon="dot" />
        <FloatingParticle delay={2} size={12} left="55%" dur={8} icon="sparkle" />
        <FloatingParticle delay={0.8} size={16} left="70%" dur={10} icon="star" />
        <FloatingParticle delay={1.5} size={10} left="85%" dur={7} icon="heart" />
        <FloatingParticle delay={2.5} size={8} left="15%" dur={8} icon="dot" />
        <FloatingParticle delay={0.3} size={12} left="60%" dur={9} icon="heart" />
        <FloatingParticle delay={1.8} size={14} left="35%" dur={6.5} icon="sparkle" />
        <FloatingParticle delay={3} size={10} left="90%" dur={7.5} icon="star" />
      </div>

      {/* Card container */}
      <div
        onClick={e => e.stopPropagation()}
        className="relative max-w-xl w-full mx-6"
        style={{
          transform: isLeaving ? 'scale(0.85) translateY(40px)' : isVisible ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(60px)',
          opacity: isLeaving ? 0 : isVisible ? 1 : 0,
          transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Soft glow ring */}
        <div className="absolute -inset-2 rounded-3xl opacity-30"
          style={{
            background: 'conic-gradient(from 0deg, #93c5fd, #c4b5fd, #fbcfe8, #fde68a, #bbf7d0, #a5f3fc, #93c5fd)',
            filter: 'blur(24px)',
            animation: 'spinGlow 8s linear infinite',
          }}
        />

        {/* Main card */}
        <div className="relative rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 30%, #f1f5f9 60%, #ffffff 100%)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.04)',
          }}>

          {/* Soft pastel top accent line */}
          <div className="h-1 w-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #93c5fd, #c4b5fd, #fbcfe8, #93c5fd, transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 3s linear infinite',
            }}
          />

          <div className="px-8 pt-8 pb-8">
            {/* Close */}
            <button onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600 hover:rotate-90 duration-300">
              <X className="w-4 h-4" />
            </button>

            {/* Animated AI icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                {/* Ripple rings */}
                <div className="absolute inset-0 rounded-full border-2 border-sky-300/30"
                  style={{ animation: 'ripple 2s ease-out infinite', transform: 'scale(1)' }} />
                <div className="absolute inset-0 rounded-full border-2 border-violet-300/25"
                  style={{ animation: 'ripple 2s ease-out 0.5s infinite', transform: 'scale(1)' }} />
                <div className="absolute inset-0 rounded-full border-2 border-pink-300/20"
                  style={{ animation: 'ripple 2s ease-out 1s infinite', transform: 'scale(1)' }} />

                {/* Core icon */}
                <div className="relative bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-400 p-4 rounded-full shadow-lg shadow-sky-300/30"
                  style={{ animation: 'gentleBob 3s ease-in-out infinite' }}>
                  <Sparkles className="w-7 h-7 text-white drop-shadow-lg" />
                </div>
              </div>
            </div>

            {/* Label */}
            <div className="text-center mb-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
                transition: 'all 0.5s ease 0.4s',
              }}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase"
                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.15)' }}>
                <Zap className="w-3 h-3" />
                {quote.isAiGenerated ? 'AI-Generated Inspiration' : 'AI-Powered Inspiration'}
              </span>
            </div>

            {/* Typewriter quote */}
            <blockquote className="text-center min-h-[100px] flex flex-col justify-center">
              <p className="text-xl leading-relaxed font-medium"
                style={{ color: '#334155', fontStyle: 'italic', letterSpacing: '0.01em' }}>
                &ldquo;{displayed}
                {!typingDone && (
                  <span className="inline-block w-0.5 h-5 ml-0.5 align-middle rounded-full"
                    style={{ background: '#6366f1', animation: 'blink 0.8s step-end infinite' }}
                  />
                )}
                {typingDone && <>&rdquo;</>}
              </p>

              {/* Author - fade in after typing */}
              <footer className="mt-5 flex items-center justify-center gap-2 text-sm"
                style={{
                  opacity: typingDone ? 1 : 0,
                  transform: typingDone ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'all 0.6s ease',
                  color: '#6366f1',
                }}>
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-medium tracking-wide">{quote.author}</span>
                <Sparkles className="w-3.5 h-3.5" />
              </footer>
            </blockquote>

            {/* CTA - appear after typing */}
            <div className="mt-7 text-center"
              style={{
                opacity: typingDone ? 1 : 0,
                transform: typingDone ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.9)',
                transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s',
              }}>
              <button onClick={handleDismiss}
                className="group relative px-8 py-3 rounded-2xl text-sm font-bold text-white overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8, #a78bfa)', boxShadow: '0 6px 24px rgba(99,102,241,0.2)' }}>
                {/* Button shine */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 55%, transparent 60%)', backgroundSize: '200% 100%', animation: 'btnShine 1.5s ease-in-out infinite' }} />
                <span className="relative flex items-center gap-2">
                  Let's Go! <span className="text-base">🚀</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Injected keyframes */}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) rotate(0deg) scale(0.5); opacity: 0; }
          10% { opacity: 0.4; }
          50% { opacity: 0.2; }
          100% { transform: translateY(-100vh) rotate(360deg) scale(1); opacity: 0; }
        }
        @keyframes spinGlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes gentleBob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-4px) rotate(3deg); }
          66% { transform: translateY(-2px) rotate(-2deg); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes btnShine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
