import { Router, Response } from 'express';
import OpenAI from 'openai';
import JSZip from 'jszip';
import { requireAuth, type AuthenticatedRequest } from '../auth';
import { compositeImage, buildSlides } from '../composite';

export const imagesRouter = Router();
imagesRouter.use(requireAuth);

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error('OPENAI_API_KEY environment variable is not set');
    openai = new OpenAI({ apiKey: key });
  }
  return openai;
}

const PLATFORM_SPECS: Record<string, { size: '1024x1024' | '1024x1792' | '1792x1024'; w: number; h: number }> = {
  instagram: { size: '1024x1024', w: 1024, h: 1024 },
  stories:   { size: '1024x1792', w: 1024, h: 1792 },
  facebook:  { size: '1792x1024', w: 1792, h: 1024 },
  linkedin:  { size: '1792x1024', w: 1792, h: 1024 },
  print:     { size: '1792x1024', w: 1792, h: 1024 },
  x:         { size: '1792x1024', w: 1792, h: 1024 },
  email:     { size: '1024x1024', w: 1024, h: 1024 },
};

// Single image — DALL-E + logo + optional text overlay
imagesRouter.post('/generate', async (req: AuthenticatedRequest, res: Response) => {
  const { platform, prompt, aiLabel, overlayText } = req.body as {
    platform?: string;
    prompt?: string;
    aiLabel?: boolean;
    overlayText?: string;
  };

  if (!platform || !prompt) {
    return res.status(400).json({ error: 'platform and prompt required' });
  }

  const spec = PLATFORM_SPECS[platform] ?? { size: '1024x1024' as const, w: 1024, h: 1024 };

  try {
    const response = await getOpenAI().images.generate({
      model: 'dall-e-3',
      prompt,
      size: spec.size,
      quality: 'standard',
      response_format: 'b64_json',
      n: 1,
    });

    const raw = response.data?.[0]?.b64_json;
    if (!raw) return res.status(500).json({ error: 'No image data returned' });

    const imageData = await compositeImage(raw, spec.w, spec.h, {
      aiLabel: aiLabel === true,
      overlayText: overlayText || undefined,
      platform,
    });

    return res.json({ imageData, size: spec.size });
  } catch (err) {
    console.error('[images] generation error:', err);
    return res.status(500).json({ error: 'Image generation failed', detail: String(err) });
  }
});

// Stories slide pack — one DALL-E background, N text variations → ZIP
imagesRouter.post('/slides', async (req: AuthenticatedRequest, res: Response) => {
  const { platform, prompt, aiLabel, overlayTexts } = req.body as {
    platform?: string;
    prompt?: string;
    aiLabel?: boolean;
    overlayTexts?: string[];
  };

  if (!platform || !prompt || !Array.isArray(overlayTexts) || overlayTexts.length === 0) {
    return res.status(400).json({ error: 'platform, prompt, and overlayTexts[] required' });
  }

  const spec = PLATFORM_SPECS[platform] ?? { size: '1024x1792' as const, w: 1024, h: 1792 };

  try {
    // Generate one background
    const response = await getOpenAI().images.generate({
      model: 'dall-e-3',
      prompt,
      size: spec.size,
      quality: 'standard',
      response_format: 'b64_json',
      n: 1,
    });

    const raw = response.data?.[0]?.b64_json;
    if (!raw) return res.status(500).json({ error: 'No image data returned' });

    // Composite each text variation
    const slides = await buildSlides(raw, spec.w, spec.h, overlayTexts, {
      aiLabel: aiLabel === true,
      platform,
    });

    // Package into ZIP
    const zip = new JSZip();
    slides.forEach((b64, i) => {
      zip.file(`slide-${i + 1}.png`, Buffer.from(b64, 'base64'));
    });
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return res.json({ zipData: zipBuf.toString('base64'), slideCount: slides.length });
  } catch (err) {
    console.error('[images] slides error:', err);
    return res.status(500).json({ error: 'Slide generation failed', detail: String(err) });
  }
});
