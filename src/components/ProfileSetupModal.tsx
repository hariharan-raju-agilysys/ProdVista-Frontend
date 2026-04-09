import { useState } from 'react';
import { Cake, Sparkles, User, ChevronDown } from 'lucide-react';
import authService from '../services/authService';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(month: number): number {
  // Use a non-leap year for simplicity — Feb = 28
  return new Date(2025, month, 0).getDate();
}

export default function ProfileSetupModal({ isOpen, onComplete }: ProfileSetupModalProps) {
  const [month, setMonth] = useState<number | ''>('');
  const [day, setDay] = useState<number | ''>('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1 = DOB, 2 = Bio

  if (!isOpen) return null;

  const maxDay = month ? getDaysInMonth(month) : 31;
  const canProceed = month !== '' && day !== '' && day >= 1 && day <= maxDay;
  const canSubmit = canProceed && bio.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const result = await authService.updateProfile({
        birthMonth: month as number,
        birthDay: day as number,
        bio: bio.trim(),
      });
      if (result) {
        onComplete();
      } else {
        setError('Failed to save profile. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop — no click to dismiss (mandatory) */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header with animated gradient */}
        <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-8 py-10 text-center overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

          <div className="relative">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              {step === 1 ? (
                <Cake className="w-10 h-10 text-white" />
              ) : (
                <User className="w-10 h-10 text-white" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {step === 1 ? 'When\'s Your Birthday?' : 'Tell Us About You'}
            </h2>
            <p className="text-white/70 text-sm">
              {step === 1
                ? 'We\'d love to celebrate with you! 🎉'
                : 'A few words so the team knows who you are'}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-white' : 'w-4 bg-white/40'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-white' : 'w-4 bg-white/40'}`} />
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          {step === 1 ? (
            /* ─── Step 1: Date of Birth ─── */
            <div className="space-y-5">
              <div className="flex gap-4">
                {/* Month Dropdown */}
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Month
                  </label>
                  <div className="relative">
                    <select
                      value={month}
                      onChange={e => {
                        const m = Number(e.target.value);
                        setMonth(m || '');
                        if (day && m && day > getDaysInMonth(m)) setDay('');
                      }}
                      className="w-full appearance-none bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 pr-10 text-sm font-medium text-gray-900 dark:text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                    >
                      <option value="">Select month</option>
                      {MONTHS.map((name, i) => (
                        <option key={i + 1} value={i + 1}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Day Dropdown */}
                <div className="w-28">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Day
                  </label>
                  <div className="relative">
                    <select
                      value={day}
                      onChange={e => setDay(Number(e.target.value) || '')}
                      className="w-full appearance-none bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 pr-10 text-sm font-medium text-gray-900 dark:text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                    >
                      <option value="">Day</option>
                      {Array.from({ length: maxDay }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                We only need month & day — your birth year stays private.
              </p>

              <button
                onClick={() => canProceed && setStep(2)}
                disabled={!canProceed}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
              >
                Continue
              </button>
            </div>
          ) : (
            /* ─── Step 2: Bio ─── */
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Short Bio
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value.slice(0, 150))}
                  placeholder="e.g. Full-stack dev who loves coffee and clean code ☕"
                  rows={3}
                  className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all resize-none"
                  autoFocus
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-gray-400">A sentence or two about yourself</span>
                  <span className={`text-[10px] ${bio.length > 140 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {bio.length}/150
                  </span>
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-3.5 rounded-xl font-semibold text-sm border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || saving}
                  className="flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {saving ? 'Saving...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-8 pb-6 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-600">
            This helps us celebrate birthdays and connect the team
          </p>
        </div>
      </div>
    </div>
  );
}
