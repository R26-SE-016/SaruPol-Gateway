import { Router } from 'express';
import {
  proxyYieldPredict,
  proxyPathologyClassify,
  proxyPathologySync,
  proxyPathologyHistory,
  proxyPathologyFeedback,
  proxySoilAnalyze,
  proxyAdvisoryChat
} from '../controllers/proxyController';

const router = Router();

// ── Yield Prediction Proxies ─────────────────────────────────────────
router.post('/predict', proxyYieldPredict);
router.post('/predict/45day', proxyYieldPredict);

// ── Pathology Detection Proxies ──────────────────────────────────────
// POST /api/pathology/classify  — Run System B inference (base64 image → disease_class)
router.post('/pathology/classify', proxyPathologyClassify);
// POST /api/pathology/sync      — Batch-sync diagnostic results to Firestore
router.post('/pathology/sync', proxyPathologySync);
// GET  /api/pathology/history   — Fetch user diagnostic history from Firestore
router.get('/pathology/history', proxyPathologyHistory);
// POST /api/pathology/feedback  — Submit feedback on a prediction
router.post('/pathology/feedback', proxyPathologyFeedback);

// ── Soil Intelligence Proxies ────────────────────────────────────────
router.post('/soil/analyze', proxySoilAnalyze);

// ── Advisory Chatbot Proxy ───────────────────────────────────────────
router.post('/advisory/chat', proxyAdvisoryChat);

export default router;
