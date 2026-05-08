import 'dotenv/config';
import sharp from 'sharp';
import express from 'express';

// Disable sharp's internal tile cache and limit concurrency to control memory
sharp.cache(false);
sharp.concurrency(1);
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { loadSession } from './auth';
import { authRouter } from './routes/auth';
import { campaignsRouter } from './routes/campaigns';
import { adminRouter } from './routes/admin';
import { imagesRouter } from './routes/images';

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: isProd ? false : 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(loadSession);

app.use('/api/auth', authRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/images', imagesRouter);

// Serve Vite build in production
if (isProd) {
  const distPath = path.join(__dirname, '../dist/public');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
