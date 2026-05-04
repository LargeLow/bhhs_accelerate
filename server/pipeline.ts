import Anthropic from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';
import { SYSTEM_PROMPT, buildUserMessage, parseGeneratedContent } from './claude-prompt';
import type { GeneratedContent, ContentRow, Platform, ContentType } from '../shared/content-types';

const client = new Anthropic();

export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const data = await pdfParse(pdfBuffer);
  if (!data.text?.trim()) throw new Error('PDF appears to be empty or image-only (no extractable text)');
  return data.text;
}

export async function generateContent(pdfText: string): Promise<GeneratedContent> {
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(pdfText) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
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

export async function processPdf(campaignId: string, pdfBuffer: Buffer) {
  const pdfText = await extractPdfText(pdfBuffer);
  const content = await generateContent(pdfText);
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
