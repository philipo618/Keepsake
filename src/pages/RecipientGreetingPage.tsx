import { useEffect, useState } from 'react';
import { Gift, ShieldAlert } from 'lucide-react';
import { GreetingExperience } from '../components/GreetingExperience';
import { VerificationGate, type UnlockedGreetingPayload } from '../components/VerificationGate';
import { buildApiUrl, hasApiBackend } from '../lib/api';
import { fetchGreetingById } from '../lib/firestoreService';
import type { AppRoute } from '../components/Navbar';
import type { Greeting } from '../lib/types';

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
  const [verified, setVerified] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg('');
    setVerified(false);
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
        // Record view safely when backend API is present
        if (hasApiBackend()) {
          fetch(buildApiUrl(`/greetings/${greetingId}/view`), { method: 'POST' }).catch(() => {});
        }
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

  const handleReport = async () => {
    if (hasApiBackend()) {
      await fetch(buildApiUrl(`/greetings/${greetingId}/report`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User reported from greeting page' }),
      }).catch(() => {});
    }
    setReportSubmitted(true);
  };

  const handleVerified = (unlockedPayload?: UnlockedGreetingPayload) => {
    if (unlockedPayload) {
      setGreeting((prev) =>
        prev
          ? {
              ...prev,
              mainMessage: unlockedPayload.mainMessage ?? prev.mainMessage,
              additionalMessages: unlockedPayload.additionalMessages ?? prev.additionalMessages,
              cardDate: unlockedPayload.cardDate ?? prev.cardDate,
              signature: unlockedPayload.signature ?? prev.signature,
              photos: unlockedPayload.photos ?? prev.photos,
              exportedVideo: unlockedPayload.exportedVideo ?? prev.exportedVideo,
            }
          : prev
      );
    }
    setVerified(true);
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

  return (
    <main className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <VerificationGate greeting={greeting} onVerified={handleVerified} />
    </main>
  );
}
