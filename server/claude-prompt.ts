import type { GeneratedContent } from '../shared/content-types';

const BRAND_VOICE = `
You are a marketing content strategist for Berkshire Hathaway HomeServices Utah Properties,
a top-10 national BHHS franchise serving buyers and sellers across Utah.

BRAND VOICE
- Authoritative but warm. Confident without being boastful.
- Grounded in data and local Utah expertise. Never vague.
- Never use exclamation marks. Periods only. Measured confidence.
- Never use the word "excited" or "thrilled."
- Utah-specific language encouraged: mention Utah, specific cities when natural.

SUBSTITUTION SLOTS (use these exact placeholders when agent info is needed)
  [Agent Name]  [Agent Phone]  [Agent URL]  [City/Area]

OUTPUT RULES
- Return raw JSON only. No markdown, no code fences, no preamble.
- Use \\n for paragraph breaks inside JSON string values — never literal newlines.
- Do not use smart quotes or em-dashes that are not ASCII-safe.
`.trim();

// ─── Call A: visual/social platforms ────────────────────────────────────────

export const PROMPT_A = `${BRAND_VOICE}

Produce content for Instagram, Facebook, and Stories/Reels only.
STRICT word limits — do not exceed them.

instagram:
  - 3 caption variations. Tones: punchy / stat-led / conversational. Max 250 words each.
  - End each with "Berkshire Hathaway HomeServices Utah Properties"
  - 1 hashtag block: 10 hashtags (Utah-specific + topic-specific).
  - 1 imageryDirection: 2 sentences max on angle, mood, subjects.
  - 1 canvaPrompt: 2-3 sentences, visual scene only, photorealistic DALL-E style.

facebook:
  - 2 post variations. Educational (300 words max). Ad-friendly (125 words max).
  - End with "Berkshire Hathaway HomeServices Utah Properties → [Agent URL]"
  - 1 imageryDirection: 1-2 sentences.
  - 1 canvaPrompt: 2-3 sentences, photorealistic DALL-E scene, no text in image.

stories:
  - 5 hook lines — opening frame of a Story or Reel, displayed as text on a static image.
  - Each hook is a COMPLETE, self-contained thought — two sentences maximum.
  - Structure: first sentence states an observation or tension. Second sentence lands the insight or implication.
  - Do NOT end with "Here is..." or "This is why..." or any construction that promises
    follow-up content. The hook must resolve itself — no open loops.
  - Each variation takes a different angle: statistic, contrast, direct observation, reframe, challenge.
  - Do NOT use any substitution slots ([Agent Name], [City/Area], etc.). Generic Utah context only.
  - 1 imageryDirection: 1-2 sentences on visual style.
  - 1 canvaPrompt: 2-3 sentences, visual scene only, photorealistic DALL-E style.

JSON schema (return this exact shape):
{
  "campaignTitle": string,
  "sourceMonth": string,
  "strategyCore": string (2 sentences max),
  "platforms": {
    "instagram": {
      "captions": [{ "text": string, "variation": number }],
      "hashtags": string,
      "imageryDirection": string,
      "canvaPrompt": string
    },
    "facebook": {
      "posts": [{ "text": string, "variation": number }],
      "imageryDirection": string,
      "canvaPrompt": string
    },
    "stories": {
      "hooks": [{ "text": string, "variation": number }],
      "imageryDirection": string,
      "canvaPrompt": string
    }
  }
}`;

// ─── Call B: text-heavy platforms ────────────────────────────────────────────

export const PROMPT_B = `${BRAND_VOICE}

Produce content for LinkedIn, Email, Print, and X/Twitter only.
STRICT word limits — do not exceed them.

linkedin:
  - 1 post, 250-275 words. Opens with an observation, not a question.
  - Ends with [Agent Name], brokerage name, [Agent Phone]. No tagline.
  - 1 imageryDirection: 1-2 sentences.
  - 1 canvaPrompt: 2-3 sentences, photorealistic DALL-E scene, professional tone, no text in image.

email:
  - 3 subject line variations.
  - 2 body variations: long (275 words max) and short (125 words max).
  - Bodies end with [Agent Name], brokerage name, [Agent Phone].

print:
  - 1 headline (8 words max).
  - 1 subhead (15 words max).
  - 1 body (75 words max).
  - 1 imageryDirection: 1-2 sentences on layout and BHHS Cabernet #670038.
  - 1 canvaPrompt: 2-3 sentences, photorealistic DALL-E scene suitable for a print ad background, no text in image.

x:
  - 2 post variations. Under 280 characters each. No hashtags.

JSON schema (return this exact shape):
{
  "platforms": {
    "linkedin": {
      "post": string,
      "imageryDirection": string,
      "canvaPrompt": string
    },
    "email": {
      "subjectLines": [{ "text": string, "variation": number }],
      "bodies": [{ "text": string, "variation": number }]
    },
    "print": {
      "headline": string,
      "subhead": string,
      "body": string,
      "imageryDirection": string,
      "canvaPrompt": string
    },
    "x": {
      "posts": [{ "text": string, "variation": number }]
    }
  }
}`;

// ─── Parsers ─────────────────────────────────────────────────────────────────

type PartialA = Pick<GeneratedContent, 'campaignTitle' | 'sourceMonth' | 'strategyCore'> & {
  platforms: Pick<GeneratedContent['platforms'], 'instagram' | 'facebook' | 'stories'>;
};

type PartialB = {
  platforms: Pick<GeneratedContent['platforms'], 'linkedin' | 'email' | 'print' | 'x'>;
};

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
  }
  return text.slice(start); // truncated — return what we have
}

function parseJson<T>(raw: string, label: string): T {
  // Strip code fences, then extract the first balanced JSON object
  const stripped = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  const cleaned = extractFirstJsonObject(stripped);

  try {
    return JSON.parse(cleaned) as T;
  } catch (firstErr) {
    // Repair literal newlines inside JSON strings (Claude sometimes emits them)
    const repaired = cleaned.replace(/("(?:[^"\\]|\\.)*")/gs, (m) =>
      m.replace(/\n/g, '\\n').replace(/\r/g, ''),
    );
    try {
      return JSON.parse(repaired) as T;
    } catch {
      const preview = cleaned.slice(0, 600);
      const tail = cleaned.slice(-200);
      throw new Error(`Claude ${label} invalid JSON (${firstErr})\nFirst 600: ${preview}\nLast 200: ${tail}`);
    }
  }
}

export function parsePartialA(raw: string): PartialA {
  const data = parseJson<PartialA>(raw, 'call-A');
  if (!data.campaignTitle) throw new Error('Call-A missing campaignTitle');
  if (!data.platforms?.instagram) throw new Error('Call-A missing instagram');
  if (!data.platforms?.facebook) throw new Error('Call-A missing facebook');
  if (!data.platforms?.stories) throw new Error('Call-A missing stories');
  return data;
}

export function parsePartialB(raw: string): PartialB {
  const data = parseJson<PartialB>(raw, 'call-B');
  if (!data.platforms?.linkedin) throw new Error('Call-B missing linkedin');
  if (!data.platforms?.email) throw new Error('Call-B missing email');
  if (!data.platforms?.print) throw new Error('Call-B missing print');
  if (!data.platforms?.x) throw new Error('Call-B missing x');
  return data;
}

export function mergeContent(a: PartialA, b: PartialB): GeneratedContent {
  return {
    campaignTitle: a.campaignTitle,
    sourceMonth: a.sourceMonth,
    strategyCore: a.strategyCore,
    platforms: {
      instagram: a.platforms.instagram,
      facebook: a.platforms.facebook,
      stories: a.platforms.stories,
      linkedin: b.platforms.linkedin,
      email: b.platforms.email,
      print: b.platforms.print,
      x: b.platforms.x,
    },
  };
}
