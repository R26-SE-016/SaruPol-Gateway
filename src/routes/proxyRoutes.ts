import { Router } from 'express';
import {
  proxyYieldPredict,
  proxyYieldGeneric,
  proxyPathologyClassify,
  proxyPathologySync,
  proxyPathologyHistory,
  proxyPathologyFeedback,
  proxyAerialSpectral,
  proxyCanopyHotspots,
  proxyUpdateHotspotStatus,
  proxySoilAnalyze,
  proxyAdvisoryAsk,
  proxyAdvisoryAskMulti,
  proxyAdvisoryTranslateBatch,
  proxyAdvisoryTts,
  proxyAdvisoryTranscribe,
  proxyAdvisoryHealth,
} from '../controllers/proxyController';

const router = Router();

// ── Yield Microservice Proxies ───────────────────────────────────────
router.use('/yield', proxyYieldGeneric);
router.post('/predict', proxyYieldPredict);
router.post('/predict/45day', proxyYieldPredict);

// ── Pathology Detection Proxies ──────────────────────────────────────
// System B (Microscopic / Leaf):
// POST /api/pathology/classify  — Run System B inference (base64 image → disease_class)
router.post('/pathology/classify', proxyPathologyClassify);
// POST /api/pathology/sync      — Batch-sync diagnostic results to Firestore
router.post('/pathology/sync', proxyPathologySync);
// GET  /api/pathology/history   — Fetch user diagnostic history from Firestore
router.get('/pathology/history', proxyPathologyHistory);
// POST /api/pathology/feedback  — Submit feedback on a prediction
router.post('/pathology/feedback', proxyPathologyFeedback);

// System A (Macroscopic / Aerial Spectral):
// POST /api/pathology/aerial/spectral — Compute NDVI/VARI and extract canopy hotspots
router.post('/pathology/aerial/spectral', proxyAerialSpectral);
// GET  /api/pathology/aerial/hotspots — Fetch flagged canopy stress hotspots for an estate
router.get('/pathology/aerial/hotspots', proxyCanopyHotspots);
// PATCH /api/pathology/aerial/hotspots/:id — Update hotspot inspection/leaf status
router.patch('/pathology/aerial/hotspots/:id', proxyUpdateHotspotStatus);
router.post('/pathology/aerial/hotspots/:id/status', proxyUpdateHotspotStatus);

// ── Soil Intelligence Proxies ────────────────────────────────────────
router.post('/soil/analyze', proxySoilAnalyze);

// ── Advisory Chatbot Proxies ─────────────────────────────────────────
// POST /api/advisory/ask              — Single-LLM RAG query with conversation memory
router.post('/advisory/ask', proxyAdvisoryAsk);
// POST /api/advisory/ask-multi        — Multi-LLM consensus + judge query
router.post('/advisory/ask-multi', proxyAdvisoryAskMulti);
// POST /api/advisory/translate-batch  — Batch translate chat messages
router.post('/advisory/translate-batch', proxyAdvisoryTranslateBatch);
// GET  /api/advisory/tts              — Text-to-Speech audio stream (audio/mpeg)
router.get('/advisory/tts', proxyAdvisoryTts);
// POST /api/advisory/transcribe       — Speech-to-Text (multipart/form-data audio)
router.post('/advisory/transcribe', proxyAdvisoryTranscribe);
// GET  /api/advisory/health           — Advisory service health check
router.get('/advisory/health', proxyAdvisoryHealth);

export default router;

