# Telnyx Softphone - Complete Implementation

A production-ready softphone application built with Next.js, FastAPI, and MongoDB for making and managing outbound VoIP calls through Telnyx.

## Quick Start

### 1. Clone and Install
\`\`\`bash
# Frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
\`\`\`

### 2. Configure Environment
Update `backend/.env` with your Telnyx credentials:
\`\`\`bash
TELNYX_API_KEY=your_api_key
TELNYX_API_V2_KEY=your_api_v2_key
MONGODB_URL=mongodb://localhost:27017
\`\`\`

### 3. Start Services
\`\`\`bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
python backend/main.py

# Terminal 3: MongoDB (if local)
mongod
\`\`\`

Visit `http://localhost:3000` and start making calls!

## Features

### Core Functionality
- Full numeric keypad dialer
- Contact management with search
- Complete call history with filtering
- Call recordings management
- Real-time call status tracking
- Mute, hold, and DTMF controls

### Telnyx Integration
- Live call initiation via Telnyx API
- Webhook-based call event handling
- Machine detection
- Configurable calling numbers
- Automatic call logging

### Professional Features
- Dark/light theme support
- Responsive design for all devices
- Search and filter capabilities
- Settings for API configuration
- Demo mode when backend unavailable

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI, Python 3.8+, Uvicorn
- **Database**: MongoDB
- **VoIP**: Telnyx API v2
- **Real-time**: WebSockets support

## Project Structure

\`\`\`
├── app/                          # Next.js app directory
│   ├── page.tsx                 # Home page
│   └── layout.tsx               # Root layout
├── components/
│   ├── softphone-layout.tsx      # Main interface
│   ├── screens/                  # Feature screens
│   │   ├── dialer-screen.tsx
│   │   ├── contacts-screen.tsx
│   │   ├── call-logs-screen.tsx
│   │   └── settings-screen.tsx
│   └── navigation.tsx
├── hooks/                        # React hooks
│   ├── use-webrtc.ts
│   ├── use-call-logs.ts
│   ├── use-recordings.ts
│   └── use-telnyx.ts
└── backend/
    ├── main.py                  # FastAPI app
    ├── models.py                # Data models
    ├── config.py                # Configuration
    ├── database.py              # MongoDB setup
    └── routes/
        ├── calls.py             # Call management
        ├── recordings.py        # Recording management
        ├── telnyx-integration.py # Telnyx API
        ├── webhooks.py          # Webhook handlers
        ├── contacts.py          # Contact management
        └── ...other routes
\`\`\`

## API Documentation

### Key Endpoints

**Calls**
- `POST /api/calls/initiate` - Start a call
- `GET /api/calls/logs` - Get call history
- `POST /api/calls/{id}/mute` - Mute/unmute
- `POST /api/calls/{id}/hold` - Hold/resume
- `GET /api/calls/stats/summary` - Call statistics

**Recordings**
- `GET /api/recordings` - List recordings
- `POST /api/recordings/{call_id}/upload` - Upload
- `DELETE /api/recordings/{id}` - Delete

**Contacts**
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `PUT /api/contacts/{id}` - Update contact

**Telnyx**
- `POST /api/telnyx/initiate-telnyx-call` - Make call via Telnyx
- `POST /api/telnyx/configure-webhook` - Setup webhooks

## Configuration

### Database Setup
\`\`\`bash
# Local MongoDB
mongod

# Or use MongoDB Atlas
# Update MONGODB_URL in .env
MONGODB_URL=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority
\`\`\`

### Telnyx Setup
1. Create Telnyx account
2. Get API keys from dashboard
3. Configure webhook URL in settings
4. Add calling numbers
5. Update .env with credentials

## Deployment

### Vercel (Frontend)
\`\`\`bash
npm install -g vercel
vercel
# Set NEXT_PUBLIC_API_URL to your backend URL
\`\`\`

### Heroku/Railway (Backend)
\`\`\`bash
# Ensure Procfile exists
web: gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.main:app
\`\`\`

## Demo Mode

The application works without backend:
- Simulated call progression
- Demo contacts and call logs
- All UI features functional
- Perfect for testing/demos

## Support

For issues or questions:
1. Check `SOFTPHONE_IMPLEMENTATION.md` for detailed docs
2. Review environment variable setup
3. Ensure MongoDB is running
4. Verify Telnyx credentials
5. Check browser console for errors

## License

MIT
