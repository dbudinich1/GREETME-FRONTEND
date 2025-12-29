# Greet-Me.com

AI-powered personalized video greeting card service. Users submit a photo and details, and the system generates a custom AI text greeting, converts it to speech, creates a talking video, and emails it to the recipient.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Features](#features)
- [Rate Limiting](#rate-limiting)
- [Legal & Compliance](#legal--compliance)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**Greet-Me.com** allows users to create and send personalized video greetings with minimal effort:

1. User fills out a form (recipient name, email, occasion, photo URL)
2. Backend generates AI-powered greeting text based on the occasion
3. Text is converted to speech using ElevenLabs TTS
4. D-ID creates a "talking photo" video from the audio and photo
5. Video is emailed to the recipient via SendGrid
6. User sees real-time status updates during processing

**Key Features:**
- ✅ No user accounts required (anonymous usage)
- ✅ Real-time job status polling
- ✅ Rate limiting (10 greetings per user per day)
- ✅ Responsive design (mobile & desktop)
- ✅ Form validation with inline errors
- ✅ Legal compliance (Terms of Service, Privacy Policy, consent checkbox)

---

## 🏗️ Architecture
```
┌─────────────┐
│   Frontend  │  React/Vite SPA
│ (Port 5173) │  - Form submission
└──────┬──────┘  - Status polling
       │         - Error handling
       │ POST /api/jobs/send-greeting
       ▼
┌─────────────┐
│     API     │  Node.js/Express
│ (Port 8080) │  - Job creation
└──────┬──────┘  - Rate limiting
       │         - Queue management
       │ Enqueue job
       ▼
┌─────────────┐
│ Azure Queue │  Message queue
│   Storage   │  - Job persistence
└──────┬──────┘  - Reliable delivery
       │
       │ Poll & dequeue
       ▼
┌─────────────┐
│   Worker    │  Background processor
│  (Separate) │  - AI text generation
└──────┬──────┘  - TTS (ElevenLabs)
       │         - Video (D-ID)
       │         - Email (SendGrid)
       ▼
┌─────────────┐
│  Recipient  │  Email inbox
│    Email    │  - Video greeting
└─────────────┘
```

**Flow:**
1. Frontend → API: Submit greeting request
2. API → Queue: Enqueue job as JSON message
3. API → Blob: Store job metadata
4. Worker → Queue: Poll for new jobs
5. Worker → ElevenLabs: Generate audio from text
6. Worker → D-ID: Create video from audio + photo
7. Worker → SendGrid: Email video to recipient
8. Worker → Blob: Update job status (processing → completed/failed)
9. Frontend → API: Poll job status every 2 seconds

---

## 🛠️ Tech Stack

### **Frontend**
- **React 18** - UI framework
- **Vite** - Build tool & dev server
- **JavaScript (ES6+)** - No TypeScript

### **Backend**
- **Node.js 18+** - Runtime
- **Express** - Web framework
- **Azure Storage Queue** - Job queue
- **Azure Blob Storage** - Job metadata storage
- **express-rate-limit** - Rate limiting middleware

### **External APIs**
- **ElevenLabs** - Text-to-speech (TTS)
- **D-ID** - Talking photo video generation
- **SendGrid** - Email delivery

### **Deployment**
- **Azure App Service** - API hosting
- **Azure App Service** - Worker hosting (separate instance)
- **Vercel/Netlify/Azure Static Web Apps** - Frontend hosting (options)

---

## ✅ Prerequisites

Before setting up the project, ensure you have:

- **Node.js 18+** and **npm** installed
- **Azure Storage Account** (for Queue & Blob storage)
- **ElevenLabs API Key** ([Sign up](https://elevenlabs.io/))
- **D-ID API Key** ([Sign up](https://www.d-id.com/))
- **SendGrid API Key** ([Sign up](https://sendgrid.com/))
- **Git** (for cloning the repository)

---

## 📂 Project Structure
```
greet-me/
├── greetme-frontend/          # React frontend
│   ├── src/
│   │   ├── App.jsx            # Main app component
│   │   ├── JobStatus.jsx      # Status polling component
│   │   ├── Legal.jsx          # Terms & Privacy page
│   │   └── main.jsx           # Entry point
│   ├── .env                   # Frontend env vars
│   ├── package.json
│   └── vite.config.js
│
├── greetme-backend/           # Node.js backend
│   ├── index.js               # Express API server
│   ├── worker.js              # Background job processor
│   ├── rateLimiter.js         # Rate limiting middleware
│   ├── utils/
│   │   ├── aiGreeting.js      # AI greeting text generator
│   │   ├── blobService.js     # Azure Blob operations
│   │   ├── occasion.js        # Occasion definitions
│   │   └── ...
│   ├── .env                   # Backend env vars
│   └── package.json
│
└── README.md                  # This file
```

---

## 🔧 Setup Instructions

### **Backend Setup**

1. **Clone the repository:**
```bash
   git clone https://github.com/yourusername/greet-me.git
   cd greet-me/greetme-backend
```

2. **Install dependencies:**
```bash
   npm install
```

3. **Create `.env` file:**
```bash
   cp .env.example .env
   # Edit .env and add your API keys (see Environment Variables section)
```

4. **Verify setup:**
```bash
   npm run dev
   # Should see: "✅ API listening on 8080"
```

### **Frontend Setup**

1. **Navigate to frontend:**
```bash
   cd ../greetme-frontend
```

2. **Install dependencies:**
```bash
   npm install
```

3. **Create `.env` file:**
```bash
   echo "VITE_API_BASE=http://localhost:8080" > .env
```

4. **Start dev server:**
```bash
   npm run dev
   # Should see: "Local: http://localhost:5173"
```

5. **Open browser:**
```
   http://localhost:5173
```

---

## 🔐 Environment Variables

### **Backend (.env)**

Create a `.env` file in `greetme-backend/` with the following:
```env
# Azure Storage (Queue & Blob)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your_account;AccountKey=your_key;EndpointSuffix=core.windows.net
AZURE_STORAGE_QUEUE_NAME=greetme-jobs

# ElevenLabs TTS
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
DEFAULT_ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# D-ID Video Generation
DID_API_KEY=your_did_api_key_here

# SendGrid Email
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Server Config
PORT=8080
NODE_ENV=development
```

### **Frontend (.env)**

Create a `.env` file in `greetme-frontend/` with:
```env
# API Endpoint
VITE_API_BASE=http://localhost:8080

# Production:
# VITE_API_BASE=https://your-api-domain.azurewebsites.net
```

### **How to Get API Keys:**

1. **Azure Storage:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Create a Storage Account
   - Go to "Access Keys" → Copy Connection String

2. **ElevenLabs:**
   - Sign up at [elevenlabs.io](https://elevenlabs.io/)
   - Go to Profile → API Keys
   - Copy your API key
   - Find voice IDs in Voice Library

3. **D-ID:**
   - Sign up at [d-id.com](https://www.d-id.com/)
   - Go to API Keys section
   - Generate new key

4. **SendGrid:**
   - Sign up at [sendgrid.com](https://sendgrid.com/)
   - Go to Settings → API Keys
   - Create key with "Mail Send" permissions
   - Verify sender email address

---

## 🚀 Running Locally

### **Option 1: Run Both (Recommended)**

**Terminal 1 - Backend API:**
```bash
cd greetme-backend
npm run dev
# Listening on http://localhost:8080
```

**Terminal 2 - Worker:**
```bash
cd greetme-backend
node worker.js
# Worker polling queue...
```

**Terminal 3 - Frontend:**
```bash
cd greetme-frontend
npm run dev
# Running on http://localhost:5173
```

### **Option 2: Just API (for testing)**

If you only want to test the API without the worker:
```bash
cd greetme-backend
npm run dev
```

Test endpoints:
```bash
# Health check
curl http://localhost:8080/health

# Get occasions
curl http://localhost:8080/api/occasions

# Submit greeting (will queue but not process without worker)
curl -X POST http://localhost:8080/api/jobs/send-greeting \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "recipientEmail": "recipient@example.com",
    "recipientName": "John Doe",
    "occasionKey": "birthday",
    "photoUrl": "https://example.com/photo.jpg"
  }'
```

---

## 🌐 Deployment

### **Backend (Azure App Service)**

1. **Create two Azure App Services:**
   - `greetme-api` (for Express API)
   - `greetme-worker` (for background worker)

2. **Configure environment variables in Azure:**
   - Go to Configuration → Application Settings
   - Add all variables from `.env`

3. **Deploy API:**
```bash
   cd greetme-backend
   zip -r api.zip . -x "node_modules/*" ".git/*"
   # Upload api.zip to Azure App Service (greetme-api)
```

4. **Deploy Worker:**
```bash
   # Same code, but set startup command to: node worker.js
```

5. **Verify deployment:**
```bash
   curl https://your-api-name.azurewebsites.net/health
```

### **Frontend (Vercel - Recommended)**

1. **Build production bundle:**
```bash
   cd greetme-frontend
   npm run build
   # Creates dist/ folder
```

2. **Deploy to Vercel:**
```bash
   # Install Vercel CLI
   npm i -g vercel

   # Deploy
   vercel --prod

   # Set environment variable in Vercel dashboard:
   # VITE_API_BASE = https://your-api-name.azurewebsites.net
```

3. **Alternative: Netlify**
```bash
   # Drag & drop dist/ folder to Netlify
   # Or connect GitHub repo for auto-deploy
```

---

## 📖 API Documentation

### **Base URL**
- Local: `http://localhost:8080`
- Production: `https://your-api-domain.azurewebsites.net`

### **Endpoints**

#### **GET /health**
Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "service": "greetme-api",
  "time": "2025-12-29T10:00:00.000Z"
}
```

---

#### **GET /api/occasions**
Get list of available greeting occasions.

**Response:**
```json
{
  "occasions": [
    { "key": "birthday", "title": "Birthday" },
    { "key": "anniversary", "title": "Anniversary" },
    { "key": "holiday", "title": "Holiday" }
  ]
}
```

---

#### **POST /api/jobs/send-greeting**
Create a new greeting job.

**Rate Limit:** 10 requests per user per 24 hours

**Request Body:**
```json
{
  "userId": "anon_12345",
  "recipientEmail": "john@example.com",
  "recipientName": "John Smith",
  "occasionKey": "birthday",
  "photoUrl": "https://example.com/photo.jpg",
  "greetingText": "",
  "voiceId": null,
  "relationshipKey": "",
  "relationshipNote": "",
  "personalSentiment": ""
}
```

**Response (Success):**
```json
{
  "ok": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Rate Limited):**
```json
{
  "error": "Too many greetings created",
  "message": "You can only send 10 greetings per day. Please try again tomorrow.",
  "retryAfter": "24 hours"
}
```

---

#### **GET /api/jobs/:jobId**
Get status of a greeting job.

**Response:**
```json
{
  "ok": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "createdAt": "2025-12-29T10:00:00.000Z",
  "payload": {
    "recipientEmail": "john@example.com",
    "recipientName": "John Smith",
    "occasionKey": "birthday"
  }
}
```

**Status Values:**
- `queued` - Job is waiting to be processed
- `processing` - Worker is currently processing the job
- `completed` - Greeting sent successfully
- `failed` - Job failed (check logs for details)

---

## ✨ Features

### **Form Validation**
- Email format validation (regex)
- HTTPS URL validation for photos
- Required field checks with inline errors
- Real-time validation on blur

### **Rate Limiting**
- 10 greetings per user per 24 hours
- Based on `userId` from localStorage
- Clear error messages when limit exceeded
- Memory-based store (resets on server restart)
- Production-ready for single-server deployments

### **Job Status Polling**
- Frontend polls `/api/jobs/:jobId` every 2 seconds
- Shows real-time status: Queued → Processing → Completed
- Displays success message with green checkmark
- Error handling with user-friendly messages

### **Responsive Design**
- Mobile-friendly (works on phones, tablets, desktops)
- Purple gradient theme
- Card-based layout
- Smooth transitions and hover effects

### **Legal Compliance**
- Terms of Service page
- Privacy Policy page
- Consent checkbox required before submission
- Clear language about content usage

---

## 🚦 Rate Limiting

The API implements rate limiting to prevent abuse:

**Limits:**
- **10 greetings per user per 24 hours**
- Based on `userId` from request body
- Fallback to IP address if no userId

**Configuration:**
```javascript
// rateLimiter.js
export const greetingRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 requests per window
  keyGenerator: (req) => req.body.userId || req.ip
});
```

**Upgrade to Redis (for multi-server):**
```bash
npm install rate-limit-redis redis
```

See `rateLimiter.js` comments for Redis configuration.

---

## ⚖️ Legal & Compliance

### **User Consent**
Users must check a consent box before submitting:

> "I confirm that I own or have obtained all necessary rights and permissions to use this photo and voice, and that I consent to their use for creating and sending a personalized greeting."

### **Legal Pages**
- **Terms of Service:** `/#/legal`
- **Privacy Policy:** `/#/legal`

Both are accessible via the Legal.jsx component.

### **Data Handling**
- No user accounts required
- Anonymous usage via localStorage userId
- Photos are referenced by URL (not stored)
- Job data stored in Azure Blob Storage
- Emails sent via SendGrid

---

## 🐛 Troubleshooting

### **"Cannot connect to API"**
- Check that backend is running on port 8080
- Verify `VITE_API_BASE` in frontend `.env`
- Check CORS settings in `index.js`

### **"Job stuck in 'queued' status"**
- Worker is not running or crashed
- Start worker: `node worker.js`
- Check worker logs for errors

### **"ElevenLabs API error"**
- Verify `ELEVENLABS_API_KEY` in `.env`
- Check API quota (free tier limits)
- Test API key: `curl -H "xi-api-key: YOUR_KEY" https://api.elevenlabs.io/v1/voices`

### **"D-ID API error"**
- Verify `DID_API_KEY` in `.env`
- Check API credits remaining
- Ensure photo URL is accessible (HTTPS, no 403/404)

### **"SendGrid email not delivered"**
- Verify `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`
- Check that sender email is verified in SendGrid
- Look for emails in spam folder
- Check SendGrid activity logs

### **"Rate limit hit immediately"**
- Server restarted (memory store reset)
- Try with different browser/device (different userId)
- Wait 24 hours or use Redis store for persistence

### **Frontend shows "Missing VITE_API_BASE"**
- Create `.env` file in `greetme-frontend/`
- Add: `VITE_API_BASE=http://localhost:8080`
- Restart Vite dev server

---

## 📝 Development Notes

### **Adding New Occasions**
Edit `utils/occasion.js`:
```javascript
export const OCCASION_LIST = [
  { key: "birthday", title: "Birthday" },
  { key: "anniversary", title: "Anniversary" },
  { key: "graduation", title: "Graduation" }, // Add new
];
```

### **Customizing AI Greeting Text**
Edit `utils/aiGreeting.js` to modify the AI text generation logic.

### **Changing Rate Limits**
Edit `rateLimiter.js`:
```javascript
max: 20, // Change from 10 to 20
windowMs: 12 * 60 * 60 * 1000, // Change from 24h to 12h
```

### **Adding New Voice Options**
1. Get voice IDs from ElevenLabs
2. Add dropdown to frontend form
3. Pass `voiceId` in POST request
4. Worker will use specified voice instead of default

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

Contributions welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📞 Support

For questions or issues:
- **Email:** support@greet-me.com
- **GitHub Issues:** [github.com/yourusername/greet-me/issues](https://github.com/yourusername/greet-me/issues)

---

## 🎉 Acknowledgments

Built with:
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Express](https://expressjs.com/)
- [Azure](https://azure.microsoft.com/)
- [ElevenLabs](https://elevenlabs.io/)
- [D-ID](https://www.d-id.com/)
- [SendGrid](https://sendgrid.com/)

---

**Made with ❤️ for creating personalized greetings**