import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { buildApiUrl, hasApiBackend, verifyApiBackendReachable } from './api';
import { auth, storage } from './firebase';

export async function compressImageFile(file: File, maxDimension = 1600, quality = 0.82): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputMime, quality);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            resolve({ dataUrl, blob });
          },
          outputMime,
          quality
        );
      };
      img.onerror = () => reject(new Error('Could not decode image file'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadMediaFile(
  file: File,
  greetingId: string,
  kind: 'image' | 'audio'
): Promise<{ url: string; sizeBytes: number; storageProvider: 'firebase-storage' | 'server-uploads' }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in before uploading media.');
  }

  let uploadBlob: Blob = file;
  let dataUrl = '';
  let mimeType = file.type;

  if (kind === 'image') {
    const compressed = await compressImageFile(file);
    uploadBlob = compressed.blob;
    dataUrl = compressed.dataUrl;
    mimeType = compressed.blob.type || 'image/jpeg';
  } else {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Audio file must be 10 MB or smaller.');
    }
    dataUrl = await fileToDataUrl(file);
  }

  // Attempt Firebase Storage first if initialized
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const storagePath = `greetings/${user.uid}/${greetingId}/${Date.now()}_${safeName}`;
  try {
    const storageRef = ref(storage, storagePath);
    const snap = await Promise.race([
      uploadBytes(storageRef, uploadBlob, { contentType: mimeType }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 6000)),
    ]);
    const url = await getDownloadURL(snap.ref);
    return { url, sizeBytes: uploadBlob.size, storageProvider: 'firebase-storage' };
  } catch (storageErr) {
    const canFallback = hasApiBackend() && (await verifyApiBackendReachable());
    if (!canFallback) {
      const code = (storageErr as { code?: string })?.code || '';
      throw new Error(
        `Firebase Storage upload is unavailable${code ? ` (${code})` : ''} in this static deployment. Use Licensed Stock Search, Studio Artwork, or an External Image URL instead—all work free without Cloud Storage.`
      );
    }
    // Fallback to protected Express media upload endpoint
    const idToken = await user.getIdToken();
    const resp = await fetch(buildApiUrl('/media/upload'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        dataUrl,
        fileName: safeName,
        mimeType,
      }),
    });
    if (!resp.ok) {
      const errBody = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error || 'Media upload failed. Ensure backend or Firebase Storage is configured.');
    }
    const result = (await resp.json()) as { url: string; sizeBytes: number };
    return { url: result.url, sizeBytes: result.sizeBytes, storageProvider: 'server-uploads' };
  }
}

export async function uploadVideoBlob(
  blob: Blob,
  greetingId: string,
  fileName: string,
  format: 'mp4' | 'webm'
): Promise<{ url: string; sizeBytes: number; storageProvider: 'firebase-storage' | 'server-uploads' }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in before attaching a video to your greeting.');
  }
  if (blob.size > 50 * 1024 * 1024) {
    throw new Error('Video file exceeds the 50 MB attachment limit. Try 720p or Standard quality.');
  }

  const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || `video.${format}`;
  const storagePath = `greetings/${user.uid}/${greetingId}/${Date.now()}_${safeName}`;

  try {
    const storageRef = ref(storage, storagePath);
    const snap = await Promise.race([
      uploadBytes(storageRef, blob, { contentType: mimeType }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 15000)),
    ]);
    const url = await getDownloadURL(snap.ref);
    return { url, sizeBytes: blob.size, storageProvider: 'firebase-storage' };
  } catch (storageErr) {
    const canFallback = hasApiBackend() && (await verifyApiBackendReachable());
    if (!canFallback) {
      const code = (storageErr as { code?: string })?.code || '';
      throw new Error(
        `Firebase Storage upload is unavailable${code ? ` (${code})` : ''} without a connected backend. You can still download the rendered video directly to your device at zero cost.`
      );
    }
    const idToken = await user.getIdToken();
    const resp = await fetch(buildApiUrl(`/video/upload?fileName=${encodeURIComponent(safeName)}`), {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        Authorization: `Bearer ${idToken}`,
      },
      body: blob,
    });
    if (!resp.ok) {
      const errBody = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error || 'Video upload failed.');
    }
    const result = (await resp.json()) as { url: string; sizeBytes: number };
    return { url: result.url, sizeBytes: result.sizeBytes, storageProvider: 'server-uploads' };
  }
}

export interface StockPhotoResult {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  license: string;
  attribution: string;
}

/**
 * Legitimate public Wikimedia Commons API search returning openly licensed
 * (Creative Commons / Public Domain) photography with real license & author metadata.
 */
export async function searchLicensedStockPhotos(query: string): Promise<StockPhotoResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
  endpoint.searchParams.set('action', 'query');
  endpoint.searchParams.set('generator', 'search');
  endpoint.searchParams.set('gsrnamespace', '6');
  endpoint.searchParams.set('gsrsearch', `${cleanQuery} filetype:bitmap`);
  endpoint.searchParams.set('gsrlimit', '12');
  endpoint.searchParams.set('prop', 'imageinfo');
  endpoint.searchParams.set('iiprop', 'url|extmetadata|mime');
  endpoint.searchParams.set('iiurlwidth', '800');
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('origin', '*');

  const resp = await fetch(endpoint.toString());
  if (!resp.ok) {
    throw new Error('Could not reach Wikimedia Commons image search.');
  }
  const data = (await resp.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          pageid: number;
          title: string;
          imageinfo?: Array<{
            url?: string;
            thumburl?: string;
            mime?: string;
            extmetadata?: {
              LicenseShortName?: { value?: string };
              Artist?: { value?: string };
            };
          }>;
        }
      >;
    };
  };

  const pages = data.query?.pages ? Object.values(data.query.pages) : [];
  const results: StockPhotoResult[] = [];

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !info.url) continue;
    if (info.mime && !info.mime.startsWith('image/')) continue;
    const rawArtist = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim() || 'Wikimedia Commons Contributor';
    const license = info.extmetadata?.LicenseShortName?.value || 'CC / Public Domain';
    results.push({
      id: String(page.pageid),
      title: page.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
      thumbUrl: info.thumburl,
      fullUrl: info.thumburl,
      license,
      attribution: rawArtist.slice(0, 80),
    });
  }

  return results;
}
