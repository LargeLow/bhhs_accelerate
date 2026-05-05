import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, parseGeneratedContent } from './claude-prompt';
import type { GeneratedContent, ContentRow, Platform, ContentType } from '../shared/content-types';

const client = new Anthropic();

// Accept 1–3 PDF buffers and send them all to Claude in a single call.
// Multiple documents give Claude full context — research PDF + topic drop together.
export async function generateContent(pdfBuffers: Buffer[]): Promise<GeneratedContent> {
  const documentBlocks = pdfBuffers.map((buf) => ({
    type: 'document' as const,
    source: {
      type: 'base64' as const,
      media_type: 'application/pdf' as const,
      data: buf.toString('base64'),
    },
  }));

  console.log(`[claude] sending ${pdfBuffers.length} PDF(s) — total size: ${pdfBuffers.reduce((n, b) => n + b.length, 0)} bytes`);

  const response = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...documentBlocks,
            {
              type: 'text',
              text: pdfBuffers.length > 1
                ? 'These PDFs form one complete strategy package — the first is the research/survey context, the subsequent file(s) are the topic drop with actionable highlights. Read them together as a single strategy, then produce the full content package as specified in your instructions. Return the JSON object now.'
                : 'Read this 1000WATT research/strategy PDF carefully, identify the core research insight and the actionable marketing strategy, then produce the full content package as specified in your instructions. Return the JSON object now.',
            },
          ],
        },
      ],
    },
    { timeout: 180_000 } // 3-minute hard timeout
  );

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  console.log(`[claude] response received — stop_reason: ${response.stop_reason}, output_tokens: ${response.usage.output_tokens}`);
  if (response.stop_reason === 'max_tokens') {
    throw new Error(`Claude hit max_tokens (${response.usage.output_tokens}) — JSON was truncated`);
  }

  return parseGeneratedContent(textBlock.text);
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
