import Anthropic from '@anthropic-ai/sdk';
import { PROMPT_A, PROMPT_B, parsePartialA, parsePartialB, mergeContent } from './claude-prompt';
import type { GeneratedContent, ContentRow, Platform, ContentType } from '../shared/content-types';

const client = new Anthropic();

export async function generateContent(pdfBuffers: Buffer[]): Promise<GeneratedContent> {
  const documentBlocks = pdfBuffers.map((buf) => ({
    type: 'document' as const,
    source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: buf.toString('base64') },
  }));

  const totalBytes = pdfBuffers.reduce((n, b) => n + b.length, 0);
  console.log(`[claude] sending ${pdfBuffers.length} PDF(s) — ${totalBytes} bytes — running A+B in parallel`);

  const pdfNote = pdfBuffers.length > 1
    ? 'These PDFs form one strategy package — read them together, then produce the content specified above.'
    : 'Read this PDF carefully, then produce the content specified above.';

  async function call(systemPrompt: string, label: string) {
    const res = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [...documentBlocks, { type: 'text', text: `${pdfNote} Return the JSON object now.` }],
        }],
      },
      { timeout: 180_000 },
    );

    const block = res.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error(`No text in Claude ${label} response`);

    console.log(`[claude] ${label} done — stop_reason: ${res.stop_reason}, tokens: ${res.usage.output_tokens}`);
    if (res.stop_reason === 'max_tokens') {
      throw new Error(`Claude ${label} hit max_tokens (${res.usage.output_tokens}) — output truncated`);
    }
    return block.text;
  }

  // Both calls share the same PDF context — run in parallel
  const [rawA, rawB] = await Promise.all([
    call(PROMPT_A, 'call-A'),
    call(PROMPT_B, 'call-B'),
  ]);

  const partA = parsePartialA(rawA);
  const partB = parsePartialB(rawB);
  return mergeContent(partA, partB);
}

export function flattenToRows(campaignId: string, content: GeneratedContent): ContentRow[] {
  const rows: ContentRow[] = [];

  function push(platform: Platform, contentType: ContentType, text: string, variation = 1) {
    rows.push({ campaignId, platform, contentType, variationNumber: variation, copyText: text });
  }

  for (const c of content.platforms.instagram.captions) push('instagram', 'caption', c.text, c.variation);
  push('instagram', 'hashtags', content.platforms.instagram.hashtags);
  push('instagram', 'imagery_direction', content.platforms.instagram.imageryDirection);
  push('instagram', 'canva_prompt', content.platforms.instagram.canvaPrompt);

  for (const p of content.platforms.facebook.posts) push('facebook', 'post', p.text, p.variation);
  push('facebook', 'imagery_direction', content.platforms.facebook.imageryDirection);

  push('linkedin', 'post', content.platforms.linkedin.post);
  push('linkedin', 'imagery_direction', content.platforms.linkedin.imageryDirection);

  for (const h of content.platforms.stories.hooks) push('stories', 'hook', h.text, h.variation);
  push('stories', 'imagery_direction', content.platforms.stories.imageryDirection);
  push('stories', 'canva_prompt', content.platforms.stories.canvaPrompt);

  for (const s of content.platforms.email.subjectLines) push('email', 'subject_line', s.text, s.variation);
  for (const b of content.platforms.email.bodies) push('email', 'body', b.text, b.variation);

  push('print', 'headline', content.platforms.print.headline);
  push('print', 'subhead', content.platforms.print.subhead);
  push('print', 'body', content.platforms.print.body);
  push('print', 'imagery_direction', content.platforms.print.imageryDirection);

  for (const p of content.platforms.x.posts) push('x', 'post', p.text, p.variation);

  return rows;
}

export async function processPdf(campaignId: string, pdfBuffers: Buffer[]) {
  const content = await generateContent(pdfBuffers);
  const rows = flattenToRows(campaignId, content);
  return {
    meta: {
      title: content.campaignTitle,
      sourceMonth: content.sourceMonth,
      strategyCore: content.strategyCore,
    },
    rows,
  };
}
