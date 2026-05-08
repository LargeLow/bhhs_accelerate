import { useState } from 'react';
import { PLATFORMS, PLATFORM_LABELS, type Platform, type ContentItemRecord, type CampaignImageRecord } from '../../shared/content-types';
import CopyBlock from './CopyBlock';
import ImageGenerator from './ImageGenerator';
import AdminImageUpload from './AdminImageUpload';

interface Props {
  contentItems: ContentItemRecord[];
  canvaMap: Record<string, { name: string; url: string }>;
  campaignId: string;
  isAdmin: boolean;
  initialImages: CampaignImageRecord[];
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

// Stories ZIP slides get text baked in; all feed platforms download clean
const STORIES_OVERLAY_PRIORITY = ['hook'];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs text-bhhs-maroon hover:text-bhhs-dark font-medium transition-colors shrink-0"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function PlatformTabs({ contentItems, canvaMap, campaignId, isAdmin, initialImages }: Props) {
  const [active, setActive] = useState<Platform>('instagram');
  const [adminImages, setAdminImages] = useState<CampaignImageRecord[]>(initialImages);

  const adminImage = adminImages.find((img) => img.platform === active);

  const itemsForPlatform = contentItems.filter((i) => i.platform === active);
  const canvaTemplate = canvaMap[active];

  const supportingTypes = ['imagery_direction', 'canva_prompt'];
  const copyItems = itemsForPlatform.filter((i) => !supportingTypes.includes(i.contentType));
  const supportItems = itemsForPlatform.filter((i) => supportingTypes.includes(i.contentType));

  // Stories ZIP: hook text baked into each slide
  // Feed platforms: image downloads clean (logo only, no text overlay)
  const hookTexts = active === 'stories'
    ? itemsForPlatform.filter((i) => i.contentType === 'hook').map((i) => i.copyText)
    : undefined;

  const storiesOverlayText = active === 'stories'
    ? (STORIES_OVERLAY_PRIORITY
        .map((t) => itemsForPlatform.find((i) => i.contentType === t))
        .find(Boolean)?.copyText)
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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-bhhs-maroon">
                    {COPY_TYPES[item.contentType] ?? item.contentType}
                  </p>
                  <CopyButton text={item.copyText} />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.copyText}</p>
                {item.contentType === 'canva_prompt' && (
                  <ImageGenerator
                    platform={active}
                    prompt={item.copyText}
                    campaignId={campaignId}
                    overlayText={storiesOverlayText}
                    overlayTexts={hookTexts}
                    adminImage={adminImage}
                  />
                )}
                {item.contentType === 'canva_prompt' && isAdmin && (
                  <AdminImageUpload
                    campaignId={campaignId}
                    platform={active}
                    existing={adminImage}
                    onUploaded={(img) => setAdminImages((prev) => [...prev.filter((i) => i.platform !== active), img])}
                    onDeleted={() => setAdminImages((prev) => prev.filter((i) => i.platform !== active))}
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
