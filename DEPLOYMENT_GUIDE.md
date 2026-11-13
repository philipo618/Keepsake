# Keepsake — Firebase & GitHub Pages Deployment Guide

## Important Plan & Billing Notice
- **Firebase Spark (Free) Plan** includes Firebase Authentication, Cloud Firestore (within free daily quota limits), and Firebase Hosting.
- **Firebase Cloud Functions (v2)** and **Firebase Storage** (beyond free no-cost limits or external outbound network calls) **require the Firebase Blaze (Pay-as-you-go) plan**.
- Without Cloud Functions deployed (or the Express server in `server.ts`), static GitHub Pages builds cannot validate private `greetings/{id}/secrets/verification` answers securely on a backend.

---

## Step 1: Create or Verify Your Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select the provisioned project (`pd-ai-2` in `firebase-applet-config.json`) or create a new Firebase project.

## Step 2: Enable Authentication
1. Go to **Build → Authentication → Sign-in method**.
2. Ensure **Google** is enabled (already configured during provisioning).
3. Optional: Enable **Anonymous** sign-in if you want visitors to save drafts as guest creators without signing in with Google.
4. Add your GitHub Pages domain (e.g., `YOUR-USERNAME.github.io`) under **Authentication → Settings → Authorized domains**.

## Step 3: Verify Cloud Firestore
1. Go to **Build → Firestore Database**.
2. Confirm the database ID matches `firebase-applet-config.json` (`ai-studio-4f3bd88e-95e5-4469-8be1-a33cea212c13`).
3. `functions/src/index.ts` and `firebase.json` are pre-configured to target `ai-studio-4f3bd88e-95e5-4469-8be1-a33cea212c13`.

## Step 4: Enable Firebase Storage
1. Go to **Build → Storage** and click **Get Started**.
2. Deploy `storage.rules` using Firebase CLI:
   ```bash
   firebase deploy --only storage
   ```
3. Configure CORS on your Storage bucket if uploading directly from GitHub Pages.

## Step 5: Configure & Deploy Firebase Cloud Functions (Blaze Plan Required)
1. Upgrade the Firebase project (`pd-ai-2`) to the **Blaze** plan if deploying Cloud Functions for standalone GitHub Pages hosting.
2. Install dependencies, compile, and deploy:
   ```bash
   cd functions
   npm install
   npm run build
   cd ..
   firebase deploy --only functions
   ```
3. Copy the deployed `api` function URL printed by Firebase CLI (format: `https://<region>-pd-ai-2.cloudfunctions.net/api` or Cloud Run `https://api-<hash>-uc.a.run.app`) and set it as `VITE_API_BASE_URL` in your GitHub repository **Settings → Secrets and variables → Actions**.

## Step 6: Apply Firestore Security Rules
1. Rules are stored in `firestore.rules` (and validated with `@firebase/eslint-plugin-security-rules`).
2. Whenever you modify `firestore.rules`, re-deploy via:
   ```bash
   firebase deploy --only firestore:rules
   ```
3. Review `firestore.rules` carefully before broad public launch, especially the `isAdmin()` allowlist.

## Step 7: Connect Firebase to the Application
- Client configuration is stored in `firebase-applet-config.json`.
- Note: Firebase web `apiKey` and `projectId` are public client identifiers, **not** administrator secrets. Security is enforced strictly by Firebase Authentication and Firestore/Storage Security Rules.
- **Never** commit Firebase Admin SDK service-account private keys to GitHub.

## Step 8: Upload the Project to GitHub
```bash
git init
git add .
git commit -m "Initial commit: Keepsake Digital Greeting Cards Platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## Step 9: Enable GitHub Pages
1. In your GitHub repository, open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Under **Settings → Secrets and variables → Actions**, optionally add `VITE_API_BASE_URL` pointing to your deployed Cloud Function / backend URL.
4. Trigger or push to `main` to run `.github/workflows/deploy-gh-pages.yml`.
5. `public/404.html` and `index.html` automatically preserve direct `/g/:id` URLs and browser refreshes on GitHub Pages.

## Step 10: Billing-Free Browser Video Export (WebM & In-Browser MP4)
- **Zero-Backend GitHub Pages Export**: Keepsake renders videos 100% in the browser using `canvas.captureStream` + `MediaRecorder` for universal **WebM (VP9 / Opus)** with synchronized audio, and client-side **WebCodecs + `mp4-muxer`** (or native `MediaRecorder` MP4) for genuine **H.264 / AAC `.mp4`** on supported browsers — **no Cloud Run, no Cloud Functions billing, and no `/api/video/transcode` required**.
- On browsers that do not support in-browser H.264 hardware encoding, Keepsake exports verified native **WebM** automatically without mislabeling the container.
- Optional self-hosted `server.ts` (`/api/video/transcode`) remains available as a bonus fallback when running the local Node server with FFmpeg installed.

## Step 11: Post-Deployment Acceptance Checklist
1. Sign in as the authorized administrator (`philipodickson96@gmail.com`) at `/admin` and click **Seed Default Catalog** to populate Firestore `categories`, `templates`, `mediaLibrary`, and `platformSettings`.
2. Create a birthday greeting card, upload photos, select/upload music, configure Day/Month/Year + custom questions, publish, and test the generated `/g/:id` URL in an incognito window.
3. Verify incorrect verification answers are rejected and valid answers unlock the full animated experience.
4. Open the **Video Export Studio**, preview multiple slideshow styles & photo layouts, export a video, and verify `.mp4` / `.webm` playback cleanly.
5. Verify unauthorized visitors attempting `/admin` receive **Access Denied**.
