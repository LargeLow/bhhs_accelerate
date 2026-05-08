export type Platform = 'instagram' | 'facebook' | 'linkedin' | 'stories' | 'email' | 'print' | 'x';

export type ContentType =
  | 'caption'
  | 'post'
  | 'subject_line'
  | 'body'
  | 'hook'
  | 'headline'
  | 'subhead'
  | 'hashtags'
  | 'imagery_direction'
  | 'canva_prompt';

export interface Variation {
  text: string;
  variation: number;
}

export interface GeneratedContent {
  campaignTitle: string;
  sourceMonth: string;
  strategyCore: string;
  platforms: {
    instagram: {
      captions: Variation[];
      hashtags: string;
      imageryDirection: string;
      canvaPrompt: string;
    };
    facebook: {
      posts: Variation[];
      imageryDirection: string;
      canvaPrompt: string;
    };
    linkedin: {
      post: string;
      imageryDirection: string;
      canvaPrompt: string;
    };
    stories: {
      hooks: Variation[];
      imageryDirection: string;
      canvaPrompt: string;
    };
    email: {
      subjectLines: Variation[];
      bodies: Variation[];
    };
    print: {
      headline: string;
      subhead: string;
      body: string;
      imageryDirection: string;
      canvaPrompt: string;
    };
    x: {
      posts: Variation[];
    };
  };
}

export interface ContentRow {
  campaignId: string;
  platform: Platform;
  contentType: ContentType;
  variationNumber: number;
  copyText: string;
  agentId?: string;
}

export interface CampaignSummary {
  id: string;
  title: string;
  sourceMonth: string;
  strategyCore: string | null;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  createdAt: string;
}

export interface ContentItemRecord {
  id: string;
  campaignId: string;
  platform: Platform;
  contentType: ContentType;
  variationNumber: number;
  copyText: string;
}

export interface CampaignImageRecord {
  id: string;
  platform: Platform;
  filename: string;
  imageData?: string; // base64 PNG — only present when fetched directly
}

export interface CampaignDetail extends CampaignSummary {
  contentItems: ContentItemRecord[];
  campaignImages: CampaignImageRecord[];
}

export interface CanvaTemplate {
  platform: Platform;
  name: string;
  url: string;
}

export const COPY_SLOTS = {
  name:  '[Agent Name]',
  phone: '[Agent Phone]',
  url:   '[Agent URL]',
  city:  '[City/Area]',
} as const;

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  stories: 'Stories / Reels',
  email: 'Email',
  print: 'Print / Digital',
  x: 'X / Twitter',
};

export const PLATFORMS: Platform[] = [
  'instagram', 'facebook', 'linkedin', 'stories', 'email', 'print', 'x',
];
