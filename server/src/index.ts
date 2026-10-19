import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables immediately
dotenv.config();

// Initialize Firebase Admin with Google Cloud Service Account (supports env JSON string, custom path, or local file)
try {
  let credentialSource: any;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // 1. Direct JSON string from environment variable (Render / Railway / Cloud Run / Docker)
    credentialSource = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
  } else {
    // 2. File path from env or local default
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
      ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : path.resolve(__dirname, '../serviceAccountKey.json');

    if (fs.existsSync(keyPath)) {
      credentialSource = cert(require(keyPath));
    }
  }

  if (credentialSource && getApps().length === 0) {
    initializeApp({ credential: credentialSource });
    console.log('Connected to Google Cloud Firestore via Service Account.');
  } else if (getApps().length === 0) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'strovr-local-dev' });
    console.log('Connected to Firestore using project context.');
  }
} catch (error) {
  console.warn('WARNING: Service account initialization failed. Falling back to default project context.', error);
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'strovr-local-dev' });
  }
}
export const db = getFirestore();

import authRoutes from './routes/auth';
import leadRoutes from './routes/leads';
import billingRoutes from './routes/billing';
import adminRoutes from './routes/admin';
import outreachRoutes from './routes/outreach';
import automationRoutes from './routes/automations';
import integrationRoutes from './routes/integrations';
import teamRoutes from './routes/team';
import bookingRoutes from './routes/booking';
import { automationWorker } from './services/automationWorker';

const app = express();

// Trust reverse proxy headers in production (Render, Railway, Cloud Run, Nginx, Cloudflare)
app.set('trust proxy', 1);

// Production-ready CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security Hardening: Strictly block any HTTP attempts to fetch .env, serviceAccount, .git, or key files
app.use((req, res, next) => {
  const lowerPath = req.path.toLowerCase();
  if (
    lowerPath.includes('.env') ||
    lowerPath.includes('serviceaccount') ||
    lowerPath.includes('.git') ||
    lowerPath.endsWith('.pem') ||
    lowerPath.endsWith('.key')
  ) {
    return res.status(404).json({ error: 'Not Found' });
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/v1', adminRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/booking', bookingRoutes);

// Health Check Endpoint for Load Balancers & Uptime Monitors
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    database: 'Firebase Firestore',
    timestamp: new Date().toISOString(),
  });
});

// Unified Full-Stack Static Serving: Serve compiled client/dist if present in production
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
  app.use(express.static(clientDistPath, { dotfiles: 'deny' }));
  app.get(/^(?!\/api|\/health).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Strovr Server listening on 0.0.0.0:${PORT} (${process.env.NODE_ENV || 'development'})`);
  // Start the background automation & drip worker
  automationWorker.start();
});
