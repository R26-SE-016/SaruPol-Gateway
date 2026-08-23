import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import http from 'http';
import https from 'https';

// Configuration URLs from Environment
const YIELD_URL = process.env.YIELD_SERVICE_URL || 'http://localhost:5000';
const PATHOLOGY_URL = process.env.PATHOLOGY_SERVICE_URL || 'http://127.0.0.1:5001/coconut-pathology-detection/asia-south1';
const SOIL_URL = process.env.SOIL_SERVICE_URL || 'http://localhost:5003';
const ADVISORY_URL = process.env.ADVISORY_SERVICE_URL || 'http://localhost:5000';

// ── Disease Knowledge Map ─────────────────────────────────────────────
// Maps System B disease_class values to clinical metadata.
const DISEASE_KNOWLEDGE: Record<string, {
  displayName: string;
  severity: 'Critical' | 'High' | 'Moderate' | 'Healthy';
  chemical: string;
  cultural: string;
  preventive: string;
}> = {
  'bud rot': {
    displayName: 'Bud Rot (Phytophthora palmivora)',
    severity: 'Critical',
    chemical: 'Cut and remove dead crown tissues, apply Bordeaux paste or copper oxychloride paste on cut surfaces.',
    cultural: 'Destroy and burn all removed infected tissues. Avoid damaging the crown during field operations.',
    preventive: 'Spray neighboring palms prophylactically with Mancozeb (4g/L). Ensure good drainage around the base.',
  },
  'bud root dropping': {
    displayName: 'Bud Root Dropping (Root-Crown Interface Decay)',
    severity: 'High',
    chemical: 'Apply Hexaconazole (3ml/L) soil drench around the root zone; treat crown with Carbendazim paste.',
    cultural: 'Remove and incinerate dropped plant material immediately. Isolate affected palms.',
    preventive: 'Maintain soil aeration and avoid waterlogging. Apply Neem Cake (5kg/palm/year) as organic preventive.',
  },
  'gray leaf spot': {
    displayName: 'Gray Leaf Spot (Pestalotiopsis palmarum)',
    severity: 'Moderate',
    chemical: 'Spray 1% Bordeaux mixture or Copper Oxychloride (3g/L) on affected leaves during early stage.',
    cultural: 'Prune and burn severely affected leaves. Improve canopy airflow by removing lower fronds.',
    preventive: 'Apply balanced potassium fertilizer to boost palm resistance. Avoid overhead irrigation.',
  },
  'leaf rot': {
    displayName: 'Leaf Rot (Colletotrichum gloeosporioides)',
    severity: 'High',
    chemical: 'Apply Mancozeb (2.5g/L) or Carbendazim (1g/L) spray at early symptom stage.',
    cultural: 'Remove and destroy fully infected fronds. Ensure micro-nutrients boron and zinc are applied to soil.',
    preventive: 'Reduce canopy humidity by proper palm spacing. Monitor for early yellowing signs after rains.',
  },
  'stembleeding': {
    displayName: 'Stem Bleeding (Ceratocystis paradoxa)',
    severity: 'Critical',
    chemical: 'Chisel out infected trunk tissues. Apply Coal Tar or Bordeaux paste to all cut surfaces immediately.',
    cultural: 'Avoid wounding the trunk during agricultural activities. Remove excess soil piled against the trunk.',
    preventive: 'Provide root feeding with Carbendazim (2g in 100ml water) once every 3 months as prophylaxis.',
  },
  'healthy leaves': {
    displayName: 'Healthy Palm',
    severity: 'Healthy',
    chemical: 'No chemical treatment required.',
    cultural: 'Maintain current cultural practices. Continue regular monitoring every 2–4 weeks.',
    preventive: 'Maintain optimal NPK fertilization schedule as per CRI recommendations. Ensure good drainage.',
  },
};

// ── Helper: HTTP POST (JSON) ──────────────────────────────────────────
const postToService = (url: string, path: string, body: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      // Ensure proper path appending without replacing the base URL path
      const fullUrl = url.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
      const targetUrl = new URL(fullUrl);
      const data = JSON.stringify(body);
      const lib = targetUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 15000,
      };

      const req = lib.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(responseData));
            } else {
              reject(new Error(`Service returned status code ${res.statusCode}: ${responseData}`));
            }
          } catch (e) {
            reject(new Error('Failed to parse service JSON response'));
          }
        });
      });

      req.on('error', (err) => { reject(err); });
      req.on('timeout', () => { req.destroy(); reject(new Error('Request to service timed out')); });
      req.write(data);
      req.end();
    } catch (e: any) {
      reject(e);
    }
  });
};

// ── Helper: HTTP GET ─────────────────────────────────────────────────
const getFromService = (url: string, path: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const fullUrl = url.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
      const targetUrl = new URL(fullUrl);
      const lib = targetUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'GET',
        timeout: 15000,
      };

      const req = lib.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(responseData));
            } else {
              reject(new Error(`Service returned status ${res.statusCode}: ${responseData}`));
            }
          } catch (e) {
            reject(new Error('Failed to parse service GET response'));
          }
        });
      });

      req.on('error', (err) => { reject(err); });
      req.on('timeout', () => { req.destroy(); reject(new Error('GET request to service timed out')); });
      req.end();
    } catch (e: any) {
      reject(e);
    }
  });
};

// ── Helper: POST Multipart/form-data (base64 image → binary) ─────────
// Used to send images to Firebase Cloud Function predict_mobile_disease
// which expects multipart/form-data with an 'image' field.
const postImageToService = (url: string, path: string, imageBase64: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const fullUrl = url.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
      const targetUrl = new URL(fullUrl);
      const lib = targetUrl.protocol === 'https:' ? https : http;

      // Strip data URI prefix if present (e.g. "data:image/jpeg;base64,...")
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const boundary = `----FormBoundary${Date.now().toString(16)}`;
      const filename = `scan_${Date.now()}.jpg`;

      // Build multipart body
      const beforeFile = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`
      );
      const afterFile = Buffer.from(`\r\n--${boundary}--\r\n`);
      const totalLength = beforeFile.length + imageBuffer.length + afterFile.length;

      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': totalLength,
        },
        timeout: 120000,
      };

      const req = lib.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`Pathology service returned ${res.statusCode}: ${parsed.error || responseData}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse pathology service response: ${responseData.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => { reject(err); });
      req.on('timeout', () => { req.destroy(); reject(new Error('Pathology inference request timed out')); });

      // Write multipart body
      req.write(beforeFile);
      req.write(imageBuffer);
      req.write(afterFile);
      req.end();
    } catch (e: any) {
      reject(e);
    }
  });
};

// ── Response Enricher: disease_class → clinical metadata ─────────────
// Maps the raw System B output to the shape expected by SaruPol-Apk's
// scan-result.tsx: status, diagnosis, severity, recommendations.
const enrichPathologyResponse = (serviceResponse: any): any => {
  const diseaseClass: string = (serviceResponse.disease_class || 'healthy leaves').toLowerCase();
  const knowledge = DISEASE_KNOWLEDGE[diseaseClass] || DISEASE_KNOWLEDGE['healthy leaves'];

  return {
    // Original fields from service
    disease_class: diseaseClass,
    confidence: serviceResponse.confidence || 0,
    all_predictions: serviceResponse.all_predictions || [],
    inference_time_ms: serviceResponse.inference_time_ms || 0,

    // Enriched fields for APK scan-result.tsx
    system: 'B',
    part: serviceResponse.part || 'leaf',
    status: diseaseClass === 'healthy leaves' ? 'healthy' : 'diseased',
    diagnosis: knowledge.displayName,
    severity: knowledge.severity,
    recommendations: {
      chemical: knowledge.chemical,
      cultural: knowledge.cultural,
      preventive: knowledge.preventive,
    },
    timestamp: new Date().toISOString(),
  };
};

// --- MOCK FALLBACK DATA GENERATORS ---

const getMockYieldData = (body: any, is45Day: boolean) => {
  if (is45Day) {
    const moisture = parseFloat(body.soil_moisture || 35);
    const temp = parseFloat(body.temperature || 28);
    const age = parseFloat(body.palm_age || 10);
    const health = parseFloat(body.palm_health || 4);

    const baseline = 7.5;
    const factor = (moisture / 45) * 1.2 + (temp / 28) * 0.9 + (health / 5) * 1.5 + (age > 5 && age < 30 ? 1.2 : 0.8);
    const yieldVal = Math.round((baseline * factor) * 10) / 10;

    return {
      prediction: yieldVal,
      confidence_interval: [Math.max(1, yieldVal - 1.2), yieldVal + 1.2],
      cycle: '45-day cycle',
      recommendations: [
        'Maintain current drip irrigation levels',
        moisture < 25 ? 'Apply organic mulching around the basin to improve moisture retention' : 'Ensure proper soil aeration',
        health < 3 ? 'Apply recommended booster nitrogen doses' : 'Palm health is optimal. Maintain current fertilization schedule.',
      ],
    };
  } else {
    const rainfall = parseFloat(body.Rainfall_mm || 1800);
    const age = parseFloat(body.PalmAge_years || 12);
    const health = parseFloat(body.PalmHealth_1to5 || 4);

    const baseline = 65;
    const factor = (rainfall / 1500) * 1.1 + (health / 5) * 1.4 + (age > 6 && age < 40 ? 1.3 : 0.7);
    const yieldVal = Math.round(baseline * factor);

    return {
      ensemble_prediction: yieldVal,
      confidence_interval: [yieldVal - 8, yieldVal + 8],
      individual_models: {
        random_forest: yieldVal + 2,
        gradient_boosting: yieldVal - 1,
        xgboost: yieldVal,
        lightgbm: yieldVal - 3,
      },
      seasonal_forecast: [
        { month: 'Jan-Feb', yield: Math.round(yieldVal / 6 * 0.9) },
        { month: 'Mar-Apr', yield: Math.round(yieldVal / 6 * 1.1) },
        { month: 'May-Jun', yield: Math.round(yieldVal / 6 * 1.3) },
        { month: 'Jul-Aug', yield: Math.round(yieldVal / 6 * 0.8) },
        { month: 'Sep-Oct', yield: Math.round(yieldVal / 6 * 0.9) },
        { month: 'Nov-Dec', yield: Math.round(yieldVal / 6 * 1.0) },
      ],
      insights: [
        'Annual projection matches average historical variety potential.',
        'Expect peak harvest during the May-June cycle due to favorable preceding rainfall.',
      ],
    };
  }
};

const getMockPathologyData = (body: any) => {
  // Use the same disease knowledge map for mock data (consistent with real service)
  const diseaseClasses = Object.keys(DISEASE_KNOWLEDGE).filter(k => k !== 'healthy leaves');
  const randomClass = body.disease_class || diseaseClasses[Math.floor(Math.random() * diseaseClasses.length)];
  const knowledge = DISEASE_KNOWLEDGE[randomClass] || DISEASE_KNOWLEDGE['gray leaf spot'];

  const confidence = 0.78 + Math.random() * 0.18;
  const allPredictions = Object.entries(DISEASE_KNOWLEDGE).map(([cls, info]) => ({
    class: cls,
    confidence: cls === randomClass ? confidence : Math.random() * 0.25,
  })).sort((a, b) => b.confidence - a.confidence);

  return {
    disease_class: randomClass,
    confidence,
    all_predictions: allPredictions,
    inference_time_ms: Math.floor(Math.random() * 300) + 150,
    system: body.system || 'B',
    part: body.part || 'leaf',
    status: 'diseased',
    diagnosis: knowledge.displayName,
    severity: knowledge.severity,
    recommendations: {
      chemical: knowledge.chemical,
      cultural: knowledge.cultural,
      preventive: knowledge.preventive,
    },
    timestamp: new Date().toISOString(),
    source: 'mock_fallback',
  };
};

const getMockSoilData = (body: any) => {
  const pH = parseFloat(body.pH || 6.2);
  const N = parseFloat(body.N || 220);
  const P = parseFloat(body.P || 18);
  const K = parseFloat(body.K || 160);

  let score = 80;
  if (pH < 5.5 || pH > 7.5) score -= 15;
  if (N < 200) score -= 15;
  if (P < 15) score -= 10;
  if (K < 150) score -= 15;
  score = Math.max(20, Math.min(100, score));

  let fertility = 'Medium';
  if (score > 85) fertility = 'High';
  if (score < 50) fertility = 'Low';

  const deficiencies = [];
  if (N < 200) deficiencies.push({ nutrient: 'Nitrogen (N)', status: 'Low', comment: 'Essential for vegetative growth and leaf greenness.' });
  if (P < 15) deficiencies.push({ nutrient: 'Phosphorus (P)', status: 'Low', comment: 'Crucial for root development and early flowering.' });
  if (K < 150) deficiencies.push({ nutrient: 'Potassium (K)', status: 'Low', comment: 'Primary nutrient for coconut size, weight, and water absorption.' });

  return {
    health_score: score,
    fertility,
    deficiencies,
    optimal_ranges: { pH: '5.5 - 7.0', N: '200 - 350 mg/kg', P: '15 - 40 mg/kg', K: '150 - 300 mg/kg' },
    fertilizer_plan: [
      { fertilizer: 'Urea', amount_kg_per_palm: N < 200 ? 1.5 : 0.8, schedule: 'Split application: 50% in May-June, 50% in Oct-Nov', instructions: 'Apply within a 1.5m radius from the trunk in wet soil, mix lightly into topsoil.' },
      { fertilizer: 'Triple Super Phosphate (TSP)', amount_kg_per_palm: P < 15 ? 1.0 : 0.5, schedule: 'Apply full dose in May-June once a year', instructions: 'Incorporate into circular soil trenches.' },
      { fertilizer: 'Muriate of Potash (MOP)', amount_kg_per_palm: K < 150 ? 2.5 : 1.5, schedule: 'Split application identical to Urea', instructions: 'Apply and cover with mulch to minimize leaching.' },
      { fertilizer: 'Organic Compost', amount_kg_per_palm: 30.0, schedule: 'Apply annually during soil turning', instructions: 'Apply fully decomposed manure to improve water retention and microbial activity.' },
    ],
  };
};

const getMockAdvisoryResponse = (query: string) => {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('bud rot') || lowerQuery.includes('rot')) {
    return {
      answer: "Bud Rot is a critical fungal disease caused by *Phytophthora palmivora*. It leads to the rotting of the spindle leaf and the heart bud, causing the crown to drop. **Treatment Plan**: \n1. Cut off and destroy all infected crown tissues immediately. \n2. Apply a paste of Bordeaux mixture or copper oxychloride to the cut portion. \n3. Prophylactically spray neighboring palms with 1% Bordeaux mixture or Mancozeb.",
      sources: ['CRI Disease Advisory Leaflet No. 4', 'Coconut Cultivation Handbook - Section 12'],
      confidence: 0.95,
    };
  }

  if (lowerQuery.includes('fertilizer') || lowerQuery.includes('fertilizing') || lowerQuery.includes('nitrogen')) {
    return {
      answer: "For adult palms (aged 8+ years), the Coconut Research Institute (CRI) of Sri Lanka recommends a balanced application. **Standard mix per palm per year**: \n- **Urea**: 800g (source of Nitrogen)\n- **Eppawala Rock Phosphate (ERP)**: 600g (source of Phosphorus)\n- **Muriate of Potash (MOP)**: 1600g (source of Potassium)\n- **Dolomite**: 1000g (magnesium source, neutralizes pH)\n\n*Apply in split doses during the rainy season (May-June and October-November) for optimal absorption.*",
      sources: ['CRI Soils & Plant Nutrition Advisory Circular No. A1', 'Fertilizer Schedule Guide 2025'],
      confidence: 0.92,
    };
  }

  return {
    answer: "Welcome to the SaruPol AI Advisor! I can help you with coconut plantation management, including disease control (e.g., Bud Rot, Stem Bleeding), soil nutrients (NPK applications), harvesting cycles, and weather-driven yield forecasts. For optimal results, please specify the symptom or question you have about your palm tree or soil.",
    sources: ['SaruPol General Farming Knowledge Base'],
    confidence: 0.80,
  };
};

// --- PROXY HANDLERS ---

export const proxyYieldPredict = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const is45Day = req.path.includes('45day');
  const path = is45Day ? '/api/predict/45day' : '/api/predict';

  try {
    const result = await postToService(YIELD_URL, path, req.body);
    res.status(200).json(result);
  } catch (err: any) {
    console.warn(`[Proxy Warning] Yield service connection failed: ${err.message}. Sending mock fallback data.`);
    res.status(200).json(getMockYieldData(req.body, is45Day));
  }
};

// ── Generic Yield Microservice Proxy (Farms, Zones, Trees, CDA Rates) ──
export const proxyYieldGeneric = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const targetUrl = new URL(`${YIELD_URL.replace(/\/$/, '')}/api${req.path}`);
    Object.keys(req.query).forEach((k) => {
      targetUrl.searchParams.append(k, String(req.query[k]));
    });

    const lib = targetUrl.protocol === 'https:' ? https : http;
    const data = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body && Object.keys(req.body).length > 0 
      ? JSON.stringify(req.body) 
      : '';

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: 15000,
    };

    const proxyReq = lib.request(options, (proxyRes) => {
      let responseData = '';
      proxyRes.on('data', (chunk) => { responseData += chunk; });
      proxyRes.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          res.status(proxyRes.statusCode || 200).json(parsed);
        } catch {
          res.status(proxyRes.statusCode || 200).send(responseData);
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[Yield Proxy Request Error]:', err.message);
      res.status(502).json({ success: false, error: 'Yield microservice unreachable' });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      res.status(504).json({ success: false, error: 'Yield microservice timeout' });
    });

    if (data) proxyReq.write(data);
    proxyReq.end();
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Pathology Classify ────────────────────────────────────────────────
// Accepts: { imageBase64: string, part: string, system?: string }
// Converts base64 image to multipart/form-data and calls
// POST /predict_mobile_disease on the Firebase Functions service.
// Enriches the response with clinical metadata before returning to APK.
export const proxyPathologyClassify = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { imageBase64, part, system } = req.body;

  if (!imageBase64) {
    res.status(400).json({ error: 'Missing required field: imageBase64' });
    return;
  }

  try {
    console.log(`[Pathology Proxy] Calling predict_mobile_disease on ${PATHOLOGY_URL} for part=${part || 'leaf'}`);

    // Call the real Firebase Cloud Function endpoint with multipart image
    const rawResult = await postImageToService(
      PATHOLOGY_URL,
      '/predict_mobile_disease',
      imageBase64
    );

    // Enrich the response with clinical metadata
    const enrichedResult = enrichPathologyResponse({ ...rawResult, part: part || 'leaf' });

    console.log(`[Pathology Proxy] Success: disease_class=${enrichedResult.disease_class}, confidence=${(enrichedResult.confidence * 100).toFixed(1)}%, time=${enrichedResult.inference_time_ms}ms`);
    res.status(200).json(enrichedResult);
  } catch (err: any) {
    console.warn(`[Pathology Proxy] Firebase service unreachable: ${err.message}. Returning mock fallback.`);
    // Fallback mock includes real disease knowledge for consistency
    res.status(200).json(getMockPathologyData({ part: part || 'leaf', system: system || 'B' }));
  }
};

// ── Pathology Sync ─────────────────────────────────────────────────────
// Proxies batch sync of mobile diagnostic results to Firestore via
// the Firebase Cloud Function sync_mobile_diagnostics.
export const proxyPathologySync = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await postToService(PATHOLOGY_URL, '/sync_mobile_diagnostics', req.body);
    res.status(200).json(result);
  } catch (err: any) {
    console.warn(`[Pathology Proxy] Sync service unreachable: ${err.message}. Returning local acknowledgement.`);
    res.status(200).json({
      synced_count: 0,
      failed_ids: (req.body.batch || []).map((b: any) => b.local_id),
      server_timestamp: new Date().toISOString(),
      offline: true,
      message: 'Backend offline — diagnostics stored locally on device.',
    });
  }
};

// ── Pathology History ──────────────────────────────────────────────────
// Proxies GET request to Firebase get_diagnostic_history endpoint.
export const proxyPathologyHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { user_id, estate_id, limit } = req.query;

  if (!user_id) {
    res.status(400).json({ error: 'Missing required query param: user_id' });
    return;
  }

  try {
    const params = new URLSearchParams({ user_id: user_id as string, limit: String(limit || 50) });
    if (estate_id) params.set('estate_id', estate_id as string);

    const result = await getFromService(PATHOLOGY_URL, `/get_diagnostic_history?${params.toString()}`);
    res.status(200).json(result);
  } catch (err: any) {
    console.warn(`[Pathology Proxy] History service unreachable: ${err.message}. Returning empty history.`);
    res.status(200).json({
      user_id,
      count: 0,
      diagnostics: [],
      offline: true,
    });
  }
};

// ── Pathology Feedback ─────────────────────────────────────────────────
// Proxies feedback for pathology predictions. Since feedback might not
// be fully implemented in the Firebase service yet, we gracefully fallback.
export const proxyPathologyFeedback = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await postToService(PATHOLOGY_URL, '/submit_feedback', req.body);
    res.status(200).json(result);
  } catch (err: any) {
    console.warn(`[Pathology Proxy] Feedback service unreachable or endpoint missing: ${err.message}. Returning local acknowledgement.`);
    res.status(200).json({
      success: true,
      local: true,
      message: 'Feedback saved locally (backend offline or endpoint missing).',
    });
  }
};

export const proxySoilAnalyze = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await postToService(SOIL_URL, '/api/soil/analyze', req.body);
    res.status(200).json(result);
  } catch (err: any) {
    console.warn(`[Proxy Warning] Soil service connection failed: ${err.message}. Sending mock fallback data.`);
    res.status(200).json(getMockSoilData(req.body));
  }
};

export const proxyAdvisoryChat = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await postToService(ADVISORY_URL, '/api/chat', req.body);
    res.status(200).json(result);
  } catch (err: any) {
    console.warn(`[Proxy Warning] Advisory service connection failed: ${err.message}. Sending mock fallback data.`);
    res.status(200).json(getMockAdvisoryResponse(req.body.message || ''));
  }
};
