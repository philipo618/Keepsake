import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import dotenv from 'dotenv';

function resolveFfmpegBinary(): string | null {
  for (const candidate of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg']) {
    try {
      const check = spawnSync(candidate, ['-version'], { encoding: 'utf8', timeout: 3000 });
      if (check.status === 0) return candidate;
    } catch {
      // Try next candidate
    }
  }
  return null;
}

const FFMPEG_BIN = resolveFfmpegBinary();

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = process.cwd();
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const VAULT_FILE = path.join(DATA_DIR, 'verification-vault.json');
const STATS_FILE = path.join(DATA_DIR, 'greeting-stats.json');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Read Firebase Project & Database IDs safely from firebase-applet-config.json
let FIREBASE_PROJECT_ID = '';
let FIREBASE_DATABASE_ID = '';
try {
  const fbConfigRaw = fs.readFileSync(path.join(ROOT_DIR, 'firebase-applet-config.json'), 'utf8');
  const fbConfig = JSON.parse(fbConfigRaw);
  FIREBASE_PROJECT_ID = fbConfig.projectId || '';
  FIREBASE_DATABASE_ID = fbConfig.firestoreDatabaseId || '';
} catch {
  FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
  FIREBASE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '';
}

function isValidGreetingId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

interface StoredSecret {
  greetingId: string;
  creatorId: string;
  salt: string;
  birthDayHash?: string;
  birthMonthHash?: string;
  birthYearHash?: string;
  customAnswerHashes: Array<{ id: string; answerHash: string }>;
  maxRetries: number;
  unlockedPayload: Record<string, unknown>;
  updatedAt: string;
}

interface VaultData {
  secrets: Record<string, StoredSecret>;
}

interface StatsData {
  views: Record<string, number>;
  reports: Array<{ greetingId: string; reason: string; reportedAt: string }>;
}

function readVault(): VaultData {
  try {
    if (!fs.existsSync(VAULT_FILE)) return { secrets: {} };
    return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')) as VaultData;
  } catch {
    return { secrets: {} };
  }
}

function writeVault(data: VaultData) {
  fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function readStats(): StatsData {
  try {
    if (!fs.existsSync(STATS_FILE)) return { views: {}, reports: [] };
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) as StatsData;
  } catch {
    return { views: {}, reports: [] };
  }
}

function writeStats(data: StatsData) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Cache Google public certs for Firebase ID Token verification
let cachedCerts: Record<string, string> = {};
let certsExpireAt = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (Date.now() < certsExpireAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Failed to fetch Firebase public certificates');
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = (await resp.json()) as Record<string, string>;
  certsExpireAt = Date.now() + maxAgeSec * 1000;
  return cachedCerts;
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

async function verifyFirebaseIdToken(authHeader?: string): Promise<VerifiedFirebaseUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      email?: string;
      email_verified?: boolean;
    };

    if (header.alg !== 'RS256' || !header.kid) return null;
    if (!payload.sub || !payload.exp || payload.exp * 1000 < Date.now()) return null;
    if (FIREBASE_PROJECT_ID) {
      if (payload.aud !== FIREBASE_PROJECT_ID) return null;
      if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    }

    const certs = await getFirebasePublicCerts();
    const cert = certs[header.kid];
    if (!cert) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlDecode(parts[2]);
    const isValid = verifier.verify(cert, signature);
    if (!isValid) return null;

    return {
      uid: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
    };
  } catch {
    return null;
  }
}

function normalizeAnswer(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function hashAnswer(salt: string, val: unknown): string {
  return crypto
    .scryptSync(normalizeAnswer(val), salt, 32)
    .toString('hex');
}

function safeCompareHash(salt: string, candidate: unknown, expectedHash: string): boolean {
  const candidateHash = hashAnswer(salt, candidate);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// In-memory retry tracking per (greetingId + clientIp)
const attemptTracker = new Map<string, { count: number; lockedUntil: number }>();

function getAttemptKey(greetingId: string, req: express.Request): string {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'local';
  return `${greetingId}:${ip}`;
}

function isOriginAllowed(origin: string): boolean {
  const configured = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length === 0) {
    return true;
  }
  return configured.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern.includes('*')) {
      const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '.*');
      return new RegExp(`^${escaped}$`).test(origin);
    }
    return pattern === origin;
  });
}

function resolveUploadedMediaUrl(req: express.Request, fileName: string): string {
  const relPath = `/uploads/${fileName}`;
  const origin = req.headers.origin;
  const host = req.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return `${req.protocol}://${host}${relPath}`;
      }
    } catch {
      // Ignore malformed origin header and fall back to relative path
    }
  }
  return relPath;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (!process.env.CORS_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '14mb' }));

  // Serve uploaded media files safely across origins
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(UPLOADS_DIR, { maxAge: '7d' })
  );

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      project: FIREBASE_PROJECT_ID || 'unconfigured',
      databaseId: FIREBASE_DATABASE_ID || '(default)',
      ffmpegAvailable: Boolean(FFMPEG_BIN),
      maxVideoUploadMb: 50,
    });
  });

  // Transcode WebM rendered video into universal H.264/AAC MP4 using FFmpeg
  app.post(
    '/api/video/transcode',
    express.raw({ type: ['video/webm', 'application/octet-stream'], limit: '85mb' }),
    async (req, res) => {
      if (!FFMPEG_BIN) {
        res.status(501).json({ error: 'FFmpeg is not available on this server.' });
        return;
      }
      const inputBuffer = req.body as Buffer;
      if (!Buffer.isBuffer(inputBuffer) || inputBuffer.byteLength < 64) {
        res.status(400).json({ error: 'Invalid or empty WebM video payload.' });
        return;
      }
      // Validate EBML header (0x1A 0x45 0xDF 0xA3)
      if (
        inputBuffer[0] !== 0x1a ||
        inputBuffer[1] !== 0x45 ||
        inputBuffer[2] !== 0xdf ||
        inputBuffer[3] !== 0xa3
      ) {
        res.status(415).json({ error: 'Uploaded bytes do not match a valid WebM container.' });
        return;
      }

      const rawFps = Number(req.query.fps) === 24 ? 24 : 30;
      const quality = String(req.query.quality || 'high');
      const crf = quality === 'ultra' ? '18' : quality === 'standard' ? '26' : '22';
      const safeTitle = String(req.query.title || 'Keepsake_Memory')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .slice(0, 48);

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keepsake-ffmpeg-'));
      const inputPath = path.join(tmpDir, 'input.webm');
      const outputPath = path.join(tmpDir, 'output.mp4');

      try {
        fs.writeFileSync(inputPath, inputBuffer);
        await new Promise<void>((resolve, reject) => {
          const ffArgs = [
            '-y',
            '-i',
            inputPath,
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            '-crf',
            crf,
            '-pix_fmt',
            'yuv420p',
            '-vf',
            'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-r',
            String(rawFps),
            '-c:a',
            'aac',
            '-b:a',
            '160k',
            '-movflags',
            '+faststart',
            outputPath,
          ];
          const child = spawn(FFMPEG_BIN, ffArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
          let stderr = '';
          child.stderr.on('data', (chunk) => {
            if (stderr.length < 4096) stderr += chunk.toString();
          });
          const killTimer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error('FFmpeg transcoding timed out after 90 seconds.'));
          }, 90_000);
          child.on('error', (err) => {
            clearTimeout(killTimer);
            reject(err);
          });
          child.on('close', (code) => {
            clearTimeout(killTimer);
            if (code !== 0) {
              reject(new Error(`FFmpeg failed with exit code ${code}: ${stderr.slice(-300)}`));
              return;
            }
            resolve();
          });
        });

        if (!fs.existsSync(outputPath)) {
          throw new Error('MP4 output file was not created by FFmpeg.');
        }
        const mp4Bytes = fs.readFileSync(outputPath);
        if (mp4Bytes.byteLength < 128) {
          throw new Error('FFmpeg produced an empty MP4 output.');
        }

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);
        res.setHeader('Content-Length', String(mp4Bytes.byteLength));
        res.send(mp4Bytes);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'MP4 transcoding error.';
        res.status(500).json({ error: msg });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  );

  // Binary upload endpoint for creator-attached exported video (max 50 MB)
  app.post(
    '/api/video/upload',
    express.raw({ type: ['video/mp4', 'video/webm'], limit: '52mb' }),
    async (req, res) => {
      const user = await verifyFirebaseIdToken(req.headers.authorization);
      if (!user) {
        res.status(401).json({ error: 'Authentication required to attach exported video.' });
        return;
      }
      const contentType = String(req.headers['content-type'] || '').split(';')[0].trim();
      if (contentType !== 'video/mp4' && contentType !== 'video/webm') {
        res.status(415).json({ error: `Unsupported video format: ${contentType}` });
        return;
      }
      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.byteLength < 128) {
        res.status(400).json({ error: 'Invalid or empty video payload.' });
        return;
      }
      if (buf.byteLength > 50 * 1024 * 1024) {
        res.status(413).json({ error: 'Video exceeds the 50 MB attachment limit.' });
        return;
      }
      if (contentType === 'video/mp4') {
        const sig = buf.subarray(4, 8).toString('ascii');
        if (sig !== 'ftyp') {
          res.status(415).json({ error: 'Invalid MP4 signature.' });
          return;
        }
      } else if (buf[0] !== 0x1a || buf[1] !== 0x45 || buf[2] !== 0xdf || buf[3] !== 0xa3) {
        res.status(415).json({ error: 'Invalid WebM signature.' });
        return;
      }

      const ext = contentType === 'video/mp4' ? '.mp4' : '.webm';
      const safeName = String(req.query.fileName || 'video')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 32) || 'video';
      const uniqueName = `${user.uid.slice(0, 8)}_${Date.now()}_${safeName}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, uniqueName), buf);

      res.json({
        url: resolveUploadedMediaUrl(req, uniqueName),
        sizeBytes: buf.byteLength,
        mimeType: contentType,
      });
    }
  );

  // Upload media fallback when Firebase Storage bucket is unavailable or CORS-blocked
  app.post('/api/media/upload', async (req, res) => {
    const user = await verifyFirebaseIdToken(req.headers.authorization);
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
    ];
    if (!allowedMimes.includes(detectedMime)) {
      res.status(415).json({ error: `Unsupported media format: ${detectedMime}` });
      return;
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.byteLength > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'File exceeds the 10 MB upload limit.' });
      return;
    }

    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'audio/x-wav': '.wav',
      'audio/ogg': '.ogg',
    };
    const ext = extMap[detectedMime] || '.bin';
    const safePrefix = (fileName || 'media').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'media';
    const uniqueName = `${user.uid.slice(0, 8)}_${Date.now()}_${safePrefix}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, uniqueName), buffer);

    res.json({
      url: resolveUploadedMediaUrl(req, uniqueName),
      sizeBytes: buffer.byteLength,
      mimeType: detectedMime,
    });
  });

  // Store protected verification answers & sealed greeting payload
  app.post('/api/greetings/:id/secrets', async (req, res) => {
    const user = await verifyFirebaseIdToken(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const greetingId = req.params.id;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(greetingId)) {
      res.status(400).json({ error: 'Invalid greeting ID.' });
      return;
    }

    const vault = readVault();
    const existingSecret = vault.secrets[greetingId];
    const isAdminUser = user.email === 'philipodickson96@gmail.com' && user.emailVerified === true;
    if (existingSecret && existingSecret.creatorId !== user.uid && !isAdminUser) {
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
    const secretRecord: StoredSecret = {
      greetingId,
      creatorId: existingSecret?.creatorId || user.uid,
      salt,
      birthDayHash: birthDay ? hashAnswer(salt, birthDay) : undefined,
      birthMonthHash: birthMonth ? hashAnswer(salt, birthMonth) : undefined,
      birthYearHash: birthYear ? hashAnswer(salt, birthYear) : undefined,
      customAnswerHashes: Array.isArray(customAnswers)
        ? customAnswers.slice(0, 10).map((item) => ({
            id: String(item.id),
            answerHash: hashAnswer(salt, item.answer),
          }))
        : [],
      maxRetries: typeof maxRetries === 'number' && maxRetries >= 0 ? maxRetries : 5,
      unlockedPayload: unlockedPayload || {},
      updatedAt: new Date().toISOString(),
    };

    vault.secrets[greetingId] = secretRecord;
    writeVault(vault);
    res.json({ ok: true });
  });

  app.delete('/api/greetings/:id/secrets', async (req, res) => {
    const user = await verifyFirebaseIdToken(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const greetingId = req.params.id;
    if (!isValidGreetingId(greetingId)) {
      res.status(400).json({ error: 'Invalid greeting ID.' });
      return;
    }
    const vault = readVault();
    const existingSecret = vault.secrets[greetingId];
    const isAdminUser = user.email === 'philipodickson96@gmail.com' && user.emailVerified === true;
    if (existingSecret && existingSecret.creatorId !== user.uid && !isAdminUser) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    delete vault.secrets[greetingId];
    writeVault(vault);
    res.json({ ok: true });
  });

  // Step-by-step verification endpoint (never leaks expected answer)
  app.post('/api/greetings/:id/check-step', (req, res) => {
    const greetingId = req.params.id;
    if (!isValidGreetingId(greetingId)) {
      res.status(400).json({ valid: false, message: 'Invalid greeting ID.' });
      return;
    }
    const vault = readVault();
    const secret = vault.secrets[greetingId];
    if (!secret) {
      res.status(404).json({ valid: false, message: 'Verification configuration not found.' });
      return;
    }

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
    if (step === 'day' && secret.birthDayHash) {
      valid = safeCompareHash(secret.salt, value, secret.birthDayHash);
    } else if (step === 'month' && secret.birthMonthHash) {
      valid = safeCompareHash(secret.salt, value, secret.birthMonthHash);
    } else if (step === 'year' && secret.birthYearHash) {
      valid = safeCompareHash(secret.salt, value, secret.birthYearHash);
    } else if (step === 'custom' && questionId) {
      const target = secret.customAnswerHashes.find((q) => q.id === questionId);
      if (target) {
        valid = safeCompareHash(secret.salt, value, target.answerHash);
      }
    }

    if (!valid) {
      tracker.count += 1;
      const unlimited = secret.maxRetries === 0;
      if (!unlimited && tracker.count >= secret.maxRetries) {
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
        remainingAttempts: unlimited ? 99 : Math.max(0, secret.maxRetries - tracker.count),
        message: 'That answer does not quite match. Give it another try!',
      });
      return;
    }

    res.json({ valid: true, locked: false });
  });

  // Full sequence verification & payload unlock
  app.post('/api/greetings/:id/verify', (req, res) => {
    const greetingId = req.params.id;
    if (!isValidGreetingId(greetingId)) {
      res.status(400).json({ verified: false, message: 'Invalid greeting ID.' });
      return;
    }
    const vault = readVault();
    const secret = vault.secrets[greetingId];
    if (!secret) {
      res.status(404).json({ verified: false, message: 'Greeting verification not found.' });
      return;
    }

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
    if (secret.birthDayHash && !safeCompareHash(secret.salt, birthDay, secret.birthDayHash)) {
      allValid = false;
    }
    if (secret.birthMonthHash && !safeCompareHash(secret.salt, birthMonth, secret.birthMonthHash)) {
      allValid = false;
    }
    if (secret.birthYearHash && !safeCompareHash(secret.salt, birthYear, secret.birthYearHash)) {
      allValid = false;
    }
    for (const q of secret.customAnswerHashes) {
      const submitted = customAnswers?.[q.id] ?? '';
      if (!safeCompareHash(secret.salt, submitted, q.answerHash)) {
        allValid = false;
        break;
      }
    }

    if (!allValid) {
      tracker.count += 1;
      const unlimited = secret.maxRetries === 0;
      if (!unlimited && tracker.count >= secret.maxRetries) {
        tracker.lockedUntil = Date.now() + 60 * 1000;
        tracker.count = 0;
      }
      attemptTracker.set(key, tracker);
      res.json({
        verified: false,
        locked: tracker.lockedUntil > Date.now(),
        remainingAttempts: unlimited ? 99 : Math.max(0, secret.maxRetries - tracker.count),
        message: 'One or more answers did not match.',
      });
      return;
    }

    attemptTracker.delete(key);
    res.json({
      verified: true,
      unlockedPayload: secret.unlockedPayload,
    });
  });

  // View & report tracking
  app.post('/api/greetings/:id/view', (req, res) => {
    const id = req.params.id;
    if (!isValidGreetingId(id)) {
      res.status(400).json({ error: 'Invalid greeting ID.' });
      return;
    }
    const stats = readStats();
    stats.views[id] = (stats.views[id] || 0) + 1;
    writeStats(stats);
    res.json({ viewCount: stats.views[id] });
  });

  app.post('/api/greetings/:id/report', (req, res) => {
    const id = req.params.id;
    if (!isValidGreetingId(id)) {
      res.status(400).json({ error: 'Invalid greeting ID.' });
      return;
    }
    const stats = readStats();
    const { reason } = req.body as { reason?: string };
    stats.reports.push({
      greetingId: id,
      reason: String(reason || 'Inappropriate content').slice(0, 300),
      reportedAt: new Date().toISOString(),
    });
    writeStats(stats);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(indexHtml);
      });
    } else {
      app.get('/', (_req, res) => {
        res.json({ ok: true, service: 'keepsake-api', health: '/api/health' });
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Keepsake server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
