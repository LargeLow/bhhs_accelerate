import { useState } from 'react';
import type { Platform } from '../../shared/content-types';

interface Props {
  platform: Platform;
  prompt: string;
}

export default function ImageGenerator({ platform, prompt }: Props) {
  const [loading, setLoading] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    setImageData(null);

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, prompt }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Generation failed');
        return;
      }

      const { imageData: b64 } = await res.json();
      setImageData(b64);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!imageData) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${imageData}`;
    link.download = `bhhs-${platform}-image.png`;
    link.click();
  }

  return (
    <div className="mt-3 space-y-3">
      {!imageData && (
        <button
          onClick={generate}
          disabled={loading}
          className="w-full bg-bhhs-maroon text-white text-xs py-2 rounded hover:bg-bhhs-dark transition-colors disabled:opacity-60"
        >
          {loading ? 'Generating… (15–30s)' : 'Generate Image with DALL-E 3'}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {imageData && (
        <div className="space-y-2">
          <img
            src={`data:image/png;base64,${imageData}`}
            alt="Generated visual"
            className="w-full rounded-lg border border-gray-200"
          />
          <div className="flex gap-2">
            <button
              onClick={download}
              className="flex-1 bg-bhhs-maroon text-white text-xs py-2 rounded hover:bg-bhhs-dark transition-colors"
            >
              Download PNG
            </button>
            <button
              onClick={() => { setImageData(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-3"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
