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
  proxySoilPredictTriangulated,
  proxySoilGetTrees,
  proxySoilLocationAgroZone,
  proxySoilNutrientPredict,
  proxySoilAnalysisStart,
  proxySoilAnalysisReading,
  proxySoilAnalysisComplete,
  proxySoilModelStatus,
  proxySoilModelTrain,
  proxySoilGeneric,
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
// POST /api/soil/predict/triangulated — 3-point composite spatial ML prediction & CRI dosage
router.post('/soil/predict/triangulated', proxySoilPredictTriangulated);
router.post('/predict/triangulated', proxySoilPredictTriangulated);

// GET /api/soil/trees — Empirical Makandura estate trees list
router.get('/soil/trees', proxySoilGetTrees);
router.get('/trees', proxySoilGetTrees);

// POST /api/soil/location/agro-zone — NSDI GIS coordinate agro-climatic zone resolver
router.post('/soil/location/agro-zone', proxySoilLocationAgroZone);
router.post('/location/agro-zone', proxySoilLocationAgroZone);

// POST /api/soil/nutrient-analysis/predict — Leaf deficiency visual assessment (multipart image)
router.post('/soil/nutrient-analysis/predict', proxySoilNutrientPredict);
router.post('/nutrient-analysis/predict', proxySoilNutrientPredict);

// IoT Sampling Session Endpoints
router.post('/soil/analysis/start', proxySoilAnalysisStart);
router.post('/soil/analysis/reading', proxySoilAnalysisReading);
router.post('/soil/analysis/complete', proxySoilAnalysisComplete);

// Model Management
router.get('/soil/models/status', proxySoilModelStatus);
router.post('/soil/models/train', proxySoilModelTrain);

// Legacy Soil & Generic /soil and /v1 proxies
router.post('/soil/analyze', proxySoilAnalyze);
router.use('/soil', proxySoilGeneric);
router.use('/v1', proxySoilGeneric);

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

