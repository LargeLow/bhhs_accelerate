import { Router, Response } from 'express';
import multer from 'multer';
import { db } from '../db';
import { campaigns, contentItems } from '../schema';
import { eq, desc } from 'drizzle-orm';
import { processPdf } from '../pipeline';
import { requireAdmin, type AuthenticatedRequest } from '../auth';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are accepted'));
    } else {
      cb(null, true);
    }
  },
});

// Upload a PDF and process it with Claude
adminRouter.post('/campaigns', upload.single('pdf'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'PDF file required' });

  const pdfBase64 = req.file.buffer.toString('base64');

  // Create campaign row in draft state
  const [campaign] = await db
    .insert(campaigns)
    .values({
      title: 'Processing...',
      sourceMonth: 'Processing...',
      pdfFilename: req.file.originalname,
      pdfData: pdfBase64,
      status: 'draft',
    })
    .returning();

  // Run pipeline — this takes 15–30 seconds (Claude call)
  try {
    const { meta, rows } = await processPdf(campaign.id, req.file.buffer);

    await db
      .update(campaigns)
      .set({ title: meta.title, sourceMonth: meta.sourceMonth, strategyCore: meta.strategyCore, processedAt: new Date() })
      .where(eq(campaigns.id, campaign.id));

    await db.insert(contentItems).values(
      rows.map((r) => ({
        campaignId: r.campaignId,
        platform: r.platform,
        contentType: r.contentType,
        variationNumber: r.variationNumber,
        copyText: r.copyText,
      }))
    );

    const [updated] = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id)).limit(1);
    return res.status(201).json(updated);
  } catch (err) {
    // Mark the campaign so admin knows processing failed
    await db.update(campaigns).set({ title: `Processing failed — ${req.file.originalname}` }).where(eq(campaigns.id, campaign.id));
    console.error('Pipeline error:', err);
    return res.status(500).json({ error: 'PDF processing failed', detail: String(err) });
  }
});

// List all campaigns including drafts
adminRouter.get('/campaigns', async (_req: AuthenticatedRequest, res: Response) => {
  const rows = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      sourceMonth: campaigns.sourceMonth,
      strategyCore: campaigns.strategyCore,
      status: campaigns.status,
      pdfFilename: campaigns.pdfFilename,
      processedAt: campaigns.processedAt,
      publishedAt: campaigns.publishedAt,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .orderBy(desc(campaigns.createdAt));

  return res.json(rows);
});

// Publish or archive a campaign
adminRouter.patch('/campaigns/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status?: 'published' | 'archived' };

  if (!status || !['published', 'archived'].includes(status)) {
    return res.status(400).json({ error: 'status must be "published" or "archived"' });
  }

  const updates: Record<string, unknown> = { status };
  if (status === 'published') updates.publishedAt = new Date();

  const [updated] = await db.update(campaigns).set(updates).where(eq(campaigns.id, id)).returning();
  if (!updated) return res.status(404).json({ error: 'Campaign not found' });

  return res.json(updated);
});
