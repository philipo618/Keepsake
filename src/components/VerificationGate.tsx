import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Delete, Lock, RotateCcw, ShieldAlert } from 'lucide-react';
import { triggerConfettiCelebration } from './AnimationCanvas';
import { hasApiBackend, verifyApiBackendReachable } from '../lib/api';
import { audioEngine } from '../lib/audioEngine';
import { checkVerificationStep, verifyFullGreeting } from '../lib/firestoreService';
import type {
  CustomQuestionPrompt,
  Greeting,
  VerificationSecretsInput,
} from '../lib/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type VerificationStage =
  | { kind: 'day' }
  | { kind: 'month' }
  | { kind: 'year' }
  | { kind: 'custom'; question: CustomQuestionPrompt };

export interface UnlockedGreetingPayload {
  mainMessage?: string;
  additionalMessages?: string[];
  cardDate?: string;
  signature?: string;
  photos?: Greeting['photos'];
  exportedVideo?: Greeting['exportedVideo'];
}

function normalizeAnswer(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function VerificationGate({
  greeting,
  previewMode = false,
  previewSecrets,
  onVerified,
}: {
  greeting: Greeting;
  previewMode?: boolean;
  previewSecrets?: VerificationSecretsInput;
  onVerified: (unlockedPayload?: UnlockedGreetingPayload) => void;
}) {
  const [stageIndex, setStageIndex] = useState(0);
  const [celebratingMsg, setCelebratingMsg] = useState<string | null>(null);
  const [dayInput, setDayInput] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [yearInput, setYearInput] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [stepFeedback, setStepFeedback] = useState<string | null>(null);
  const [lockedOut, setLockedOut] = useState(false);
  const [previewAttempts, setPreviewAttempts] = useState(0);
  const [backendUnavailable, setBackendUnavailable] = useState(() => !previewMode && !hasApiBackend());

  useEffect(() => {
    if (previewMode) {
      setBackendUnavailable(false);
      return;
    }
    if (!hasApiBackend()) {
      setBackendUnavailable(true);
      return;
    }
    let active = true;
    verifyApiBackendReachable().then((live) => {
      if (active && !live) {
        setBackendUnavailable(true);
      }
    });
    return () => {
      active = false;
    };
  }, [previewMode]);

  const stages = useMemo<VerificationStage[]>(() => {
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
  }, [greeting.verificationMeta]);

  const currentStage = stages[stageIndex];

  const handleRestartPreviewGate = () => {
    setStageIndex(0);
    setCelebratingMsg(null);
    setDayInput('');
    setSelectedMonth(null);
    setYearInput('');
    setCustomAnswers({});
    setStepFeedback(null);
    setLockedOut(false);
    setPreviewAttempts(0);
  };

  // Protected local draft validator used ONLY for unpublished/draft Creator Preview
  const runPreviewStepCheck = (payload: {
    step: 'day' | 'month' | 'year' | 'custom';
    value: unknown;
    questionId?: string;
  }): { valid: boolean; locked?: boolean; remainingAttempts?: number; message?: string } => {
    const s = previewSecrets || { customAnswers: [] };
    let valid = false;

    if (payload.step === 'day') {
      valid = Boolean(s.birthDay) && Number(payload.value) === Number(s.birthDay);
    } else if (payload.step === 'month') {
      valid = Boolean(s.birthMonth) && Number(payload.value) === Number(s.birthMonth);
    } else if (payload.step === 'year') {
      valid = Boolean(s.birthYear) && Number(payload.value) === Number(s.birthYear);
    } else if (payload.step === 'custom' && payload.questionId) {
      const target = s.customAnswers.find((a) => a.id === payload.questionId);
      if (target && target.answer.trim()) {
        valid = normalizeAnswer(payload.value) === normalizeAnswer(target.answer);
      }
    }

    if (!valid) {
      const nextCount = previewAttempts + 1;
      const maxRetries = greeting.verificationMeta.maxRetries ?? 5;
      const unlimited = maxRetries === 0;
      if (!unlimited && nextCount >= maxRetries) {
        setPreviewAttempts(0);
        return {
          valid: false,
          locked: true,
          remainingAttempts: 0,
          message: 'Maximum tries reached in preview. Tap Restart Gate or wait 60 seconds.',
        };
      }
      setPreviewAttempts(nextCount);
      return {
        valid: false,
        locked: false,
        remainingAttempts: unlimited ? 99 : Math.max(0, maxRetries - nextCount),
        message: `${greeting.verificationMeta.friendlyErrorMessage || 'That answer does not quite match.'}${
          !unlimited ? ` (${Math.max(0, maxRetries - nextCount)} tries left)` : ''
        }`,
      };
    }

    return { valid: true, locked: false };
  };

  const runPreviewFullVerify = (submitted: {
    birthDay?: number;
    birthMonth?: number;
    birthYear?: number;
    customAnswers?: Record<string, string>;
  }): { verified: boolean; locked?: boolean; message?: string; unlockedPayload?: UnlockedGreetingPayload } => {
    const s = previewSecrets || { customAnswers: [] };
    const v = greeting.verificationMeta;
    let allValid = true;

    if (v.enableBirthdayDay && Number(submitted.birthDay) !== Number(s.birthDay)) allValid = false;
    if (v.enableBirthdayMonth && Number(submitted.birthMonth) !== Number(s.birthMonth)) allValid = false;
    if (v.enableBirthdayYear && Number(submitted.birthYear) !== Number(s.birthYear)) allValid = false;
    for (const q of v.customQuestions.filter((c) => c.enabled)) {
      const expected = s.customAnswers.find((a) => a.id === q.id)?.answer ?? '';
      const candidate = submitted.customAnswers?.[q.id] ?? '';
      if (!expected.trim() || normalizeAnswer(candidate) !== normalizeAnswer(expected)) {
        allValid = false;
        break;
      }
    }

    if (!allValid) {
      return {
        verified: false,
        message: greeting.verificationMeta.friendlyErrorMessage || 'One or more answers did not match.',
      };
    }

    return {
      verified: true,
      unlockedPayload: {
        mainMessage: greeting.mainMessage,
        additionalMessages: greeting.additionalMessages,
        cardDate: greeting.cardDate,
        signature: greeting.signature,
        photos: greeting.photos,
        exportedVideo: greeting.exportedVideo,
      },
    };
  };

  const advanceOrUnlock = async (overrideCustom?: Record<string, string>, overrideMonth?: number) => {
    const isLast = stageIndex >= stages.length - 1;

    if (!isLast) {
      if (currentStage?.kind === 'month') {
        setCelebratingMsg('Spot on! Month verified.');
        audioEngine.playSfx('success');
        triggerConfettiCelebration(greeting.designConfig.accentColor);
        window.setTimeout(() => {
          setCelebratingMsg(null);
          setStageIndex((i) => i + 1);
        }, 1150);
      } else if (currentStage?.kind === 'year') {
        setCelebratingMsg('Wonderful! Birth year confirmed.');
        audioEngine.playSfx('success');
        triggerConfettiCelebration(greeting.designConfig.accentColor);
        window.setTimeout(() => {
          setCelebratingMsg(null);
          setStageIndex((i) => i + 1);
        }, 1150);
      } else {
        audioEngine.playSfx('success');
        setStageIndex((i) => i + 1);
      }
      return;
    }

    const payload = {
      birthDay: dayInput ? Number(dayInput) : undefined,
      birthMonth: overrideMonth ?? selectedMonth ?? undefined,
      birthYear: yearInput ? Number(yearInput) : undefined,
      customAnswers: overrideCustom ?? customAnswers,
    };

    const result = previewMode
      ? runPreviewFullVerify(payload)
      : await verifyFullGreeting(greeting.id, payload);

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
    setCelebratingMsg('All answers verified! Unsealing your gift...');
    window.setTimeout(() => {
      setCelebratingMsg(null);
      onVerified(result.unlockedPayload);
    }, 1050);
  };

  const handleCheckDay = async () => {
    const dayNum = Number(dayInput);
    if (!dayNum || dayNum < 1 || dayNum > 31) {
      setStepFeedback('Please enter a valid day between 1 and 31.');
      return;
    }
    setChecking(true);
    setStepFeedback(null);
    try {
      const res = previewMode
        ? runPreviewStepCheck({ step: 'day', value: dayNum })
        : await checkVerificationStep(greeting.id, { step: 'day', value: dayNum });
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
    if (checking || lockedOut) return;
    setSelectedMonth(monthNum);
    setChecking(true);
    setStepFeedback(null);
    try {
      const res = previewMode
        ? runPreviewStepCheck({ step: 'month', value: monthNum })
        : await checkVerificationStep(greeting.id, { step: 'month', value: monthNum });
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
    const yr = Number(yearInput);
    if (!yr || yr < 1900 || yr > 2100) {
      setStepFeedback('Please enter a valid 4-digit year.');
      return;
    }
    setChecking(true);
    setStepFeedback(null);
    try {
      const res = previewMode
        ? runPreviewStepCheck({ step: 'year', value: yr })
        : await checkVerificationStep(greeting.id, { step: 'year', value: yr });
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
    const ans = customAnswers[q.id] || '';
    if (!ans.trim()) {
      setStepFeedback('Please enter your answer before continuing.');
      return;
    }
    setChecking(true);
    setStepFeedback(null);
    try {
      const res = previewMode
        ? runPreviewStepCheck({ step: 'custom', questionId: q.id, value: ans })
        : await checkVerificationStep(greeting.id, {
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

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 sm:p-8 shadow-xl space-y-6">
      {previewMode && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
          <span className="font-medium">Creator Preview · Mode B Active</span>
          <button
            type="button"
            onClick={handleRestartPreviewGate}
            className="inline-flex items-center gap-1 font-medium underline hover:opacity-80 min-h-[28px]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Gate</span>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
          <Lock className="w-3.5 h-3.5" />
          <span>Gift Verification</span>
        </span>
        {stages.length > 0 && (
          <span className="font-mono tabular-nums">
            Step {stageIndex + 1} / {stages.length}
          </span>
        )}
      </div>

      {backendUnavailable ? (
        <div className="py-6 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-amber-600 dark:text-amber-400 mx-auto" />
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Verification Service Unavailable
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            This greeting uses protected Interactive Access (Mode B). To keep private answers and sealed keepsake content secure, verification must be handled by the creator&apos;s connected verification backend rather than in browser code.
          </p>
        </div>
      ) : celebratingMsg ? (
        <div className="py-12 text-center space-y-3 animate-reveal-up">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <p className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
            {celebratingMsg}
          </p>
        </div>
      ) : stages.length === 0 ? (
        <div className="text-center space-y-4 py-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {previewMode
              ? 'Interactive Access is enabled, but no verification screens are currently checked. Turn on Birthday Day, Month, Year, or a Personal Question in Step 8 to test the gate.'
              : 'No verification steps configured. Ready to unseal your gift!'}
          </p>
          {!previewMode && (
            <button
              type="button"
              onClick={() => advanceOrUnlock()}
              className="w-full min-h-[48px] rounded-xl bg-rose-700 text-white text-sm font-medium"
            >
              Open Gift
            </button>
          )}
        </div>
      ) : currentStage?.kind === 'day' ? (
        <div className="space-y-5 text-center">
          <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Before opening your special gift, let&apos;s see how well you know your birthday!
            </p>
            <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              What day were you born?
            </h2>
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
            <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Select your birth month
            </h2>
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
            <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Enter your birth year
            </h2>
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
              Personal Question from {greeting.senderName || 'Sender'}
            </p>
            <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              {currentStage.question.question}
            </h2>
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
      ) : null}
    </div>
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
