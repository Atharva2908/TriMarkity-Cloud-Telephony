# Quick Start Guide

## Option 1: Demo Mode (No Telnyx Account Needed)

Perfect for testing the UI and getting familiar with the system.

\`\`\`bash
# 1. Start MongoDB
mongod

# 2. Setup Backend
cd backend
cp .env.example .env
# Edit .env - leave TELNYX_API_KEY empty for demo mode
pip install -r requirements.txt
python scripts/init_db.py
python main.py

# 3. Setup Frontend (new terminal)
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev

# 4. Open http://localhost:3000
# Try calling a number - it will simulate the call progression
\`\`\`

## Option 2: Production with Telnyx

For making real phone calls.

\`\`\`bash
# 1. Get Telnyx API Keys
# Sign up at https://portal.telnyx.com
# Create application
# Purchase virtual numbers
# Get API Key and API V2 Key

# 2. Configure Backend
cd backend
cp .env.example .env
# Edit .env with real values:
# - TELNYX_API_V2_KEY=your_key
# - MONGODB_URL=your_connection_string
# - TELNYX_WEBHOOK_URL=https://your-domain.com/webhooks/call

# 3. Deploy backend to production
# Railway, Heroku, AWS, etc.

# 4. Configure Telnyx Webhooks
# Telnyx Portal → Connection
# Webhook URL: https://your-backend.com/webhooks/call

# 5. Deploy Frontend to Vercel
# Set NEXT_PUBLIC_API_URL to your backend URL

# 6. Make real calls!
\`\`\`

## Common Commands

\`\`\`bash
# Initialize database
python backend/scripts/init_db.py

# Run backend
python backend/main.py

# Run frontend
npm run dev

# Build frontend
npm run build

# Start production build
npm start

# Check database
mongosh
> use telnyx_calling
> db.call_logs.find()
> db.contacts.find()
\`\`\`

## Folder Structure

\`\`\`
.
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   ├── globals.css         # Tailwind styles
│   └── admin/
│       ├── page.tsx
│       └── analytics/
├── components/
│   ├── screens/
│   │   ├── dialer-screen.tsx
│   │   ├── contacts-screen.tsx
│   │   ├── call-logs-screen.tsx
│   │   └── settings-screen.tsx
│   ├── ui/                 # shadcn components
│   ├── softphone-layout.tsx
│   ├── navigation.tsx
│   └── ...
├── hooks/
│   ├── use-call-api.ts
│   ├── use-call-logs.ts
│   ├── use-contacts-api.ts
│   ├── use-webhook-calls.ts
│   └── ...
├── backend/
│   ├── main.py             # FastAPI app
│   ├── config.py           # Configuration
│   ├── database.py         # MongoDB singleton
│   ├── models.py           # Pydantic models
│   ├── routes/
│   │   ├── telnyx-api.py   # Call management
│   │   ├── calls.py        # Call logs
│   │   ├── contacts.py     # Contact management
│   │   ├── call-status.py  # Real-time status
│   │   ├── recordings.py   # Recording management
│   │   ├── numbers.py      # Phone numbers
│   │   ├── webhooks.py     # Webhook handling
│   │   └── ...
│   ├── scripts/
│   │   └── init_db.py      # Database initialization
│   └── requirements.txt
└── package.json
\`\`\`

## Key Files to Know

**Frontend:**
- `app/page.tsx` - Main entry point, calls SoftphoneLayout
- `components/softphone-layout.tsx` - Tabbed interface wrapper
- `hooks/use-call-api.ts` - Call state management
- `hooks/use-webhook-calls.ts` - Real-time WebSocket updates

**Backend:**
- `backend/main.py` - FastAPI setup, route registration
- `backend/routes/telnyx-api.py` - Telnyx Call Control integration
- `backend/routes/webhooks.py` - Webhook event handling
- `backend/database.py` - MongoDB singleton connection

## Environment Variables

\`\`\`bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend (.env)
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=telnyx_calling
TELNYX_API_V2_KEY=your_api_key_here
TELNYX_API_KEY=your_api_key_here
JWT_SECRET=your_secret_key
\`\`\`

## Testing the Workflow

1. **Open Dialer Tab**
   - Enter phone number
   - Click Call
   - Watch status: dialing → ringing → active → ended

2. **Open Call Logs Tab**
   - See completed call
   - Click download to get recording (production)

3. **Open Contacts Tab**
   - Add new contact
   - Star favorite
   - Call from quick access

4. **Open Settings Tab**
   - Configure Telnyx API keys
   - Add phone numbers
   - Enable auto-record

## Debugging

\`\`\`javascript
// Check console logs
console.log("[v0] Debug message")

// Browser console (Ctrl+Shift+J)
// Watch network tab for API calls
// Check Application tab for environment variables

// Backend logs
# Terminal shows FastAPI logs
# Check for webhook events
\`\`\`

## Next.js Deployment

\`\`\`bash
# Build
npm run build

# Test production build locally
npm run start

# Deploy to Vercel (recommended)
vercel deploy
\`\`\`

## FastAPI Deployment

\`\`\`bash
# Using Uvicorn
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Using Gunicorn (production)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.main:app
\`\`\`

That's it! You now have a complete, working VoIP calling system!
