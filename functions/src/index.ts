import * as crypto from 'node:crypto';
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

function normalizeAnswer(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function safeEqual(a: unknown, b: unknown): boolean {
  const s1 = Buffer.from(normalizeAnswer(a));
  const s2 = Buffer.from(normalizeAnswer(b));
  if (s1.length !== s2.length) return false;
  return crypto.timingSafeEqual(s1, s2);
}

app.post('/greetings/:id/check-step', async (req, res) => {
  const greetingId = req.params.id;
  const secretSnap = await db.doc(`greetings/${greetingId}/secrets/verification`).get();
  if (!secretSnap.exists) {
    res.status(404).json({ valid: false, message: 'Verification configuration not found.' });
    return;
  }

  const secret = secretSnap.data() || {};
  const { step, value, questionId } = req.body as {
    step: 'day' | 'month' | 'year' | 'custom';
    value: unknown;
    questionId?: string;
  };

  let valid = false;
  if (step === 'day' && secret.birthDay !== undefined) {
    valid = Number(value) === Number(secret.birthDay);
  } else if (step === 'month' && secret.birthMonth !== undefined) {
    valid = Number(value) === Number(secret.birthMonth);
  } else if (step === 'year' && secret.birthYear !== undefined) {
    valid = Number(value) === Number(secret.birthYear);
  } else if (step === 'custom' && questionId && Array.isArray(secret.customAnswers)) {
    const q = secret.customAnswers.find((item: { id: string; answer: string }) => item.id === questionId);
    if (q) valid = safeEqual(value, q.answer);
  }

  res.json({
    valid,
    message: valid ? 'Verified' : 'That answer does not quite match. Give it another try!',
  });
});

app.post('/greetings/:id/verify', async (req, res) => {
  const greetingId = req.params.id;
  const secretSnap = await db.doc(`greetings/${greetingId}/secrets/verification`).get();
  if (!secretSnap.exists) {
    res.status(404).json({ verified: false, message: 'Verification configuration not found.' });
    return;
  }

  const secret = secretSnap.data() || {};
  const { birthDay, birthMonth, birthYear, customAnswers } = req.body as {
    birthDay?: number;
    birthMonth?: number;
    birthYear?: number;
    customAnswers?: Record<string, string>;
  };

  let allValid = true;
  if (secret.birthDay !== undefined && Number(birthDay) !== Number(secret.birthDay)) allValid = false;
  if (secret.birthMonth !== undefined && Number(birthMonth) !== Number(secret.birthMonth)) allValid = false;
  if (secret.birthYear !== undefined && Number(birthYear) !== Number(secret.birthYear)) allValid = false;
  if (Array.isArray(secret.customAnswers)) {
    for (const q of secret.customAnswers as Array<{ id: string; answer: string }>) {
      if (!safeEqual(customAnswers?.[q.id] ?? '', q.answer)) {
        allValid = false;
        break;
      }
    }
  }

  if (!allValid) {
    res.json({ verified: false, message: 'One or more answers did not match.' });
    return;
  }

  res.json({
    verified: true,
    unlockedPayload: secret.unlockedPayload || {},
  });
});

export const api = onRequest({ cors: true }, app);
