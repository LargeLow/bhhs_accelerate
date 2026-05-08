import { useRef, useState } from 'react';
import type { Platform, CampaignImageRecord } from '../../shared/content-types';

interface Props {
  campaignId: string;
  platform: Platform;
  existing: CampaignImageRecord | undefined;
  onUploaded: (img: CampaignImageRecord) => void;
  onDeleted: () => void;
}

export default function AdminImageUpload({ campaignId, platform, existing, onUploaded, onDeleted }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('image', file);
    formData.append('platform', platform);

    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/images`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Upload failed');
        return;
      }
      // Refetch the full image data by triggering parent refresh via optimistic update
      const meta = await res.json() as { id: string; platform: string; filename: string };
      onUploaded({ id: meta.id, platform: meta.platform as CampaignImageRecord['platform'], filename: meta.filename });
    } catch {
      setError('Network error — please try again');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    try {
      await fetch(`/api/admin/campaigns/${campaignId}/images/${existing.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      onDeleted();
    } catch {
      setError('Delete failed');
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-bhhs-maroon/20">
      <p className="text-xs font-semibold uppercase tracking-wider text-bhhs-maroon mb-2">
        Admin Override Image
      </p>

      {existing ? (
        <div className="space-y-2">
          <img
            src={`/api/campaigns/${campaignId}/images/${existing.id}`}
            alt="Admin override"
            className="w-full rounded border border-gray-200"
          />
          <p className="text-xs text-gray-400 truncate">{existing.filename}</p>
          <div className="flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex-1 text-xs border border-bhhs-maroon text-bhhs-maroon py-1.5 rounded hover:bg-bhhs-cream transition-colors"
            >
              Replace
            </button>
            <button
              onClick={handleDelete}
              className="text-xs text-gray-400 hover:text-red-500 px-3 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-bhhs-maroon/40 text-bhhs-maroon text-xs py-3 rounded hover:border-bhhs-maroon hover:bg-bhhs-cream transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : '+ Upload team image'}
        </button>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
