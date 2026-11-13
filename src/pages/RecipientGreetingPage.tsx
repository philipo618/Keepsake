import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Delete, Gift, Lock, ShieldAlert } from 'lucide-react';
import { GreetingExperience } from '../components/GreetingExperience';
import { triggerConfettiCelebration } from '../components/AnimationCanvas';
import { audioEngine } from '../lib/audioEngine';
import {
  checkVerificationStep,
  fetchGreetingById,
  verifyFullGreeting,
} from '../lib/firestoreService';
import type { AppRoute } from '../components/Navbar';
import type { CustomQuestionPrompt, Greeting } from '../lib/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type VerificationStage =
  | { kind: 'day' }
  | { kind: 'month' }
  | { kind: 'year' }
  | { kind: 'custom'; question: CustomQuestionPrompt };

export function RecipientGreetingPage({
  greetingId,
  navigate,
}: {
  greetingId: string;
  navigate: (next: AppRoute) => void;
}) {
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Verification flow state
  const [verified, setVerified] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [celebratingMsg, setCelebratingMsg] = useState<string | null>(null);
  const [dayInput, setDayInput] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [yearInput, setYearInput] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [stepFeedback, setStepFeedback] = useState<string | null>(null);
  const [lockedOut, setLockedOut] = useState(false);

  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg('');
    fetchGreetingById(greetingId)
      .then((docData) => {
        if (!active) return;
        if (!docData) {
          setErrorMsg('We could not find this greeting card. Please verify your link.');
          return;
        }
        setGreeting(docData);
        if (docData.accessMode === 'direct') {
          setVerified(true);
        }
        // Record view safely
        const apiBase = import.meta.env.VITE_API_BASE_URL || '';
        fetch(`${apiBase}/api/greetings/${greetingId}/view`, { method: 'POST' }).catch(() => {});
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(
          err instanceof Error && err.message.includes('permissions')
            ? 'This greeting card is currently private or unpublished.'
            : 'Unable to load greeting card.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [greetingId]);

  const stages = useMemo<VerificationStage[]>(() => {
    if (!greeting || greeting.accessMode !== 'interactive') return [];
    const list: VerificationStage[] = [];
    const v = greeting.verificationMeta;
    if (v?.enableBirthdayDay) list.push({ kind: 'day' });
    if (v?.enableBirthdayMonth) list.push({ kind: 'month' });
    if (v?.enableBirthdayYear) list.push({ kind: 'year' });
    if (Array.isArray(v?.customQuestions)) {
      for (const q of v.customQuestions) {
        if (q.enabled) list.push({ kind: 'custom', question: q });
      }
    }
    return list;
  }, [greeting]);

  const currentStage = stages[stageIndex];

  const handleReport = async () => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    await fetch(`${apiBase}/api/greetings/${greetingId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'User reported from greeting page' }),
    }).catch(() => {});
    setReportSubmitted(true);
  };

  const advanceOrUnlock = async (overrideCustom?: Record<string, string>, overrideMonth?: number) => {
    if (!greeting) return;
    const isLast = stageIndex >= stages.length - 1;

    if (!isLast) {
      if (currentStage?.kind === 'month') {
        setCelebratingMsg('Spot on! Month verified.');
        audioEngine.playSfx('success');
        triggerConfettiCelebration(greeting.designConfig.accentColor);
        window.setTimeout(() => {
          setCelebratingMsg(null);
          setStageIndex((i) => i + 1);
        }, 1250);
      } else if (currentStage?.kind === 'year') {
        setCelebratingMsg('Wonderful! Birth year confirmed.');
        audioEngine.playSfx('success');
        triggerConfettiCelebration(greeting.designConfig.accentColor);
        window.setTimeout(() => {
          setCelebratingMsg(null);
          setStageIndex((i) => i + 1);
        }, 1250);
      } else {
        audioEngine.playSfx('success');
        setStageIndex((i) => i + 1);
      }
      return;
    }

    // Final stage: full verification & unlock sealed payload
    const result = await verifyFullGreeting(greeting.id, {
      birthDay: dayInput ? Number(dayInput) : undefined,
      birthMonth: overrideMonth ?? selectedMonth ?? undefined,
      birthYear: yearInput ? Number(yearInput) : undefined,
      customAnswers: overrideCustom ?? customAnswers,
    });

    if (!result.verified) {
      audioEngine.playSfx('error');
      setLockedOut(Boolean(result.locked));
      setStepFeedback(
        result.message ||
          greeting.verificationMeta.friendlyErrorMessage ||
          'That answer does not match. Please try again.'
      );
      return;
    }

    audioEngine.playSfx('success');
    triggerConfettiCelebration(greeting.designConfig.accentColor);

    if (result.unlockedPayload) {
      setGreeting((prev) =>
        prev
          ? {
              ...prev,
              mainMessage: result.unlockedPayload?.mainMessage ?? prev.mainMessage,
              additionalMessages: result.unlockedPayload?.additionalMessages ?? prev.additionalMessages,
              cardDate: result.unlockedPayload?.cardDate ?? prev.cardDate,
              signature: result.unlockedPayload?.signature ?? prev.signature,
              photos: result.unlockedPayload?.photos ?? prev.photos,
            }
          : prev
      );
    }
    setCelebratingMsg('All answers verified! Unsealing your gift...');
    window.setTimeout(() => {
      setCelebratingMsg(null);
      setVerified(true);
    }, 1100);
  };

  const handleCheckDay = async () => {
    if (!greeting) return;
    const dayNum = Number(dayInput);
    if (!dayNum || dayNum < 1 || dayNum > 31) {
      setStepFeedback('Please enter a valid day between 1 and 31.');
      return;
    }
    setChecking(true);
    setStepFeedback(null);
    try {
      const res = await checkVerificationStep(greeting.id, { step: 'day', value: dayNum });
      if (!res.valid) {
        audioEngine.playSfx('error');
        setLockedOut(Boolean(res.locked));
        setStepFeedback(
          res.message ||
            `${greeting.verificationMeta.friendlyErrorMessage}${
              typeof res.remainingAttempts === 'number' ? ` (${res.remainingAttempts} tries left)` : ''
            }`
        );
        return;
      }
      await advanceOrUnlock();
    } catch {
      setStepFeedback('Verification service is unavailable. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckMonth = async (monthNum: number) => {
    if (!greeting || checking || lockedOut) return;
    setSelectedMonth(monthNum);
    setChecking(true);
    setStepFeedback(null);
    try {
      const res = await checkVerificationStep(greeting.id, { step: 'month', value: monthNum });
      if (!res.valid) {
        audioEngine.playSfx('error');
        setLockedOut(Boolean(res.locked));
        setStepFeedback(
          res.message ||
            `${greeting.verificationMeta.friendlyErrorMessage}${
              typeof res.remainingAttempts === 'number' ? ` (${res.remainingAttempts} tries left)` : ''
            }`
        );
        return;
      }
      await advanceOrUnlock(undefined, monthNum);
    } catch {
      setStepFeedback('Verification service is unavailable.');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckYear = async () => {
    if (!greeting) return;
    const yr = Number(yearInput);
    if (!yr || yr < 1900 || yr > 2100) {
      setStepFeedback('Please enter a valid 4-digit year.');
      return;
    }
    setChecking(true);
    setStepFeedback(null);
    try {
      const res = await checkVerificationStep(greeting.id, { step: 'year', value: yr });
      if (!res.valid) {
        audioEngine.playSfx('error');
        setLockedOut(Boolean(res.locked));
        setStepFeedback(
          res.message ||
            `${greeting.verificationMeta.friendlyErrorMessage}${
              typeof res.remainingAttempts === 'number' ? ` (${res.remainingAttempts} tries left)` : ''
            }`
        );
        return;
      }
      await advanceOrUnlock();
    } catch {
      setStepFeedback('Verification service is unavailable.');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckCustom = async (q: CustomQuestionPrompt) => {
    if (!greeting) return;
    const ans = customAnswers[q.id] || '';
    if (!ans.trim()) {
      setStepFeedback('Please enter your answer before continuing.');
      return;
    }
    setChecking(true);
    setStepFeedback(null);
    try {
      const res = await checkVerificationStep(greeting.id, {
        step: 'custom',
        questionId: q.id,
        value: ans,
      });
      if (!res.valid) {
        audioEngine.playSfx('error');
        setLockedOut(Boolean(res.locked));
        setStepFeedback(
          res.message ||
            `${greeting.verificationMeta.friendlyErrorMessage}${
              typeof res.remainingAttempts === 'number' ? ` (${res.remainingAttempts} tries left)` : ''
            }`
        );
        return;
      }
      await advanceOrUnlock();
    } catch {
      setStepFeedback('Verification service is unavailable.');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <Gift className="w-8 h-8 text-rose-700 mx-auto animate-bounce" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Preparing your keepsake...</p>
        </div>
      </main>
    );
  }

  if (errorMsg || !greeting) {
    return (
      <main className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-8 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-rose-700 mx-auto" />
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
            Greeting Unavailable
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {errorMsg || 'This greeting link could not be found.'}
          </p>
          <button
            type="button"
            onClick={() => navigate({ page: 'landing' })}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium"
          >
            Return to Home
          </button>
        </div>
      </main>
    );
  }

  if (verified) {
    return (
      <main className="max-w-6xl mx-auto px-2 sm:px-6 py-4 sm:py-6">
        {reportSubmitted && (
          <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-3 text-xs text-slate-600 dark:text-slate-300 text-center">
            Thank you. Your report has been logged for review.
          </div>
        )}
        <GreetingExperience greeting={greeting} onReport={handleReport} />
      </main>
    );
  }

  // Interactive Verification Experience
  return (
    <main className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Gift Verification</span>
          </span>
          <span className="font-mono tabular-nums">
            Step {stageIndex + 1} / {Math.max(1, stages.length)}
          </span>
        </div>

        {celebratingMsg ? (
          <div className="py-12 text-center space-y-3 animate-reveal-up">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <p className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              {celebratingMsg}
            </p>
          </div>
        ) : currentStage?.kind === 'day' ? (
          <div className="space-y-5 text-center">
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Before opening your special gift, let&apos;s see how well you know your birthday!
              </p>
              <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
                What day were you born?
              </h1>
            </div>

            <div className="py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="font-mono tabular-nums text-3xl font-semibold tracking-widest text-slate-900 dark:text-white">
                {dayInput || '--'}
              </span>
            </div>

            <PhoneKeypad
              onDigit={(d) => {
                setStepFeedback(null);
                setDayInput((prev) => {
                  const next = (prev + d).slice(0, 2);
                  return Number(next) > 31 ? prev : next;
                });
              }}
              onBackspace={() => setDayInput((prev) => prev.slice(0, -1))}
              onClear={() => setDayInput('')}
            />

            {stepFeedback && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{stepFeedback}</p>
            )}

            <button
              type="button"
              disabled={checking || lockedOut || !dayInput}
              onClick={handleCheckDay}
              className="w-full min-h-[48px] rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {checking ? 'Checking...' : 'Confirm Birth Day'}
            </button>
          </div>
        ) : currentStage?.kind === 'month' ? (
          <div className="space-y-5 text-center">
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Step {stageIndex + 1}</p>
              <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
                Select your birth month
              </h1>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((month, idx) => {
                const mNum = idx + 1;
                const active = selectedMonth === mNum;
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={checking || lockedOut}
                    onClick={() => handleCheckMonth(mNum)}
                    className={`min-h-[46px] px-2 py-2 rounded-xl border text-xs font-medium transition-colors ${
                      active
                        ? 'border-rose-600 bg-rose-700 text-white'
                        : 'border-slate-200 dark:border-slate-800 hover:border-rose-400 text-slate-800 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-900/60'
                    }`}
                  >
                    {month}
                  </button>
                );
              })}
            </div>

            {stepFeedback && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{stepFeedback}</p>
            )}
          </div>
        ) : currentStage?.kind === 'year' ? (
          <div className="space-y-5 text-center">
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Almost there! Which year were you born?
              </p>
              <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
                Enter your birth year
              </h1>
            </div>

            <div className="py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="font-mono tabular-nums text-3xl font-semibold tracking-widest text-slate-900 dark:text-white">
                {yearInput.padEnd(4, '·')}
              </span>
            </div>

            <PhoneKeypad
              onDigit={(d) => {
                setStepFeedback(null);
                setYearInput((prev) => (prev.length < 4 ? prev + d : prev));
              }}
              onBackspace={() => setYearInput((prev) => prev.slice(0, -1))}
              onClear={() => setYearInput('')}
            />

            {stepFeedback && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{stepFeedback}</p>
            )}

            <button
              type="button"
              disabled={checking || lockedOut || yearInput.length < 4}
              onClick={handleCheckYear}
              className="w-full min-h-[48px] rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {checking ? 'Checking...' : 'Confirm Birth Year'}
            </button>
          </div>
        ) : currentStage?.kind === 'custom' ? (
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personal Question from {greeting.senderName}
              </p>
              <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
                {currentStage.question.question}
              </h1>
              {currentStage.question.hint && (
                <p className="text-xs text-slate-500">Hint: {currentStage.question.hint}</p>
              )}
            </div>

            <input
              type="text"
              value={customAnswers[currentStage.question.id] || ''}
              onChange={(e) => {
                setStepFeedback(null);
                setCustomAnswers((prev) => ({
                  ...prev,
                  [currentStage.question.id]: e.target.value,
                }));
              }}
              placeholder="Type your answer..."
              className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:border-rose-600"
            />

            {stepFeedback && (
              <p className="text-xs text-rose-600 dark:text-rose-400 text-center">{stepFeedback}</p>
            )}

            <button
              type="button"
              disabled={checking || lockedOut}
              onClick={() => handleCheckCustom(currentStage.question)}
              className="w-full min-h-[48px] rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-medium disabled:opacity-50"
            >
              {checking ? 'Verifying...' : stageIndex >= stages.length - 1 ? 'Unlock Gift' : 'Continue'}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No verification steps enabled. Ready to unseal your gift!
            </p>
            <button
              type="button"
              onClick={() => advanceOrUnlock()}
              className="w-full min-h-[48px] rounded-xl bg-rose-700 text-white text-sm font-medium"
            >
              Open Gift
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function PhoneKeypad({
  onDigit,
  onBackspace,
  onClear,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="grid grid-cols-3 gap-2.5 max-w-[270px] mx-auto">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onDigit(k)}
          className="h-14 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono tabular-nums text-xl font-medium text-slate-900 dark:text-white active:scale-95 transition-transform"
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="h-14 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={() => onDigit('0')}
        className="h-14 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono tabular-nums text-xl font-medium text-slate-900 dark:text-white active:scale-95 transition-transform"
      >
        0
      </button>
      <button
        type="button"
        onClick={onBackspace}
        aria-label="Backspace"
        className="h-14 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200"
      >
        <Delete className="w-5 h-5" />
      </button>
    </div>
  );
}
