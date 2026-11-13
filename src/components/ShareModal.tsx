import { Check, Copy, Mail, Share2 } from 'lucide-react';
import { useState } from 'react';

export function buildGreetingShareUrl(greetingId: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${window.location.origin}${normalizedBase}g/${greetingId}`;
}

export function ShareModal({
  greetingId,
  recipientName,
  title,
  onClose,
}: {
  greetingId: string;
  recipientName: string;
  title: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = buildGreetingShareUrl(greetingId);
  const shareText = `I created a special digital greeting card for ${recipientName}: "${title}"`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback select
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const messengerUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&redirect_uri=${encodeURIComponent(shareUrl)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n\nOpen your gift here:\n${shareUrl}`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#131924] border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Your Gift Link Is Ready
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Share this unique link with {recipientName}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
            aria-label="Close share modal"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 px-2 outline-none truncate"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium flex items-center gap-1.5 shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Sheet</span>
            </button>
          )}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium flex items-center justify-center"
          >
            WhatsApp
          </a>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium flex items-center justify-center"
          >
            Telegram
          </a>
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium flex items-center justify-center"
          >
            Facebook
          </a>
          <a
            href={messengerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium flex items-center justify-center"
          >
            Messenger
          </a>
          <a
            href={emailUrl}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </a>
        </div>
      </div>
    </div>
  );
}
