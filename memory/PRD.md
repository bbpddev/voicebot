# IT Service Desk Voice Agent - PRD

## Problem Statement
Build a web page based IT Service Desk voice agent that assists users with troubleshooting, creating tickets, retrieving knowledge (for troubleshooting) and providing updates on users' tickets.

## User Choices
- Voice: xAI Grok Realtime Voice Agent API (`wss://api.x.ai/v1/realtime`)
- AI Brains: GPT-4.1 (OpenAI) for KB processing and intelligent summarization
- Ticket Storage: MongoDB (built-in)
- Knowledge Base: Pre-loaded FAQ articles + file upload (PDF/DOCX/TXT)
- UI Style: Dark modern, super modern and innovative, sci-fi command center

## Architecture

### Tech Stack
- **Frontend**: React 18, Tailwind CSS, Framer Motion, Lucide React, Sonner
- **Backend**: FastAPI (Python), MongoDB (Motor async)
- **Voice**: xAI Grok Voice Agent API (WebSocket `wss://api.x.ai/v1/realtime`)
- **AI**: OpenAI GPT-4.1 via emergentintegrations library
- **Fonts**: Orbitron, Rajdhani, Inter, JetBrains Mono

### Backend Services
- `GET /api/health` - Health check
- `WebSocket /api/ws` - WebSocket proxy (browser ↔ xAI Voice Agent)
- `GET/POST /api/tickets` - Ticket management
- `GET/PATCH/DELETE /api/tickets/{id}` - Individual ticket operations
- `GET/POST /api/kb` - Knowledge base management
- `POST /api/kb/upload` - File upload processing with GPT-4.1
- `GET /api/kb/search` - Search KB articles
- `POST /api/session` - Generate xAI ephemeral token

### Voice Agent Architecture
1. Browser captures mic audio (PCM 24000 Hz via AudioWorklet)
2. Browser connects to `/api/ws` WebSocket
3. Backend proxies to xAI `wss://api.x.ai/v1/realtime`
4. xAI Grok model processes speech, generates voice response (Rex voice)
5. When function tools are called:
   - `create_ticket` → MongoDB insert
   - `search_knowledge_base` → MongoDB text search + GPT-4.1 summarization
   - `get_ticket` → MongoDB query
   - `list_tickets` → MongoDB query with filter
   - `update_ticket_status` → MongoDB update
6. Audio response (PCM 24000 Hz) streams back to browser via AudioContext

## What's Been Implemented (Feb 2026)

### Core Features
- [x] Real-time voice agent using xAI Grok Voice Agent API
- [x] WebSocket proxy backend (browser → FastAPI → xAI)
- [x] AudioWorklet-based mic capture (24000 Hz PCM)
- [x] Streaming audio playback via AudioContext scheduler
- [x] Live transcript feed (user & AI messages)
- [x] IT Service Desk system prompt (Rex persona)
- [x] **Auto-reconnect on unexpected session drop** — conversation stays live until user explicitly ends it
- [x] **Transcript preserved across auto-reconnects** — seamless natural conversation
- [x] Deployment to Netlify (frontend) + Railway (backend) — fix: added tailwindcss/autoprefixer to package.json devDeps

### Ticket Management
- [x] 5 voice function tools: create_ticket, search_kb, get_ticket, list_tickets, update_ticket_status
- [x] REST CRUD API for tickets
- [x] 3 seeded sample tickets (TKT-001, TKT-002, TKT-003)
- [x] Status filters: ALL/OPEN/IN_PROGRESS/RESOLVED/CLOSED
- [x] Priority badges: CRITICAL/HIGH/MEDIUM/LOW
- [x] Ticket expand/collapse with action buttons

### Knowledge Base
- [x] 8 pre-loaded IT troubleshooting articles (VPN, Password, Performance, Email, Printer, WiFi, Software, BSOD)
- [x] PDF/DOCX/TXT file upload with GPT-4.1 structuring
- [x] MongoDB text search with fallback keyword search
- [x] GPT-4.1 intelligent summarization for voice responses
- [x] Search/filter UI

### UI/UX
- [x] Sci-Fi Command Center dark theme
- [x] 3-panel bento grid layout
- [x] Animated voice orb (4 states: idle, listening, speaking, processing)
- [x] Live streaming transcript feed
- [x] Noise texture + scanline overlay
- [x] Corner accent HUD panels
- [x] Glassmorphism cards
- [x] Motion animations (Framer Motion)
- [x] Sonner toast notifications

## Backlog / Future Items

### P0 (High Priority)
- [ ] User authentication (assign tickets to specific users)
- [ ] Voice agent conversation history persistence

### P1 (Medium Priority)  
- [ ] Email notifications for ticket updates
- [ ] Ticket priority escalation alerts
- [ ] Multiple voice options (Ara, Rex, Sal, Eve, Leo)
- [ ] Conversation history across sessions

### P2 (Low Priority)
- [ ] Analytics dashboard (ticket trends, resolution times)
- [ ] Integration with external ticketing systems (ServiceNow, Jira)
- [ ] SLA tracking and alerting
- [ ] Admin panel for KB management

## Configuration
```
XAI_API_KEY=xai-xxx (xAI Grok Voice API)
OPENAI_API_KEY=sk-xxx (GPT-4.1)
MONGO_URL=mongodb://localhost:27017
DB_NAME=it_service_desk
```
