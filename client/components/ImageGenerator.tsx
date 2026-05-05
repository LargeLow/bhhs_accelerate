import { useState } from 'react';
import type { Platform } from '../../shared/content-types';

interface Props {
  platform: Platform;
  prompt: string;
  overlayText?: string;   // text to composite onto the image
  overlayTexts?: string[]; // for Stories: multiple hook variations → ZIP
}

export default function ImageGenerator({ platform, prompt, overlayText, overlayTexts }: Props) {
  const [loading, setLoading] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [aiLabel, setAiLabel] = useState(false);

  const isStories = platform === 'stories';
  const hasSlides = isStories && overlayTexts && overlayTexts.length > 0;

  async function generate() {
    setLoading(true);
    setError('');
    setImageData(null);

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, prompt, aiLabel, overlayText }),
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

  async function generateSlides() {
    if (!hasSlides) return;
    setLoading(true);
    setError('');
    setImageData(null);

    try {
      const res = await fetch('/api/images/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, prompt, aiLabel, overlayTexts }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Slide generation failed');
        return;
      }

      const { zipData, slideCount } = await res.json();
      downloadZip(zipData, slideCount);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  function downloadZip(zipData: string, count: number) {
    const link = document.createElement('a');
    link.href = `data:application/zip;base64,${zipData}`;
    link.download = `bhhs-stories-${count}-slides.zip`;
    link.click();
  }

  function downloadImage() {
    if (!imageData) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${imageData}`;
    link.download = `bhhs-${platform}-image.png`;
    link.click();
  }

  const slideLabel = overlayTexts ? `${overlayTexts.length} slide${overlayTexts.length !== 1 ? 's' : ''}` : '';

  return (
    <div className="mt-3 space-y-3">
      {!imageData && (
        <>
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={aiLabel}
              onChange={(e) => setAiLabel(e.target.checked)}
              className="accent-bhhs-maroon"
            />
            Add "AI-Generated Image" label
          </label>

          <button
            onClick={generate}
            disabled={loading}
            className="w-full bg-bhhs-maroon text-white text-xs py-2 rounded hover:bg-bhhs-dark transition-colors disabled:opacity-60"
          >
            {loading ? 'Generating… (15–30s)' : 'Generate Image with DALL-E 3'}
          </button>

          {hasSlides && (
            <button
              onClick={generateSlides}
              disabled={loading}
              className="w-full border border-bhhs-maroon text-bhhs-maroon text-xs py-2 rounded hover:bg-bhhs-cream transition-colors disabled:opacity-60"
            >
              {loading ? `Building ${slideLabel}… (20–40s)` : `Generate ${slideLabel} → Download ZIP`}
            </button>
          )}
        </>
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
              onClick={downloadImage}
              className="flex-1 bg-bhhs-maroon text-white text-xs py-2 rounded hover:bg-bhhs-dark transition-colors"
            >
              Download PNG
            </button>
            <button
              onClick={() => { setImageData(null); setError(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-3"
            >
              Regenerate
            </button>
          </div>
          {hasSlides && (
            <button
              onClick={generateSlides}
              disabled={loading}
              className="w-full border border-bhhs-maroon text-bhhs-maroon text-xs py-2 rounded hover:bg-bhhs-cream transition-colors disabled:opacity-60"
            >
              {loading ? `Building ${slideLabel}…` : `Generate ${slideLabel} → Download ZIP`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
