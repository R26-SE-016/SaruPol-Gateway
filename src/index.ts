import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import proxyRoutes from './routes/proxyRoutes';
import './config/db'; // Trigger DB connection & table initialization

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 8000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

app.use(express.json({ limit: '100mb' })); // Support high-res 4K drone orthomosaics & GeoTIFFs
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Root Service Info
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'SaruPol API Gateway',
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      pathology: '/api/pathology',
      soil: '/api/soil',
      yield: '/api/yield',
      advisory: '/api/advisory'
    }
  });
});

// Health check endpoint for GCP Cloud Run / Load Balancers
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', proxyRoutes);

// Start Server on 0.0.0.0 for GCP Cloud Run container compatibility
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SaruPol Gateway] Running on port http://0.0.0.0:${PORT}`);
});
