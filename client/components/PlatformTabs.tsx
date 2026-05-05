import { useState } from 'react';
import { PLATFORMS, PLATFORM_LABELS, type Platform, type ContentItemRecord } from '../../shared/content-types';
import CopyBlock from './CopyBlock';
import ImageGenerator from './ImageGenerator';

interface Props {
  contentItems: ContentItemRecord[];
  canvaMap: Record<string, { name: string; url: string }>;
}

const COPY_TYPES: Record<string, string> = {
  caption: 'Caption',
  post: 'Post',
  subject_line: 'Subject Line',
  body: 'Body',
  hook: 'Hook',
  headline: 'Headline',
  subhead: 'Subhead',
  hashtags: 'Hashtags',
  imagery_direction: 'Imagery Direction',
  canva_prompt: 'AI Image Prompt',
};

// Only short-form types suitable for image overlays (never full captions/posts)
const OVERLAY_PRIORITY = ['hook', 'headline'];

export default function PlatformTabs({ contentItems, canvaMap }: Props) {
  const [active, setActive] = useState<Platform>('instagram');

  const itemsForPlatform = contentItems.filter((i) => i.platform === active);
  const canvaTemplate = canvaMap[active];

  const supportingTypes = ['imagery_direction', 'canva_prompt'];
  const copyItems = itemsForPlatform.filter((i) => !supportingTypes.includes(i.contentType));
  const supportItems = itemsForPlatform.filter((i) => supportingTypes.includes(i.contentType));

  // Best single text for overlay (first variation only)
  const overlayItem = OVERLAY_PRIORITY
    .map((t) => itemsForPlatform.find((i) => i.contentType === t))
    .find(Boolean);
  const overlayText = overlayItem?.copyText;

  // For Stories: all hook variations for the slide pack ZIP
  const hookTexts = active === 'stories'
    ? itemsForPlatform.filter((i) => i.contentType === 'hook').map((i) => i.copyText)
    : undefined;

  return (
    <div>
      {/* Platform tab bar */}
      <div className="flex gap-1 flex-wrap mb-8 border-b border-gray-200 pb-0">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
              active === p
                ? 'border-bhhs-maroon text-bhhs-maroon bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main copy — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          {canvaTemplate && (
            <a
              href={canvaTemplate.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-bhhs-maroon border border-bhhs-maroon rounded px-3 py-1.5 hover:bg-bhhs-cream transition-colors mb-2"
            >
              <span>Open Canva Template</span>
              <span className="text-xs">↗</span>
            </a>
          )}

          {copyItems.length === 0 && (
            <p className="text-gray-400 text-sm">No content yet for this platform.</p>
          )}

          {copyItems.map((item) => (
            <CopyBlock
              key={item.id}
              label={
                item.variationNumber > 1 || copyItems.filter((i) => i.contentType === item.contentType).length > 1
                  ? `${COPY_TYPES[item.contentType] ?? item.contentType} — Variation ${item.variationNumber}`
                  : COPY_TYPES[item.contentType] ?? item.contentType
              }
              text={item.copyText}
            />
          ))}
        </div>

        {/* Supporting info — 1/3 width */}
        {supportItems.length > 0 && (
          <div className="space-y-4">
            {supportItems.map((item) => (
              <div key={item.id} className="bg-bhhs-cream rounded-lg p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-bhhs-maroon mb-2">
                  {COPY_TYPES[item.contentType] ?? item.contentType}
                </p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.copyText}</p>
                {(item.contentType === 'canva_prompt' || item.contentType === 'imagery_direction') && (
                  <ImageGenerator
                    platform={active}
                    prompt={item.copyText}
                    overlayText={overlayText}
                    overlayTexts={hookTexts}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
