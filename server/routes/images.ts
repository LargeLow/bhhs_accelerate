import { Router, Response } from 'express';
import OpenAI from 'openai';
import { requireAuth, type AuthenticatedRequest } from '../auth';

export const imagesRouter = Router();
imagesRouter.use(requireAuth);

// Lazy — only instantiated on first request so a missing key doesn't crash the server
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY environment variable is not set');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const PLATFORM_SIZES: Record<string, '1024x1024' | '1024x1792' | '1792x1024'> = {
  instagram: '1024x1024',
  stories:   '1024x1792',  // 9:16 vertical for Stories/Reels
  facebook:  '1792x1024',  // 16:9 landscape
  linkedin:  '1792x1024',
  print:     '1792x1024',
  x:         '1792x1024',
  email:     '1024x1024',
};

imagesRouter.post('/generate', async (req: AuthenticatedRequest, res: Response) => {
  const { platform, prompt } = req.body as { platform?: string; prompt?: string };

  if (!platform || !prompt) {
    return res.status(400).json({ error: 'platform and prompt required' });
  }

  const size = PLATFORM_SIZES[platform] ?? '1024x1024';

  try {
    const response = await getOpenAI().images.generate({
      model: 'dall-e-3',
      prompt,
      size,
      quality: 'standard',
      response_format: 'b64_json',
      n: 1,
    });

    const imageData = response.data[0]?.b64_json;
    if (!imageData) return res.status(500).json({ error: 'No image data returned' });

    return res.json({ imageData, size });
  } catch (err) {
    console.error('[images] generation error:', err);
    return res.status(500).json({ error: 'Image generation failed', detail: String(err) });
  }
});
