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
  limits: { fileSize: 20 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are accepted'));
    } else {
      cb(null, true);
    }
  },
});

// Upload 1–3 PDFs — returns immediately with campaign ID, processes in background.
// Client polls GET /admin/campaigns to detect when title changes from 'Processing...'
adminRouter.post('/campaigns', upload.array('pdfs', 3), async (req: AuthenticatedRequest, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) return res.status(400).json({ error: 'At least one PDF file required' });

  const filenames = files.map((f) => f.originalname).join(' + ');
  const primaryPdf = files[0];

  const [campaign] = await db
    .insert(campaigns)
    .values({
      title: 'Processing...',
      sourceMonth: 'Processing...',
      pdfFilename: filenames,
      pdfData: primaryPdf.buffer.toString('base64'),
      status: 'draft',
    })
    .returning();

  // Respond immediately so the connection doesn't time out
  res.status(202).json(campaign);

  // Process in background after response is sent
  const buffers = files.map((f) => f.buffer);
  setImmediate(async () => {
    console.log(`[pipeline] starting for campaign ${campaign.id} — ${filenames}`);
    try {
      const { meta, rows } = await processPdf(campaign.id, buffers);
      console.log(`[pipeline] Claude finished — title: ${meta.title}`);

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
      console.log(`[pipeline] saved ${rows.length} content items`);
    } catch (err) {
      console.error('[pipeline] error:', err);
      await db.update(campaigns).set({ title: `Processing failed — ${filenames}` }).where(eq(campaigns.id, campaign.id));
    }
  });
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
