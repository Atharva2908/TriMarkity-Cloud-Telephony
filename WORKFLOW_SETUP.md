# VoIP Outbound Calling System - Complete Workflow Setup

This document describes the complete end-to-end workflow for the outbound VoIP calling system.

## System Architecture

### Workflow Flow:
1. **Frontend Dialer** → User enters phone number and clicks "Call"
2. **Backend API** → POST request to `/api/telnyx/dial` with to/from numbers
3. **Telnyx Integration** → Backend calls Telnyx Call Control API
4. **Call Initiation** → Telnyx dials the number and sends webhooks
5. **MongoDB Storage** → All call logs, contacts, and recordings stored
6. **Real-time Updates** → WebSocket connection for live call status
7. **Frontend Display** → Real-time status, duration, and call controls
8. **Call End** → Hangup, duration calculation, recording retrieval
9. **Call History** → Logs displayed with recordings and metadata

## Backend Setup

### 1. Environment Variables

Create `.env` file in backend directory:

\`\`\`env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=telnyx_calling
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_API_V2_KEY=your_telnyx_api_v2_key
TELNYX_WEBHOOK_URL=https://your-domain.com/webhooks/call
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:3000
\`\`\`

### 2. Install Dependencies

\`\`\`bash
cd backend
pip install -r requirements.txt
\`\`\`

### 3. Initialize MongoDB

\`\`\`bash
# Run database initialization script
python scripts/init_db.py

# Or use MongoDB shell to create collections manually:
# mongosh
# > use telnyx_calling
# > db.createCollection("contacts")
# > db.createCollection("call_logs")
# > db.createCollection("recordings")
# > db.createCollection("numbers")
# > db.createCollection("telnyx_config")
\`\`\`

### 4. Start Backend Server

\`\`\`bash
python backend/main.py
# Server runs on http://localhost:8000
\`\`\`

## Frontend Setup

### 1. Environment Variables

Create `.env.local` file in frontend root:

\`\`\`env
NEXT_PUBLIC_API_URL=http://localhost:8000
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Start Development Server

\`\`\`bash
npm run dev
# Frontend runs on http://localhost:3000
\`\`\`

## API Endpoints

### Call Management

#### Initiate Call
- **Endpoint**: `POST /api/telnyx/dial`
- **Request**:
  \`\`\`json
  {
    "to_number": "+12125551234",
    "from_number": "+14155551234",
    "connection_id": "optional_connection_id"
  }
  \`\`\`
- **Response**:
  \`\`\`json
  {
    "call_id": "uuid",
    "status": "dialing",
    "to_number": "+12125551234",
    "from_number": "+14155551234"
  }
  \`\`\`

#### Get Call Status
- **Endpoint**: `GET /api/call-status/status/{call_id}`
- **Response**: Full call object with status, duration, timestamps

#### Get Active Calls
- **Endpoint**: `GET /api/call-status/active`
- **Response**: Array of currently active calls

#### End Call
- **Endpoint**: `POST /api/telnyx/hangup/{call_id}`
- **Response**: Confirmation with final duration

#### Get Call Statistics
- **Endpoint**: `GET /api/call-status/stats`
- **Response**: Total calls, completed, failed, average duration

### Contacts Management

#### Get All Contacts
- **Endpoint**: `GET /api/contacts/`
- **Response**: Array of all contacts

#### Create Contact
- **Endpoint**: `POST /api/contacts/`
- **Request**:
  \`\`\`json
  {
    "name": "John Smith",
    "phone": "+12125551001",
    "email": "john@example.com",
    "category": "lead|client|follow_up|other"
  }
  \`\`\`

#### Toggle Favorite
- **Endpoint**: `POST /api/contacts/{contact_id}/favorite`
- **Response**: Updated favorite status

#### Update Contact
- **Endpoint**: `PUT /api/contacts/{contact_id}`
- **Request**: Updated contact object

#### Delete Contact
- **Endpoint**: `DELETE /api/contacts/{contact_id}`

### Call Logs

#### Get All Logs
- **Endpoint**: `GET /api/calls/logs`
- **Query Params**: Optional filters

#### Search Logs
- **Endpoint**: `GET /api/calls/logs/search`
- **Query Params**: `query`, `status`

#### Get Log Stats
- **Endpoint**: `GET /api/calls/stats/summary`
- **Response**: Statistics summary

### Recordings

#### Get All Recordings
- **Endpoint**: `GET /api/recordings/`
- **Response**: Array of recording metadata

#### Get Call Recording
- **Endpoint**: `GET /api/recordings/{call_id}`
- **Response**: Recording metadata for specific call

#### Delete Recording
- **Endpoint**: `DELETE /api/recordings/{recording_id}`

### Phone Numbers

#### Get Numbers
- **Endpoint**: `GET /api/numbers/`
- **Response**: Array of configured numbers

#### Add Number
- **Endpoint**: `POST /api/numbers/`
- **Request**:
  \`\`\`json
  {
    "number": "+12125551234",
    "name": "Main Office",
    "status": "active",
    "is_default": false
  }
  \`\`\`

#### Set Default Number
- **Endpoint**: `POST /api/numbers/{number_id}/set-default`

### Telnyx Configuration

#### Get Settings
- **Endpoint**: `GET /api/telnyx/settings`
- **Response**: Current Telnyx configuration

#### Update Settings
- **Endpoint**: `POST /api/telnyx/settings`
- **Request**:
  \`\`\`json
  {
    "api_key": "your_key",
    "api_v2_key": "your_v2_key",
    "webhook_url": "https://your-domain.com/webhooks/call",
    "connection_id": "optional"
  }
  \`\`\`

### Webhooks

#### Call Webhook
- **Endpoint**: `POST /webhooks/call`
- **Description**: Receives Telnyx call status updates
- **Events**: call.initiated, call.answered, call.ended, recording.finished

## Frontend Components

### Main Components
- **SoftphoneLayout**: Main tabbed interface
- **DialerScreen**: Number pad and call controls
- **ContactsScreen**: Contact management
- **CallLogsScreen**: Call history and recordings
- **SettingsScreen**: Telnyx configuration

### Hooks
- **useCallApi**: Call initiation and control
- **useCallLogs**: Fetch and search call logs
- **useContactsApi**: Contact management
- **useNumbersApi**: Phone number management
- **useRecordingsApi**: Recording management
- **useTelnyxSettings**: Configuration management
- **useWebhookCalls**: WebSocket real-time updates

## Demo Mode

If Telnyx API keys are not configured, the system runs in **demo mode**:
- Calls simulate progression (dialing → ringing → active → ended)
- All data is stored in MongoDB
- UI functions normally
- No actual phone calls are made
- Perfect for testing the UI/UX

## Production Deployment

### 1. Backend Deployment (Vercel/Railway/Heroku)
\`\`\`bash
# Ensure .env variables are set in deployment platform
# Deploy FastAPI application
\`\`\`

### 2. Frontend Deployment (Vercel)
\`\`\`bash
# Deploy Next.js application
vercel deploy
\`\`\`

### 3. MongoDB Atlas
- Create MongoDB Atlas cluster
- Set `MONGODB_URL` to Atlas connection string

### 4. Telnyx Configuration
- Purchase numbers in Telnyx portal
- Configure webhook URL to your deployed backend
- Set real API keys in environment variables

### 5. CORS Configuration
- Update `CORS_ORIGINS` to include production frontend URL
- Update webhook URL to production domain

## Troubleshooting

### Backend Issues
- **MongoDB Connection**: Check `MONGODB_URL` and ensure MongoDB is running
- **Telnyx API Errors**: Verify API keys and connection ID
- **CORS Errors**: Ensure frontend URL is in `CORS_ORIGINS`

### Frontend Issues
- **API Connection**: Check `NEXT_PUBLIC_API_URL` env variable
- **Demo Mode**: If backend unavailable, frontend switches to demo mode automatically
- **WebSocket**: Ensure WebSocket endpoint accessible at `/ws/calls`

### Database Issues
- **Collections Missing**: Run `python scripts/init_db.py`
- **Indexes Not Created**: Check database.py `_create_collections()` method

## Development Workflow

1. Start MongoDB: `mongod`
2. Start Backend: `python backend/main.py`
3. Start Frontend: `npm run dev`
4. Open http://localhost:3000
5. Test with demo mode or real Telnyx keys

## Testing Checklist

- [ ] Demo contacts appear in Contacts tab
- [ ] Can dial numbers and see call progression
- [ ] Call logs appear after call ends
- [ ] Can toggle mute/speaker during call
- [ ] Can add new contacts
- [ ] Settings persist after refresh
- [ ] WebSocket receives real-time updates
- [ ] Can search call logs
- [ ] Can view recordings (when available)
- [ ] Different from_number options appear in dialer
