import { useState } from 'react';
import { ArrowUp, ImagePlus, Search, Star, Trash2, Upload } from 'lucide-react';
import { searchLicensedStockPhotos, uploadMediaFile, type StockPhotoResult } from '../lib/imageUtils';
import { STUDIO_ASSETS } from '../lib/assets';
import { useApp } from './AppContext';
import type { PhotoItem, PhotoTransitionType } from '../lib/types';

export function PhotoManagerPanel({
  greetingId,
  photos,
  maxPhotos,
  onChange,
}: {
  greetingId: string;
  photos: PhotoItem[];
  maxPhotos: number;
  onChange: (next: PhotoItem[]) => void;
}) {
  const { user, promptAuth } = useApp();
  const [sourceTab, setSourceTab] = useState<'upload' | 'stock' | 'studio' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Stock search state
  const [stockQuery, setStockQuery] = useState('');
  const [stockResults, setStockResults] = useState<StockPhotoResult[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');

  // External URL state
  const [externalUrl, setExternalUrl] = useState('');
  const [externalCaption, setExternalCaption] = useState('');

  // Crop / Position modal state
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!user) {
      promptAuth('Sign in to upload personal photographs from your device.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const remaining = Math.max(0, maxPhotos - photos.length);
      const selectedFiles = Array.from(files).slice(0, remaining);
      const added: PhotoItem[] = [];

      for (const file of selectedFiles) {
        const res = await uploadMediaFile(file, greetingId, 'image');
        added.push({
          id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          url: res.url,
          caption: file.name.replace(/\.[^.]+$/, '').slice(0, 60),
          sourceType: 'uploaded',
          isCover: photos.length === 0 && added.length === 0,
          cropPosition: { x: 50, y: 50, zoom: 1 },
          transition: 'fade',
        });
      }
      onChange([...photos, ...added]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleStockSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockQuery.trim()) return;
    setStockLoading(true);
    setStockError('');
    try {
      const results = await searchLicensedStockPhotos(stockQuery);
      setStockResults(results);
      if (results.length === 0) {
        setStockError('No openly licensed images found for that search term.');
      }
    } catch (err) {
      setStockError(err instanceof Error ? err.message : 'Stock image search failed.');
    } finally {
      setStockLoading(false);
    }
  };

  const addStockPhoto = (item: StockPhotoResult) => {
    if (photos.length >= maxPhotos) return;
    onChange([
      ...photos,
      {
        id: `ph_${Date.now()}_${item.id}`,
        url: item.fullUrl,
        caption: item.title.slice(0, 80),
        sourceType: 'licensed-stock',
        license: item.license,
        attribution: item.attribution,
        isCover: photos.length === 0,
        cropPosition: { x: 50, y: 50, zoom: 1 },
        transition: 'fade',
      },
    ]);
  };

  const addStudioPhoto = (title: string, url: string) => {
    if (photos.length >= maxPhotos) return;
    onChange([
      ...photos,
      {
        id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url,
        caption: title,
        sourceType: 'licensed-stock',
        license: 'Keepsake Studio Artwork',
        attribution: 'Keepsake Studio',
        isCover: photos.length === 0,
        cropPosition: { x: 50, y: 50, zoom: 1 },
        transition: 'fade',
      },
    ]);
  };

  const addExternalUrl = () => {
    const clean = externalUrl.trim();
    if (!clean || photos.length >= maxPhotos) return;
    onChange([
      ...photos,
      {
        id: `ph_${Date.now()}_ext`,
        url: clean,
        caption: externalCaption.trim() || 'Linked Image',
        sourceType: 'external-url',
        license: 'External Link (User Provided)',
        isCover: photos.length === 0,
        cropPosition: { x: 50, y: 50, zoom: 1 },
        transition: 'fade',
      },
    ]);
    setExternalUrl('');
    setExternalCaption('');
  };

  const setCover = (id: string) => {
    onChange(photos.map((p) => ({ ...p, isCover: p.id === id })));
  };

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const copy = [...photos];
    const [item] = copy.splice(idx, 1);
    copy.splice(idx - 1, 0, item);
    onChange(copy);
  };

  const updatePhoto = (id: string, patch: Partial<PhotoItem>) => {
    onChange(photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const editingPhoto = photos.find((p) => p.id === editingPhotoId) || null;

  return (
    <div className="space-y-6">
      {/* Source Mode Switcher */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {(
          [
            { id: 'upload', label: 'Device Upload' },
            { id: 'stock', label: 'Licensed Stock (Commons)' },
            { id: 'studio', label: 'Studio Artwork' },
            { id: 'url', label: 'External URL' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSourceTab(tab.id)}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sourceTab === tab.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Upload Panel */}
      {sourceTab === 'upload' && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center space-y-3 bg-slate-50/70 dark:bg-slate-900/40">
          <Upload className="w-7 h-7 mx-auto text-rose-700 dark:text-rose-400" />
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Upload one or multiple photographs
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Automatically compressed for mobile speed. Up to {maxPhotos} photos per card.
            </p>
          </div>
          <label className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium cursor-pointer hover:opacity-90">
            <span>{uploading ? 'Uploading & Optimizing...' : 'Select Photos from Device'}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading || photos.length >= maxPhotos}
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </label>
          {uploadError && <p className="text-xs text-rose-600 dark:text-rose-400">{uploadError}</p>}
        </div>
      )}

      {/* Wikimedia Commons Real Stock Search */}
      {sourceTab === 'stock' && (
        <div className="space-y-4">
          <form onSubmit={handleStockSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                placeholder="Search openly licensed photos (e.g., flowers, birthday cake, sunset)..."
                className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:border-rose-600"
              />
            </div>
            <button
              type="submit"
              disabled={stockLoading}
              className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium shrink-0"
            >
              {stockLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Powered by Wikimedia Commons public API. Every image displays its Creative Commons / Public Domain license and attribution.
          </p>
          {stockError && <p className="text-xs text-rose-600 dark:text-rose-400">{stockError}</p>}
          {stockResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stockResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addStockPhoto(item)}
                  className="text-left rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-rose-500 transition-colors bg-white dark:bg-slate-900"
                >
                  <img
                    src={item.thumbUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <div className="p-2 space-y-0.5">
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{item.license}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Curated Studio Artwork */}
      {sourceTab === 'studio' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { title: 'Linen Card & Velvet Box', url: STUDIO_ASSETS.heroGift },
            { title: 'Candlelight Birthday Cake', url: STUDIO_ASSETS.birthday },
            { title: 'Wedding Stationery Suite', url: STUDIO_ASSETS.wedding },
            { title: 'Winter Evergreen & Brass', url: STUDIO_ASSETS.festive },
            { title: 'Pressed Blush Peonies', url: STUDIO_ASSETS.floral },
          ].map((art) => (
            <button
              key={art.title}
              type="button"
              onClick={() => addStudioPhoto(art.title, art.url)}
              className="text-left rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-rose-500 transition-colors bg-white dark:bg-slate-900"
            >
              <img src={art.url} alt={art.title} className="w-full aspect-[4/3] object-cover" />
              <div className="p-2">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{art.title}</p>
                <p className="text-[11px] text-slate-500">Keepsake Studio Artwork</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* External URL */}
      {sourceTab === 'url' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Link an external image URL you have permission to use. It will be clearly marked as an External URL.
          </p>
          <input
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm outline-none focus:border-rose-600"
          />
          <input
            type="text"
            value={externalCaption}
            onChange={(e) => setExternalCaption(e.target.value)}
            placeholder="Optional caption"
            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm outline-none focus:border-rose-600"
          />
          <button
            type="button"
            onClick={addExternalUrl}
            className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium flex items-center gap-2"
          >
            <ImagePlus className="w-4 h-4" />
            <span>Add External Image</span>
          </button>
        </div>
      )}

      {/* Selected Photos List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Selected Photos ({photos.length} / {maxPhotos})</span>
          <span>Tap Crop &amp; Position to adjust framing</span>
        </div>

        {photos.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center border border-slate-200 dark:border-slate-800 rounded-xl">
            No photos added yet. Upload memories or explore licensed artwork above.
          </p>
        ) : (
          <div className="space-y-3">
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center"
              >
                <div className="w-24 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Selected photo'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${photo.cropPosition.x}% ${photo.cropPosition.y}%`,
                      transform: `scale(${photo.cropPosition.zoom})`,
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1.5 w-full">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {photo.sourceType === 'uploaded'
                        ? 'Uploaded Photo'
                        : photo.sourceType === 'licensed-stock'
                        ? `Licensed Stock (${photo.license || 'CC'})`
                        : 'External URL'}
                    </span>
                    {photo.isCover && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-700 dark:text-rose-400 font-medium">Cover Photo</span>
                      </>
                    )}
                  </div>

                  <input
                    type="text"
                    value={photo.caption || ''}
                    onChange={(e) => updatePhoto(photo.id, { caption: e.target.value })}
                    placeholder="Photo caption..."
                    className="w-full min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs outline-none focus:border-rose-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingPhotoId(photo.id)}
                    className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Crop &amp; Motion
                  </button>
                  <button
                    type="button"
                    onClick={() => setCover(photo.id)}
                    title="Set as cover photo"
                    className={`min-h-[38px] min-w-[38px] rounded-lg border flex items-center justify-center ${
                      photo.isCover
                        ? 'border-rose-600 text-rose-600 bg-rose-50 dark:bg-rose-950/30'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => moveUp(idx)}
                      title="Move earlier"
                      className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center justify-center"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(photos.filter((p) => p.id !== photo.id))}
                    title="Remove photo"
                    className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crop & Transition Modal */}
      {editingPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#131924] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                Crop, Position &amp; Transition
              </h3>
              <button
                type="button"
                onClick={() => setEditingPhotoId(null)}
                className="min-h-[40px] min-w-[40px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <img
                src={editingPhoto.url}
                alt="Crop preview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${editingPhoto.cropPosition.x}% ${editingPhoto.cropPosition.y}%`,
                  transform: `scale(${editingPhoto.cropPosition.zoom})`,
                }}
              />
            </div>

            <div className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="text-slate-600 dark:text-slate-300">
                  Horizontal Focus ({editingPhoto.cropPosition.x}%)
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={editingPhoto.cropPosition.x}
                  onChange={(e) =>
                    updatePhoto(editingPhoto.id, {
                      cropPosition: { ...editingPhoto.cropPosition, x: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-rose-700"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-slate-600 dark:text-slate-300">
                  Vertical Focus ({editingPhoto.cropPosition.y}%)
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={editingPhoto.cropPosition.y}
                  onChange={(e) =>
                    updatePhoto(editingPhoto.id, {
                      cropPosition: { ...editingPhoto.cropPosition, y: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-rose-700"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-slate-600 dark:text-slate-300">
                  Zoom ({editingPhoto.cropPosition.zoom.toFixed(2)}x)
                </span>
                <input
                  type="range"
                  min={1}
                  max={2}
                  step={0.05}
                  value={editingPhoto.cropPosition.zoom}
                  onChange={(e) =>
                    updatePhoto(editingPhoto.id, {
                      cropPosition: { ...editingPhoto.cropPosition, zoom: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-rose-700"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-slate-600 dark:text-slate-300">Slideshow Transition</span>
                <select
                  value={editingPhoto.transition}
                  onChange={(e) =>
                    updatePhoto(editingPhoto.id, { transition: e.target.value as PhotoTransitionType })
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="fade">Gentle Fade</option>
                  <option value="slide">Smooth Slide</option>
                  <option value="zoom">Ken Burns Zoom</option>
                  <option value="polaroid-float">Floating Polaroid</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setEditingPhotoId(null)}
              className="w-full min-h-[44px] rounded-xl bg-rose-700 text-white text-sm font-medium"
            >
              Done Framing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
