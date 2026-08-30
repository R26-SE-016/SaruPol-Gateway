import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import proxyRoutes from './routes/proxyRoutes';
import './config/db'; // Trigger DB connection & table initialization

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' })); // Support high-res 4K drone orthomosaics & GeoTIFFs
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', proxyRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[SaruPol Gateway] Running on port http://localhost:${PORT}`);
});
