import * as crypto from 'node:crypto';
import * as admin from 'firebase-admin';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import express, { type Request, type Response } from 'express';
import cors from 'cors';

admin.initializeApp();

// Target the exact named Firestore database provisioned in firebase-applet-config.json
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-4f3bd88e-95e5-4469-8be1-a33cea212c13';
const db = getFirestore(DATABASE_ID);
const BOOTSTRAPPED_ADMIN_EMAIL = 'philipodickson96@gmail.com';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '14mb' }));

const router = express.Router();

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

function normalizeAnswer(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function hashAnswer(salt: string, val: unknown): string {
  return crypto.scryptSync(normalizeAnswer(val), salt, 32).toString('hex');
}

function safeEqualPlain(a: unknown, b: unknown): boolean {
  const s1 = Buffer.from(normalizeAnswer(a));
  const s2 = Buffer.from(normalizeAnswer(b));
  if (s1.length !== s2.length) return false;
  return crypto.timingSafeEqual(s1, s2);
}

function safeEqualHash(salt: string, candidate: unknown, expectedHash: string): boolean {
  const candidateHash = hashAnswer(salt, candidate);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function verifyIdToken(req: Request): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

const attemptTracker = new Map<string, { count: number; lockedUntil: number }>();

function getAttemptKey(greetingId: string, req: Request): string {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'remote';
  return `${greetingId}:${ip}`;
}

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'keepsake-cloud-functions',
    databaseId: DATABASE_ID,
  });
});

router.post('/media/upload', async (req: Request, res: Response) => {
  const user = await verifyIdToken(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required to upload media.' });
    return;
  }

  const { dataUrl, fileName, mimeType } = req.body as {
    dataUrl?: string;
    fileName?: string;
    mimeType?: string;
  };

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    res.status(400).json({ error: 'Invalid media payload.' });
    return;
  }

  const match = dataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Malformed base64 media payload.' });
    return;
  }

  const detectedMime = mimeType || match[1];
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'video/mp4',
    'video/webm',
  ];
  if (!allowedMimes.includes(detectedMime)) {
    res.status(415).json({ error: `Unsupported media format: ${detectedMime}` });
    return;
  }

  const buffer = Buffer.from(match[2], 'base64');
  const limitBytes = detectedMime.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (buffer.byteLength > limitBytes) {
    res.status(413).json({ error: `File exceeds the ${detectedMime.startsWith('video/') ? 50 : 10} MB upload limit.` });
    return;
  }

  const safePrefix = (fileName || 'media').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) || 'media';
  const objectPath = `greetings/${user.uid}/uploads/${Date.now()}_${safePrefix}`;
  const bucket = admin.storage().bucket();
  const file = bucket.file(objectPath);
  const downloadToken = crypto.randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType: detectedMime,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  const encodedPath = encodeURIComponent(objectPath);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
  res.json({ url, sizeBytes: buffer.byteLength, mimeType: detectedMime });
});

router.post('/greetings/:id/secrets', async (req: Request, res: Response) => {
  const user = await verifyIdToken(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const greetingId = String(req.params.id || '');
  if (!isValidId(greetingId)) {
    res.status(400).json({ error: 'Invalid greeting ID.' });
    return;
  }

  const greetingSnap = await db.doc(`greetings/${greetingId}`).get();
  const isAdmin = user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.email_verified === true;
  if (greetingSnap.exists && greetingSnap.data()?.creatorId !== user.uid && !isAdmin) {
    res.status(403).json({ error: 'Forbidden: only the creator can update verification secrets.' });
    return;
  }

  const {
    birthDay,
    birthMonth,
    birthYear,
    customAnswers,
    maxRetries,
    unlockedPayload,
  } = req.body as {
    birthDay?: number | null;
    birthMonth?: number | null;
    birthYear?: number | null;
    customAnswers?: Array<{ id: string; answer: string }>;
    maxRetries?: number;
    unlockedPayload?: Record<string, unknown>;
  };

  const salt = crypto.randomBytes(16).toString('hex');
  const secretDoc: Record<string, unknown> = {
    greetingId,
    creatorId: greetingSnap.data()?.creatorId || user.uid,
    salt,
    birthDayHash: birthDay ? hashAnswer(salt, birthDay) : null,
    birthMonthHash: birthMonth ? hashAnswer(salt, birthMonth) : null,
    birthYearHash: birthYear ? hashAnswer(salt, birthYear) : null,
    customAnswerHashes: Array.isArray(customAnswers)
      ? customAnswers.slice(0, 10).map((item) => ({
          id: String(item.id),
          answerHash: hashAnswer(salt, item.answer),
        }))
      : [],
    maxRetries: typeof maxRetries === 'number' && maxRetries >= 0 ? maxRetries : 5,
    unlockedPayload: unlockedPayload || {},
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.doc(`greetings/${greetingId}/secrets/verification`).set(secretDoc, { merge: true });
  res.json({ ok: true });
});

router.delete('/greetings/:id/secrets', async (req: Request, res: Response) => {
  const user = await verifyIdToken(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const greetingId = String(req.params.id || '');
  if (!isValidId(greetingId)) {
    res.status(400).json({ error: 'Invalid greeting ID.' });
    return;
  }

  const secretRef = db.doc(`greetings/${greetingId}/secrets/verification`);
  const secretSnap = await secretRef.get();
  const isAdmin = user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.email_verified === true;
  if (secretSnap.exists && secretSnap.data()?.creatorId !== user.uid && !isAdmin) {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }

  await secretRef.delete();
  res.json({ ok: true });
});

router.post('/greetings/:id/check-step', async (req: Request, res: Response) => {
  const greetingId = String(req.params.id || '');
  if (!isValidId(greetingId)) {
    res.status(400).json({ valid: false, message: 'Invalid greeting ID.' });
    return;
  }

  const secretSnap = await db.doc(`greetings/${greetingId}/secrets/verification`).get();
  if (!secretSnap.exists) {
    res.status(404).json({ valid: false, message: 'Verification configuration not found.' });
    return;
  }

  const secret = secretSnap.data() || {};
  const key = getAttemptKey(greetingId, req);
  const tracker = attemptTracker.get(key) || { count: 0, lockedUntil: 0 };
  if (tracker.lockedUntil > Date.now()) {
    const waitSec = Math.ceil((tracker.lockedUntil - Date.now()) / 1000);
    res.status(429).json({
      valid: false,
      locked: true,
      remainingAttempts: 0,
      message: `Too many attempts. Please try again in ${waitSec} seconds.`,
    });
    return;
  }

  const { step, value, questionId } = req.body as {
    step: 'day' | 'month' | 'year' | 'custom';
    value: unknown;
    questionId?: string;
  };

  let valid = false;
  const salt = typeof secret.salt === 'string' ? secret.salt : '';

  if (step === 'day') {
    if (salt && secret.birthDayHash) {
      valid = safeEqualHash(salt, value, secret.birthDayHash);
    } else if (secret.birthDay !== undefined) {
      valid = Number(value) === Number(secret.birthDay);
    }
  } else if (step === 'month') {
    if (salt && secret.birthMonthHash) {
      valid = safeEqualHash(salt, value, secret.birthMonthHash);
    } else if (secret.birthMonth !== undefined) {
      valid = Number(value) === Number(secret.birthMonth);
    }
  } else if (step === 'year') {
    if (salt && secret.birthYearHash) {
      valid = safeEqualHash(salt, value, secret.birthYearHash);
    } else if (secret.birthYear !== undefined) {
      valid = Number(value) === Number(secret.birthYear);
    }
  } else if (step === 'custom' && questionId) {
    if (salt && Array.isArray(secret.customAnswerHashes)) {
      const target = secret.customAnswerHashes.find(
        (item: { id: string; answerHash: string }) => item.id === questionId
      );
      if (target) valid = safeEqualHash(salt, value, target.answerHash);
    } else if (Array.isArray(secret.customAnswers)) {
      const q = secret.customAnswers.find(
        (item: { id: string; answer: string }) => item.id === questionId
      );
      if (q) valid = safeEqualPlain(value, q.answer);
    }
  }

  const maxRetries = typeof secret.maxRetries === 'number' && secret.maxRetries >= 0 ? secret.maxRetries : 5;
  if (!valid) {
    tracker.count += 1;
    const unlimited = maxRetries === 0;
    if (!unlimited && tracker.count >= maxRetries) {
      tracker.lockedUntil = Date.now() + 60 * 1000;
      tracker.count = 0;
      attemptTracker.set(key, tracker);
      res.json({
        valid: false,
        locked: true,
        remainingAttempts: 0,
        message: 'Maximum tries reached. Please wait 60 seconds and try again.',
      });
      return;
    }
    attemptTracker.set(key, tracker);
    res.json({
      valid: false,
      locked: false,
      remainingAttempts: unlimited ? 99 : Math.max(0, maxRetries - tracker.count),
      message: 'That answer does not quite match. Give it another try!',
    });
    return;
  }

  res.json({ valid: true, locked: false });
});

router.post('/greetings/:id/verify', async (req: Request, res: Response) => {
  const greetingId = String(req.params.id || '');
  if (!isValidId(greetingId)) {
    res.status(400).json({ verified: false, message: 'Invalid greeting ID.' });
    return;
  }

  const secretSnap = await db.doc(`greetings/${greetingId}/secrets/verification`).get();
  if (!secretSnap.exists) {
    res.status(404).json({ verified: false, message: 'Verification configuration not found.' });
    return;
  }

  const secret = secretSnap.data() || {};
  const key = getAttemptKey(greetingId, req);
  const tracker = attemptTracker.get(key) || { count: 0, lockedUntil: 0 };
  if (tracker.lockedUntil > Date.now()) {
    const waitSec = Math.ceil((tracker.lockedUntil - Date.now()) / 1000);
    res.status(429).json({
      verified: false,
      locked: true,
      remainingAttempts: 0,
      message: `Too many attempts. Please wait ${waitSec} seconds.`,
    });
    return;
  }

  const { birthDay, birthMonth, birthYear, customAnswers } = req.body as {
    birthDay?: number;
    birthMonth?: number;
    birthYear?: number;
    customAnswers?: Record<string, string>;
  };

  let allValid = true;
  const salt = typeof secret.salt === 'string' ? secret.salt : '';

  if (salt && secret.birthDayHash) {
    if (!safeEqualHash(salt, birthDay, secret.birthDayHash)) allValid = false;
  } else if (secret.birthDay !== undefined && Number(birthDay) !== Number(secret.birthDay)) {
    allValid = false;
  }

  if (salt && secret.birthMonthHash) {
    if (!safeEqualHash(salt, birthMonth, secret.birthMonthHash)) allValid = false;
  } else if (secret.birthMonth !== undefined && Number(birthMonth) !== Number(secret.birthMonth)) {
    allValid = false;
  }

  if (salt && secret.birthYearHash) {
    if (!safeEqualHash(salt, birthYear, secret.birthYearHash)) allValid = false;
  } else if (secret.birthYear !== undefined && Number(birthYear) !== Number(secret.birthYear)) {
    allValid = false;
  }

  if (salt && Array.isArray(secret.customAnswerHashes)) {
    for (const q of secret.customAnswerHashes as Array<{ id: string; answerHash: string }>) {
      if (!safeEqualHash(salt, customAnswers?.[q.id] ?? '', q.answerHash)) {
        allValid = false;
        break;
      }
    }
  } else if (Array.isArray(secret.customAnswers)) {
    for (const q of secret.customAnswers as Array<{ id: string; answer: string }>) {
      if (!safeEqualPlain(customAnswers?.[q.id] ?? '', q.answer)) {
        allValid = false;
        break;
      }
    }
  }

  const maxRetries = typeof secret.maxRetries === 'number' && secret.maxRetries >= 0 ? secret.maxRetries : 5;
  if (!allValid) {
    tracker.count += 1;
    const unlimited = maxRetries === 0;
    if (!unlimited && tracker.count >= maxRetries) {
      tracker.lockedUntil = Date.now() + 60 * 1000;
      tracker.count = 0;
    }
    attemptTracker.set(key, tracker);
    res.json({
      verified: false,
      locked: tracker.lockedUntil > Date.now(),
      remainingAttempts: unlimited ? 99 : Math.max(0, maxRetries - tracker.count),
      message: 'One or more answers did not match.',
    });
    return;
  }

  attemptTracker.delete(key);
  res.json({
    verified: true,
    unlockedPayload: secret.unlockedPayload || {},
  });
});

router.post('/greetings/:id/view', async (req: Request, res: Response) => {
  const greetingId = String(req.params.id || '');
  if (!isValidId(greetingId)) {
    res.status(400).json({ error: 'Invalid greeting ID.' });
    return;
  }
  const ref = db.doc(`greetings/${greetingId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.status !== 'published') {
    res.status(404).json({ error: 'Greeting not found.' });
    return;
  }
  await ref.update({ viewCount: FieldValue.increment(1) });
  res.json({ viewCount: Number(snap.data()?.viewCount || 0) + 1 });
});

router.post('/greetings/:id/report', async (req: Request, res: Response) => {
  const greetingId = String(req.params.id || '');
  if (!isValidId(greetingId)) {
    res.status(400).json({ error: 'Invalid greeting ID.' });
    return;
  }
  const ref = db.doc(`greetings/${greetingId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'Greeting not found.' });
    return;
  }
  await ref.update({ isReported: true });
  res.json({ ok: true });
});

// Mount on both `/` (for https://<region>-<project>.cloudfunctions.net/api/...)
// and `/api` (for proxies that forward the `/api` prefix)
app.use('/api', router);
app.use('/', router);

export const api = onRequest({ cors: true }, app);
