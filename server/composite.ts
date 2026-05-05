import sharp from 'sharp';
import path from 'path';

const BRAND_DIR = path.join(__dirname, '../brand');
const LOGO_WHITE = path.join(BRAND_DIR, 'logo-white.png');

const LOGO_WIDTH_RATIO = 0.22;
const PADDING_RATIO = 0.03;

export interface CompositeOptions {
  aiLabel?: boolean;
  overlayText?: string;
  platform?: string;
}

export async function compositeImage(
  imageB64: string,
  width: number,
  height: number,
  options: CompositeOptions = {},
): Promise<string> {
  const imgBuf = Buffer.from(imageB64, 'base64');
  const pad = Math.round(width * PADDING_RATIO);

  const layers: sharp.OverlayOptions[] = [];

  // Text overlay (Option B) — composited first so logo sits on top
  if (options.overlayText) {
    const textSvg = buildTextSvg(options.overlayText, width, height, options.platform ?? 'instagram');
    layers.push({ input: Buffer.from(textSvg), top: 0, left: 0 });
  }

  // AI label — top-left corner
  if (options.aiLabel) {
    layers.push({ input: Buffer.from(buildLabelSvg(width)), top: pad, left: pad });
  }

  // BHHS logo — bottom-right corner
  const logoW = Math.round(width * LOGO_WIDTH_RATIO);
  const logoResized = await sharp(LOGO_WHITE).resize({ width: logoW, fit: 'inside' }).toBuffer();
  const logoMeta = await sharp(logoResized).metadata();
  const logoH = logoMeta.height ?? 40;
  layers.push({
    input: logoResized,
    top: height - logoH - pad,
    left: width - logoW - pad,
  });

  const out = await sharp(imgBuf).composite(layers).png().toBuffer();
  return out.toString('base64');
}

// Build N slides from the same background with different text, return array of base64 PNGs
export async function buildSlides(
  imageB64: string,
  width: number,
  height: number,
  texts: string[],
  options: CompositeOptions = {},
): Promise<string[]> {
  return Promise.all(
    texts.map((text) =>
      compositeImage(imageB64, width, height, { ...options, overlayText: text }),
    ),
  );
}

// ─── SVG helpers ────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function buildTextSvg(text: string, width: number, height: number, platform: string): string {
  const isStories = platform === 'stories';
  const fontSize = isStories ? 34 : 28;
  const lineHeight = Math.round(fontSize * 1.4);
  const hPad = Math.round(width * 0.05);
  const vPad = Math.round(fontSize * 0.7);

  // Approximate chars per line using average char width ~0.52× font size
  const charsPerLine = Math.floor((width - hPad * 2) / (fontSize * 0.52));
  const lines = wrapWords(text, charsPerLine);

  const blockH = lines.length * lineHeight + vPad * 2;
  // Place in lower third; for stories push up a bit more so logo doesn't overlap
  const logoReserve = isStories ? Math.round(height * 0.12) : Math.round(height * 0.11);
  const boxY = height - blockH - logoReserve;

  const textEls = lines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${boxY + vPad + fontSize + i * lineHeight}" ` +
        `font-family="sans-serif" font-size="${fontSize}" fill="white" ` +
        `text-anchor="middle" font-weight="600" letter-spacing="-0.5">${escapeXml(line)}</text>`,
    )
    .join('\n');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect x="0" y="${boxY}" width="${width}" height="${blockH}" fill="rgba(0,0,0,0.58)"/>` +
    textEls +
    `</svg>`
  );
}

function buildLabelSvg(imageWidth: number): string {
  const fontSize = Math.max(12, Math.round(imageWidth * 0.012));
  const w = Math.round(imageWidth * 0.165);
  const h = Math.round(fontSize * 2.2);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect x="0" y="0" width="${w}" height="${h}" rx="4" fill="rgba(0,0,0,0.55)"/>` +
    `<text x="${w / 2}" y="${h / 2 + fontSize * 0.38}" font-family="sans-serif" ` +
    `font-size="${fontSize}" fill="white" text-anchor="middle" font-weight="500">AI-Generated Image</text>` +
    `</svg>`
  );
}
