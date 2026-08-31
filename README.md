<div align="center">

<img src="./docs/brand/logo-icon.png" alt="SaruPol Icon" width="90" />
<br/>
<img src="./docs/brand/logo-text.png" alt="සරුපොල් (SaruPol)" width="380" />

### 🌴 සරුපොල් (SaruPol) — API Gateway
**Unified Microservices Gateway & Reverse Proxy for the SaruPol Smart Coconut Plantation Ecosystem**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19.2-black.svg?logo=express&logoColor=white)](https://expressjs.com/)
[![Google Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-Deployed-4285F4.svg?logo=googlecloud&logoColor=white)](https://sarupol-gateway-636168956069.asia-south1.run.app)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![JWT](https://img.shields.io/badge/Auth-JWT%20Bearer-orange.svg?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Status](https://img.shields.io/badge/Status-Production%20Live-brightgreen.svg)]()

</div>

---

##📖 Overview

**SaruPol-Gateway** serves as the central communication backbone and security layer for the **SaruPol Coconut Research & Plantation Intelligence Platform**. It provides a single, high-performance REST API entry point for the **SaruPol Mobile Client (Expo/React Native APK)** and web dashboards, routing requests across four autonomous AI/ML microservices.

### Key Capabilities
- 🔐 **Centralized Authentication**: Built-in User Registration, Login, and JWT Token issuance backed by an embedded SQLite datastore.
- 🔀 **Smart Microservice Reverse Proxying**: Routes traffic seamlessly to heterogeneous AI microservices (FastAPI backends and Firebase Serverless Cloud Functions).
- 🧬 **Pathology Payload Transformation & Enrichment**: Converts base64 mobile scans into binary multipart streams for CNN models and enriches raw inference outputs with Coconut Research Institute (CRI) agronomic metadata.
- 🛡️ **Fail-Safe Offline Resilience**: Intelligent mock-fallback engine ensuring uninterrupted mobile client operation and field testing even during partial microservice downtime.
- 🌐 **Cross-Origin & Network Optimization**: Standardized CORS headers, large payload handling (10MB+ for high-res canopy imagery), and dynamic IP discovery for local Wi-Fi field deployments.

---

## 🏛️ System Architecture

```
                                  ┌───────────────────────────────────┐
                                  │    SaruPol Mobile App / Web UI    │
                                  └─────────────────┬─────────────────┘
                                                    │
                                                    │ HTTP / JSON (Port 8000)
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       SaruPol-Gateway (Express / TS)                                    │
│                                                                                                        │
│  ┌───────────────────────┐   ┌────────────────────────┐   ┌─────────────────────────────────────────┐  │
│  │   Auth Controller     │   │   JWT Authentication   │   │        Request/Response Pipeline        │  │
│  │   (Register / Login)  │   │       Middleware       │   │  (Multipart Converter & CRI Enricher)   │  │
│  └───────────┬───────────┘   └────────────────────────┘   └────────────────────┬────────────────────┘  │
│              │ (SQLite Engine)                                                 │                       │
│              ▼                                                                 ▼                       │
│        database.sqlite                                            Reverse Proxy Controller             │
└────────────────────────────────────────────────────────────────────────────────┬───────────────────────┘
                                                                                 │
          ┌───────────────────────────┬──────────────────────────┬───────────────┴──────────────┐
          │ (Multipart/JSON)          │ (JSON)                   │ (JSON)                       │ (JSON)
          ▼                           ▼                          ▼                              ▼
┌───────────────────┐       ┌───────────────────┐      ┌───────────────────┐          ┌───────────────────┐
│ Pathology Service │       │   Yield Predict   │      │ Soil Intelligence │          │ Advisory Chatbot  │
│ (Firebase Cloud   │       │ (FastAPI: Port    │      │ (FastAPI: Port    │          │  (FastAPI: Port   │
│  Functions / CNN) │       │      5001)        │      │      5003)        │          │      5000)        │
└───────────────────┘       └───────────────────┘      └───────────────────┘          └───────────────────┘
```

---

## 🧩 Microservice Routing Matrix

| Subsystem | Upstream Backend | Gateway Route Prefix | Target Endpoints |
| :--- | :--- | :--- | :--- |
| **Authentication** | Internal (SQLite) | `/api/auth` | `/register`, `/login`, `/profile` |
| **Pathology Detection** | Firebase Cloud Functions / CNN | `/api/pathology` | `/classify`, `/sync`, `/history`, `/feedback` |
| **Yield Prediction** | FastAPI (`:5001`) | `/api/predict` | `/predict`, `/predict/45day`, `/prediction-history` |
| **Soil Intelligence** | FastAPI (`:5003`) | `/api/soil`, `/api/v1` | `/v1/predict/triangulated`, `/v1/predict/single`, `/v1/trees` |
| **Advisory Assistant** | FastAPI (`:5000`) | `/api/advisory`, `/api` | `/ask`, `/ask-multi`, `/translate-batch`, `/tts` |
| **Health Check** | Gateway Core | `/health` | Server status, timestamp |

---

## 📂 Project Structure

```
SaruPol-Gateway/
├── src/
│   ├── config/
│   │   └── db.ts               # SQLite schema definition and database connection
│   ├── controllers/
│   │   ├── authController.ts   # User authentication, bcrypt hashing, JWT issuance
│   │   └── proxyController.ts  # Microservice forwarding, image transformation, CRI enrichment & mock data
│   ├── middleware/
│   │   └── authMiddleware.ts   # Bearer token validation and route guarding
│   ├── routes/
│   │   ├── authRoutes.ts       # Public & protected authentication endpoints
│   │   └── proxyRoutes.ts      # Proxy route declarations for all 4 subsystems
│   └── index.ts                # Application entrypoint, CORS configuration & server bootstrap
├── .env.example                # Environment variables template
├── database.sqlite             # Embedded SQLite database (generated at runtime)
├── package.json                # Project dependencies and execution scripts
├── tsconfig.json               # TypeScript compiler configuration
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn** / **pnpm**
- **Git**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/SaruPol-Gateway.git
   cd SaruPol-Gateway
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```
   The gateway will start on `http://localhost:8000`.

---

## ⚙️ Configuration (`.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | Port on which the Gateway listens |
| `JWT_SECRET` | `sarupol_super_secret_key_2026` | Secret key used for signing JWT authentication tokens |
| `PATHOLOGY_SERVICE_URL` | `http://127.0.0.1:5001/coconut-pathology-detection/asia-south1` | Base URL for Pathology Firebase Function service |
| `YIELD_SERVICE_URL` | `http://localhost:5001` | Base URL for Yield Prediction FastAPI service |
| `SOIL_SERVICE_URL` | `http://localhost:5003` | Base URL for Soil Intelligence FastAPI service |
| `ADVISORY_SERVICE_URL` | `http://localhost:5000` | Base URL for Advisory RAG / Multi-LLM FastAPI service |

---

## 📡 API Reference

### 1. Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@sarupol.lk",
  "password": "SecurePassword123"
}
```

#### User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "jane@sarupol.lk",
  "password": "SecurePassword123"
}
```

#### Get Current Profile
```http
GET /api/auth/profile
Authorization: Bearer <JWT_TOKEN>
```

---

### 2. Coconut Pathology Detection

#### Classify Disease from Base64 Image
```http
POST /api/pathology/classify
Content-Type: application/json

{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "part": "leaf",
  "system": "B"
}
```

#### Batch Diagnostic Synchronization
```http
POST /api/pathology/sync
Content-Type: application/json

{
  "user_id": "usr_123",
  "device_id": "dev_456",
  "estate_id": "est_789",
  "batch": [
    {
      "local_id": "loc_1",
      "disease_class": "bud rot",
      "confidence": 0.94,
      "gps": { "lat": 7.2906, "lng": 80.6337 },
      "captured_at": "2026-08-22T06:00:00Z",
      "image_ref": "storage/path/img.jpg"
    }
  ]
}
```

---

### 3. Soil Intelligence & Yield Prediction

#### Triangulated Soil Prediction (3-Point Spatial Sampling)
```http
POST /api/v1/predict/triangulated
Content-Type: application/json

{
  "tree_no": 104,
  "zone_id": "Block A",
  "point_a": { "N": 0.018, "P": 0.14, "K": 0.08, "pH": 6.2 },
  "point_b": { "N": 0.016, "P": 0.15, "K": 0.07, "pH": 6.4 },
  "point_c": { "N": 0.017, "P": 0.13, "K": 0.09, "pH": 6.3 }
}
```

#### 45-Day Cycle Yield Prediction
```http
POST /api/predict/45day
Content-Type: application/json

{
  "soil_moisture": 32.5,
  "temperature": 28.2,
  "humidity": 78,
  "palm_age": 12,
  "palm_health": 4.5
}
```

---

### 4. Advisory System & RAG Engine

#### Ask Advisory Question (Multi-LLM / Consensus RAG)
```http
POST /api/ask
Content-Type: application/json

{
  "question": "What is the recommended fertilizer schedule for adult palms during rainy season?",
  "language": "en",
  "latitude": 7.2906,
  "longitude": 80.6337
}
```

---

## 🛠️ Available Scripts

- `npm run dev` — Runs the gateway in live-reload development mode using `ts-node-dev`.
- `npm run build` — Compiles TypeScript into production-ready JavaScript in the `dist/` directory.
- `npm start` — Runs the compiled production build with standard `node`.

---

## 🔬 Research & Citations

This API Gateway is developed as part of the **SaruPol Research Initiative** (AI & IoT-driven Decision Support for Sri Lankan Coconut Plantations). Agronomic validation rules and recommendations are formulated in accordance with the **Coconut Research Institute (CRI) of Sri Lanka**.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
