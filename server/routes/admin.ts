import { Router, Response } from 'express';
import multer from 'multer';
import { db } from '../db';
import { campaigns, contentItems, campaignImages, users } from '../schema';
import bcrypt from 'bcrypt';
import { compositeImage } from '../composite';
import type { Platform } from '../../shared/content-types';
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

// Image upload multer — accepts jpeg/png up to 10MB
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, or WebP images are accepted'));
    } else {
      cb(null, true);
    }
  },
});

const PLATFORM_SIZES: Record<string, { w: number; h: number }> = {
  instagram: { w: 1024, h: 1024 },
  stories:   { w: 1024, h: 1792 },
  facebook:  { w: 1792, h: 1024 },
  linkedin:  { w: 1792, h: 1024 },
  print:     { w: 1792, h: 1024 },
  x:         { w: 1792, h: 1024 },
  email:     { w: 1024, h: 1024 },
};

// Upload a marketing-team image for a specific campaign + platform
adminRouter.post(
  '/campaigns/:id/images',
  imageUpload.single('image'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { platform } = req.body as { platform?: string };

    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    if (!platform || !PLATFORM_SIZES[platform]) {
      return res.status(400).json({ error: 'Valid platform required' });
    }

    try {
      // Convert to base64, resize to platform dimensions, composite logo
      const sharp = (await import('sharp')).default;
      const { w, h } = PLATFORM_SIZES[platform];
      const resized = await sharp(req.file.buffer).resize(w, h, { fit: 'cover' }).png().toBuffer();
      const composited = await compositeImage(resized.toString('base64'), w, h, { platform });

      // Replace any existing image for this campaign+platform
      await db
        .delete(campaignImages)
        .where(eq(campaignImages.campaignId, id));

      const [row] = await db
        .insert(campaignImages)
        .values({
          campaignId: id,
          platform: platform as Platform,
          imageData: composited,
          filename: req.file.originalname,
        })
        .returning();

      return res.json({ id: row.id, platform: row.platform, filename: row.filename });
    } catch (err) {
      console.error('[admin] image upload error:', err);
      return res.status(500).json({ error: 'Image processing failed', detail: String(err) });
    }
  },
);

// Delete a campaign image
adminRouter.delete('/campaigns/:id/images/:imageId', async (req: AuthenticatedRequest, res: Response) => {
  const { imageId } = req.params;
  await db.delete(campaignImages).where(eq(campaignImages.id, imageId));
  return res.json({ ok: true });
});

// ─── User management ─────────────────────────────────────────────────────────

adminRouter.get('/users', async (_req: AuthenticatedRequest, res: Response) => {
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(users.createdAt);
  return res.json(rows);
});

adminRouter.post('/users', async (req: AuthenticatedRequest, res: Response) => {
  const { email, name, password, role } = req.body as {
    email?: string; name?: string; password?: string; role?: string;
  };
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' });
  }
  const validRole = role === 'admin' ? 'admin' : 'agent';
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [user] = await db
      .insert(users)
      .values({ email: email.toLowerCase().trim(), name, passwordHash, role: validRole })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt });
    return res.status(201).json(user);
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

adminRouter.patch('/users/:id/password', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { password } = req.body as { password?: string };
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [updated] = await db.update(users).set({ passwordHash }).where(eq(users.id, id)).returning({ id: users.id });
  if (!updated) return res.status(404).json({ error: 'User not found' });
  return res.json({ ok: true });
});

adminRouter.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  // Prevent self-deletion
  if (id === req.user?.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  await db.delete(users).where(eq(users.id, id));
  return res.json({ ok: true });
});
