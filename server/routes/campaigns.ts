import { Router, Response } from 'express';
import { db } from '../db';
import { campaigns, contentItems, canvaTemplates } from '../schema';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, type AuthenticatedRequest } from '../auth';

export const campaignsRouter = Router();

// List all published campaigns — used for the library page
campaignsRouter.get('/', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  const rows = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      sourceMonth: campaigns.sourceMonth,
      strategyCore: campaigns.strategyCore,
      status: campaigns.status,
      publishedAt: campaigns.publishedAt,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .where(eq(campaigns.status, 'published'))
    .orderBy(desc(campaigns.publishedAt));

  return res.json(rows);
});

// Full campaign detail with all content items and Canva template links
campaignsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const [campaign] = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      sourceMonth: campaigns.sourceMonth,
      strategyCore: campaigns.strategyCore,
      status: campaigns.status,
      publishedAt: campaigns.publishedAt,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'published') return res.status(404).json({ error: 'Campaign not found' });

  const items = await db
    .select({
      id: contentItems.id,
      campaignId: contentItems.campaignId,
      platform: contentItems.platform,
      contentType: contentItems.contentType,
      variationNumber: contentItems.variationNumber,
      copyText: contentItems.copyText,
    })
    .from(contentItems)
    .where(eq(contentItems.campaignId, id))
    .orderBy(contentItems.platform, contentItems.variationNumber);

  const templates = await db.select().from(canvaTemplates);

  return res.json({ ...campaign, contentItems: items, canvaTemplates: templates });
});
