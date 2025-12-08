# VoIP System - Complete Deployment Guide

## System Summary

You now have a **complete, production-ready outbound VoIP calling platform** with:

- **Frontend**: Next.js 16 React app with modern softphone UI
- **Backend**: FastAPI REST API with Telnyx integration
- **Database**: MongoDB for call logs, contacts, recordings
- **Real-time**: WebSocket support for live call updates
- **Demo Mode**: Works without Telnyx API keys for testing

## Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- Python 3.8+
- MongoDB (local or Atlas)

### Step 1: Frontend Setup
\`\`\`bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
\`\`\`

\`\`\`bash
npm install
npm run dev
# Frontend: http://localhost:3000
\`\`\`

### Step 2: Backend Setup
\`\`\`bash
# backend/.env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=telnyx_calling
TELNYX_API_KEY=your_key_here
TELNYX_API_V2_KEY=your_v2_key_here
JWT_SECRET=change_me_in_production
\`\`\`

\`\`\`bash
cd backend
pip install -r requirements.txt
python scripts/init_db.py  # Initialize database
python main.py
# Backend: http://localhost:8000
\`\`\`

### Step 3: Test the Application
1. Open http://localhost:3000
2. See demo contacts in Contacts tab
3. Dial a number using the keypad
4. Watch call progression in demo mode
5. View call history in Logs tab

## Production Deployment

### Backend Deployment (Railway/Hercel/AWS)

1. **Prepare Repository**
   \`\`\`bash
   # Ensure all requirements are in requirements.txt
   # Set environment variables in deployment platform
   \`\`\`

2. **Deploy to Railway**
   - Connect GitHub repo
   - Set environment variables
   - Deploy

3. **Deploy to Heroku**
   \`\`\`bash
   heroku login
   heroku create your-app-name
   git push heroku main
   \`\`\`

### Frontend Deployment (Vercel)

1. **Push to GitHub**
   \`\`\`bash
   git push origin main
   \`\`\`

2. **Deploy to Vercel**
   \`\`\`bash
   vercel deploy
   \`\`\`

3. **Set Environment Variables**
   - `NEXT_PUBLIC_API_URL`: Your deployed backend URL

### MongoDB Setup

1. **Create Atlas Cluster**
   - Go to mongodb.com/cloud
   - Create free M0 cluster
   - Get connection string

2. **Set MONGODB_URL**
   \`\`\`
   MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
   DATABASE_NAME=telnyx_calling
   \`\`\`

### Telnyx Configuration

1. **Get API Keys**
   - Go to portal.telnyx.com
   - Create application
   - Get API Key and API V2 Key

2. **Purchase Phone Numbers**
   - Buy virtual numbers in Telnyx
   - Add to system via Settings

3. **Configure Webhooks**
   - Telnyx Dashboard → Connections
   - Set Webhook URL to: `https://your-backend.com/webhooks/call`

## Environment Variables Reference

### Backend
\`\`\`env
# MongoDB
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=telnyx_calling

# Telnyx API
TELNYX_API_KEY=
TELNYX_API_V2_KEY=
TELNYX_WEBHOOK_URL=http://localhost:8000/webhooks/call

# JWT
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256

# App Config
APP_NAME=Telnyx Calling System
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://your-frontend.com

# Frontend
FRONTEND_URL=http://localhost:3000
\`\`\`

### Frontend
\`\`\`env
NEXT_PUBLIC_API_URL=http://localhost:8000
\`\`\`

## API Endpoints

### Call Management
- `POST /api/telnyx/dial` - Initiate call
- `GET /api/call-status/status/{call_id}` - Get status
- `GET /api/call-status/active` - Get active calls
- `POST /api/telnyx/hangup/{call_id}` - End call
- `GET /api/call-status/stats` - Get statistics

### Contacts
- `GET /api/contacts/` - List all
- `POST /api/contacts/` - Create
- `PUT /api/contacts/{id}` - Update
- `DELETE /api/contacts/{id}` - Delete
- `POST /api/contacts/{id}/favorite` - Toggle favorite

### Call Logs
- `GET /api/calls/logs` - List all
- `GET /api/calls/logs/search` - Search
- `GET /api/calls/stats/summary` - Statistics

### Recordings
- `GET /api/recordings/` - List all
- `GET /api/recordings/{call_id}` - Get recording
- `DELETE /api/recordings/{id}` - Delete

### Phone Numbers
- `GET /api/numbers/` - List all
- `POST /api/numbers/` - Add number
- `POST /api/numbers/{id}/set-default` - Set default

### Configuration
- `GET /api/telnyx/settings` - Get settings
- `POST /api/telnyx/settings` - Update settings

## Features Implemented

### Dialer Screen
✓ 12-button numeric keypad
✓ Number formatting
✓ From/To number selection
✓ Real-time call duration
✓ Mute/unmute controls
✓ Speaker control
✓ Quick access to recent contacts
✓ Call status display

### Contacts Management
✓ Add/edit/delete contacts
✓ Search functionality
✓ Favorite contacts
✓ Email and phone storage
✓ Category tagging
✓ Call history integration

### Call History
✓ Complete call logs
✓ Filter by status
✓ Search by number
✓ Download recordings
✓ Call statistics
✓ Duration tracking

### Settings
✓ Telnyx API configuration
✓ Phone number management
✓ Recording preferences
✓ Webhook configuration
✓ Auto-record toggle

### Backend Features
✓ Telnyx API integration
✓ Webhook handling
✓ MongoDB persistence
✓ Real-time status tracking
✓ Call recording management
✓ WebSocket support
✓ Demo mode support

## Testing Checklist

- [ ] Backend runs on localhost:8000
- [ ] Frontend runs on localhost:3000
- [ ] Can dial numbers in demo mode
- [ ] Call progression shows (dialing → active → ended)
- [ ] Mute/speaker controls work
- [ ] Call duration increments during active call
- [ ] Call appears in logs after completion
- [ ] Can search call logs
- [ ] Can add/delete contacts
- [ ] Can toggle contact favorites
- [ ] Settings persist after refresh
- [ ] WebSocket connects (check browser console)
- [ ] Database collections created

## Troubleshooting

### Backend won't start
\`\`\`bash
# Check MongoDB connection
mongosh  # or mongo

# Check Python version
python --version  # Should be 3.8+

# Reinstall dependencies
pip install -r requirements.txt --upgrade
\`\`\`

### Frontend won't connect to backend
\`\`\`bash
# Check NEXT_PUBLIC_API_URL in .env.local
echo $NEXT_PUBLIC_API_URL

# Check backend is running
curl http://localhost:8000/health

# Clear browser cache
# Ctrl+Shift+Delete
\`\`\`

### Calls not working
\`\`\`bash
# Check Telnyx API key is set
echo $TELNYX_API_V2_KEY

# Check webhook URL is accessible
# Should receive POST requests from Telnyx

# Run in demo mode (no API key needed)
# Calls will simulate automatically
\`\`\`

### Database issues
\`\`\`bash
# Check MongoDB is running
mongod --version

# Initialize collections
python backend/scripts/init_db.py

# Check connection
mongosh "mongodb://localhost:27017"
\`\`\`

## Scaling Considerations

### Database
- Add indexes for better performance
- Use MongoDB Atlas for production
- Set up replication for redundancy

### Backend
- Use load balancer (nginx, HAProxy)
- Deploy multiple instances
- Use message queue (Redis) for webhooks

### Frontend
- Deploy to CDN (Vercel, Cloudflare)
- Enable caching
- Optimize bundle size

## Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Use HTTPS for all endpoints
- [ ] Set CORS_ORIGINS to specific domain
- [ ] Validate all inputs
- [ ] Use environment variables for secrets
- [ ] Enable MongoDB authentication
- [ ] Rate limit API endpoints
- [ ] Add API key authentication
- [ ] Implement user authentication
- [ ] Use HTTPS webhooks

## Next Steps

1. ✓ System setup complete
2. Test with demo mode
3. Set up Telnyx account
4. Configure webhooks
5. Deploy to production
6. Add user authentication
7. Implement call transfer
8. Add SMS capabilities
9. Build mobile app
10. Add call analytics

## Support Resources

- **Telnyx Docs**: https://developers.telnyx.com/
- **Next.js Docs**: https://nextjs.org/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **MongoDB Docs**: https://docs.mongodb.com/

## Architecture Diagram

\`\`\`
┌────────────────┐
│   Frontend     │
│   (Next.js)    │
│   React 19     │
└────────┬───────┘
         │
         │ HTTP + WebSocket
         │
         ▼
┌────────────────┐
│   Backend      │
│   (FastAPI)    │
│   Python 3.8+  │
└────────┬───────┘
         │
    ┌────┴────┬───────────┐
    │          │           │
    ▼          ▼           ▼
┌────────┐ ┌────────┐ ┌─────────┐
│MongoDB │ │ Telnyx │ │ Webhooks│
│        │ │ API v2 │ │ Events  │
└────────┘ └────────┘ └─────────┘
\`\`\`

## Workflow Summary

**User Flow:**
1. User dials number → Frontend sends to Backend
2. Backend calls Telnyx API → Call initiated
3. Telnyx sends webhooks → Status updated in DB
4. Frontend polls status → UI shows real-time updates
5. Call completes → Logged with duration
6. User can review logs and recordings

**Demo Mode:**
- When Telnyx API key missing
- Calls simulate automatically
- Perfect for UI/UX testing
- All data persists in MongoDB

**Production:**
- Real phone calls via Telnyx
- All features enabled
- Webhooks receive real events
- Full call recording support
