import asyncio
import base64
import io
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Annotated, List, Optional

import httpx
import pdfplumber
import websockets
from bson import ObjectId
from docx import Document as DocxDocument
from dotenv import load_dotenv
from openai import AsyncOpenAI
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, Field

load_dotenv()

# --- Config ---
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
XAI_API_KEY = os.environ.get("XAI_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
XAI_REALTIME_URL = "wss://api.x.ai/v1/realtime"

# OpenAI async client (replaces emergentintegrations)
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# --- MongoDB ---
mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]
tickets_col = db["tickets"]
kb_col = db["knowledge_base"]
config_col = db["config"]
priority_incidents_col = db["priority_incidents"]

# --- PyObjectId helper ---
def validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str):
        return v
    raise ValueError("Invalid ObjectId")

PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]


# --- Models ---
class TicketCreate(BaseModel):
    title: str
    description: str
    priority: str = "medium"
    category: str = "general"
    user: str = "User"


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    resolution: Optional[str] = None
    priority: Optional[str] = None


class KBArticleCreate(BaseModel):
    title: str
    content: str
    category: str = "general"
    tags: List[str] = []


class KBArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None


class AgentConfig(BaseModel):
    system_prompt: str
    voice: str = "Rex"
    agent_name: str = "Rex"


# --- FastAPI ---
app = FastAPI(title="IT Service Desk Voice Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- System Prompt (default, overridable via admin) ---
DEFAULT_SYSTEM_PROMPT = """You are ChatIt, an AI-powered IT Service Desk assistant. You are warm, professional, and concise. This is a voice interface — keep all responses brief and conversational. Never use bullet points, numbered lists, or formatted text in your responses.

GREETING:
Always begin by greeting the user and introducing yourself as ChatIt, their IT support assistant, ready to help.

YOUR CAPABILITIES:
- Troubleshoot IT issues using the knowledge base
- Create and manage support tickets
- Search the knowledge base for known solutions
- Check and update existing tickets

TICKET NUMBER FORMAT:
If a user provides a ticket number without a dash (e.g. TKT001), always interpret it as TKT-001.

---

WORKFLOW — follow this exact sequence for every issue:

STEP 1 — LISTEN
Understand the user's issue. Ask one clarifying question if needed before proceeding.

STEP 2 — CREATE TICKET
Call the create_ticket function with the appropriate priority and category.
CRITICAL: Do NOT say any ticket number while calling the function. Say only something like "Let me log that for you now." Do NOT mention any ticket number (like TKT-001 or TKT-042) until AFTER the create_ticket function has returned its result.
Once you receive the function result, read the ticket_id from the result and confirm it to the user out loud.

STEP 3 — SEARCH KNOWLEDGE BASE
Search the knowledge base using search_knowledge_base before providing any troubleshooting steps.
Do not proceed with troubleshooting until you have found a matching knowledge article.
Do not make up or improvise any steps. Only use instructions from the knowledge article.

STEP 4 — TROUBLESHOOT
Provide troubleshooting one step at a time.
After each step, ask the user to confirm whether it worked before moving to the next step.
Do not skip ahead or provide multiple steps at once.

STEP 5 — RESOLVE OR ESCALATE
After troubleshooting, ask the user if their issue is resolved.
- If resolved: close the ticket as resolved and confirm the ticket number to the user again.
- If unresolved and urgent: offer to transfer the user to a live IT Service Desk agent.
- If unresolved and non-urgent hardware: offer to keep the ticket open and let the user know the team will be in contact to organise a replacement.

---

TICKET PRIORITIES:
- low: minor inconvenience, work not impacted
- medium: work is impacted but can continue
- high: unable to work
- critical: business-critical outage affecting multiple users

TICKET CATEGORIES:
network, software, hardware, access, email, general

---

RULES:
- NEVER say a ticket number until AFTER the create_ticket function has returned. Do not guess, invent, or pre-announce any ticket number. Only use the ticket_id from the function result.
- Never fabricate troubleshooting steps. Only use knowledge base content.
- After receiving the create_ticket result, immediately confirm the real ticket number to the user.
- Always wait for user confirmation before moving to the next troubleshooting step.
- Keep all responses short and spoken-word friendly. No lists or formatting.
- Maintain a consistent warm, calm, professional tone throughout."""


async def get_agent_config() -> dict:
    """Fetch agent config from DB, fallback to defaults."""
    doc = await config_col.find_one({"key": "agent_config"})
    if doc:
        return {
            "system_prompt": doc.get("system_prompt", DEFAULT_SYSTEM_PROMPT),
            "voice": doc.get("voice", "Rex"),
            "agent_name": doc.get("agent_name", "Rex"),
        }
    return {"system_prompt": DEFAULT_SYSTEM_PROMPT, "voice": "Rex", "agent_name": "Rex"}


# --- Function Tools ---
TOOLS = [
    {
        "type": "function",
        "name": "create_ticket",
        "description": "Create a new IT support ticket. Returns a JSON object with the real ticket_id. IMPORTANT: Do NOT say any ticket number to the user until you receive the result from this function. Only use the ticket_id value returned in the result.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Brief title of the IT issue"},
                "description": {"type": "string", "description": "Detailed description of the problem"},
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "critical"],
                    "description": "Issue priority level",
                },
                "category": {
                    "type": "string",
                    "enum": ["network", "software", "hardware", "access", "email", "general"],
                    "description": "Issue category",
                },
            },
            "required": ["title", "description", "priority", "category"],
        },
    },
    {
        "type": "function",
        "name": "search_knowledge_base",
        "description": "Search the IT knowledge base for troubleshooting solutions",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query describing the technical issue"}
            },
            "required": ["query"],
        },
    },
    {
        "type": "function",
        "name": "get_ticket",
        "description": "Get details of a specific support ticket",
        "parameters": {
            "type": "object",
            "properties": {
                "ticket_id": {"type": "string", "description": "Ticket ID (e.g., TKT-001)"}
            },
            "required": ["ticket_id"],
        },
    },
    {
        "type": "function",
        "name": "list_tickets",
        "description": "List support tickets, optionally filtered by status",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["open", "in_progress", "resolved", "closed", "all"],
                    "description": "Filter by ticket status",
                }
            },
        },
    },
    {
        "type": "function",
        "name": "update_ticket_status",
        "description": "Update the status of an existing ticket. Use this to reopen a resolved or closed ticket (set status to 'open'), mark as in_progress, resolve, or close it. When the user asks to reopen a ticket, call this immediately with status='open'.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticket_id": {"type": "string", "description": "Ticket ID to update"},
                "status": {
                    "type": "string",
                    "enum": ["open", "in_progress", "resolved", "closed"],
                },
                "note": {"type": "string", "description": "Optional resolution or status note"},
            },
            "required": ["ticket_id", "status"],
        },
    },
    {
        "type": "function",
        "name": "list_priority_incidents",
        "description": "List current active P1 and P2 priority incidents (major outages). Use this when the user asks about current outages, ongoing incidents, or known issues.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "type": "function",
        "name": "add_me_to_priority_incident",
        "description": "Add the caller as an impacted user on a current P1 or P2 priority incident. Use this when a user says they are affected by, or experiencing, a known outage.",
        "parameters": {
            "type": "object",
            "properties": {
                "incident_id": {
                    "type": "string",
                    "description": "The incident ID to add the user to (e.g., INC-0091)",
                },
            },
            "required": ["incident_id"],
        },
    },
]


# --- Function Handlers ---
async def handle_create_ticket(args: dict) -> dict:
    # Derive next ticket number by scanning all TKT-NNN IDs and finding the
    # highest numeric value.  We use a cursor (not find_one+sort) so the sort
    # is explicit and not subject to Motor/PyMongo version differences.
    last_num = 0
    try:
        cursor = tickets_col.find(
            {"ticket_id": {"$regex": r"^TKT-\d+$"}},
            projection={"ticket_id": 1},
        )
        async for doc in cursor:
            try:
                n = int(doc["ticket_id"].split("-")[1])
                if n > last_num:
                    last_num = n
            except (ValueError, IndexError):
                pass
    except Exception:
        pass

    # Retry up to 3 times in case a concurrent call grabs the same ID
    # (the unique index on ticket_id will reject duplicates).
    for attempt in range(3):
        ticket_id = f"TKT-{last_num + 1 + attempt:03d}"
        now = datetime.now(timezone.utc)
        doc = {
            "ticket_id": ticket_id,
            "title": args["title"],
            "description": args["description"],
            "priority": args.get("priority", "medium"),
            "category": args.get("category", "general"),
            "status": "open",
            "user": "Voice Agent User",
            "created_at": now,
            "updated_at": now,
            "resolution": None,
        }
        try:
            await tickets_col.insert_one(doc)
            return {
                "success": True,
                "ticket_id": ticket_id,
                "message": f"Ticket {ticket_id} created successfully. Title: {args['title']}. Priority: {args.get('priority', 'medium')}.",
            }
        except Exception as e:
            if "duplicate key" in str(e).lower() and attempt < 2:
                continue
            return {"success": False, "message": f"Failed to create ticket: {str(e)}"}

    return {"success": False, "message": "Failed to create ticket after multiple attempts."}


async def handle_search_knowledge_base(args: dict) -> dict:
    query = args["query"]
    # Text search in MongoDB
    articles = []
    try:
        cursor = kb_col.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(3)
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            articles.append(doc)
    except Exception:
        pass

    # Fallback: keyword search if text index not ready
    if not articles:
        keywords = query.lower().split()
        query_regex = "|".join(keywords[:3])
        cursor = kb_col.find({
            "$or": [
                {"title": {"$regex": query_regex, "$options": "i"}},
                {"content": {"$regex": query_regex, "$options": "i"}},
                {"tags": {"$elemMatch": {"$regex": query_regex, "$options": "i"}}},
            ]
        }).limit(3)
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            articles.append(doc)

    if not articles:
        return {
            "found": False,
            "message": "No relevant articles found in the knowledge base. Please describe your issue in more detail so I can create a ticket.",
        }

    # Use GPT-4.1 to summarize results for voice
    try:
        articles_text = "\n\n".join([f"Title: {a['title']}\n{a['content'][:800]}" for a in articles])
        completion = await openai_client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": "You are an IT support assistant. Summarize KB articles into a concise voice-friendly troubleshooting response. Use simple spoken language. Give step-by-step guidance Do not include unnecessary detail. Maximum 5 sentences."},
                {"role": "user", "content": f"User query: {query}\n\nKB Articles:\n{articles_text}\n\nProvide a concise troubleshooting response suitable for voice.Use simple spoken language. Give step-by-step guidance Do not include unnecessary detail (max 5 sentences)."},
            ],
            max_tokens=300,
        )
        response = completion.choices[0].message.content
        return {"found": True, "summary": response, "articles": [a["article_id"] for a in articles]}
    except Exception as e:
        # Fallback to raw article if GPT-4.1 fails
        top = articles[0]
        return {"found": True, "summary": f"From {top['title']}: {top['content'][:400]}", "articles": [a["article_id"] for a in articles]}


async def handle_get_ticket(args: dict) -> dict:
    ticket_id = args["ticket_id"].upper()
    doc = await tickets_col.find_one({"ticket_id": ticket_id})
    if not doc:
        return {"found": False, "message": f"Ticket {ticket_id} not found."}
    return {
        "found": True,
        "ticket_id": doc["ticket_id"],
        "title": doc["title"],
        "status": doc["status"],
        "priority": doc["priority"],
        "category": doc["category"],
        "description": doc["description"],
        "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else str(doc["created_at"]),
    }


async def handle_list_tickets(args: dict) -> dict:
    status_filter = args.get("status", "all")
    query = {} if status_filter == "all" else {"status": status_filter}
    tickets = []
    cursor = tickets_col.find(query).sort("created_at", -1).limit(10)
    async for doc in cursor:
        tickets.append({
            "ticket_id": doc["ticket_id"],
            "title": doc["title"],
            "status": doc["status"],
            "priority": doc["priority"],
            "category": doc["category"],
        })
    if not tickets:
        return {"count": 0, "message": "No tickets found.", "tickets": []}
    summary = ", ".join([f"{t['ticket_id']} ({t['status']})" for t in tickets[:5]])
    return {"count": len(tickets), "tickets": tickets, "summary": f"Found {len(tickets)} tickets: {summary}"}


async def handle_update_ticket_status(args: dict) -> dict:
    ticket_id = args["ticket_id"].upper()
    status = args["status"]
    note = args.get("note", "")
    update_doc = {"status": status, "updated_at": datetime.now(timezone.utc)}
    if note:
        update_doc["resolution"] = note
    result = await tickets_col.update_one({"ticket_id": ticket_id}, {"$set": update_doc})
    if result.matched_count == 0:
        return {"success": False, "message": f"Ticket {ticket_id} not found."}
    return {"success": True, "message": f"Ticket {ticket_id} updated to status: {status}."}


async def handle_list_priority_incidents(args: dict) -> dict:
    incidents = []
    cursor = priority_incidents_col.find({"active": True}).sort("priority", 1)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        incidents.append({
            "incident_id": doc["incident_id"],
            "title": doc["title"],
            "priority": doc["priority"],
            "status": doc["status"],
            "since": doc.get("since", ""),
            "affected": doc.get("affected", 0),
            "description": doc.get("description", ""),
        })
    if not incidents:
        return {"count": 0, "message": "No active P1/P2 incidents right now.", "incidents": []}
    summary = ", ".join([f"{i['incident_id']}: {i['title']}" for i in incidents])
    return {"count": len(incidents), "incidents": incidents, "summary": f"There are {len(incidents)} active incidents: {summary}"}


async def handle_add_me_to_priority_incident(args: dict) -> dict:
    incident_id = args["incident_id"].upper()
    doc = await priority_incidents_col.find_one({"incident_id": incident_id, "active": True})
    if not doc:
        return {"success": False, "message": f"Incident {incident_id} not found or is no longer active."}
    await priority_incidents_col.update_one(
        {"incident_id": incident_id},
        {"$inc": {"affected": 1}},
    )
    new_count = doc.get("affected", 0) + 1
    return {
        "success": True,
        "incident_id": incident_id,
        "title": doc["title"],
        "affected": new_count,
        "message": f"You've been added as impacted on {incident_id} ({doc['title']}). Total impacted users: {new_count}.",
    }


FUNCTION_HANDLERS = {
    "create_ticket": handle_create_ticket,
    "search_knowledge_base": handle_search_knowledge_base,
    "get_ticket": handle_get_ticket,
    "list_tickets": handle_list_tickets,
    "update_ticket_status": handle_update_ticket_status,
    "list_priority_incidents": handle_list_priority_incidents,
    "add_me_to_priority_incident": handle_add_me_to_priority_incident,
}


# --- WebSocket Proxy ---
@app.websocket("/api/ws")
async def voice_agent_ws(websocket: WebSocket):
    await websocket.accept()

    xai_headers = {"Authorization": f"Bearer {XAI_API_KEY}"}

    try:
        async with websockets.connect(
            XAI_REALTIME_URL, ssl=True, additional_headers=xai_headers, ping_interval=20
        ) as xai_ws:

            # Fetch latest config from DB
            cfg = await get_agent_config()

            # Configure session
            session_config = {
                "type": "session.update",
                "session": {
                    "voice": cfg["voice"],
                    "instructions": cfg["system_prompt"],
                    "turn_detection": {"type": "server_vad"},
                    "audio": {
                        "input": {"format": {"type": "audio/pcm", "rate": 24000}},
                        "output": {"format": {"type": "audio/pcm", "rate": 24000}},
                    },
                    "tools": TOOLS,
                },
            }
            await xai_ws.send(json.dumps(session_config))

            async def browser_to_xai():
                try:
                    while True:
                        raw = await websocket.receive_text()
                        msg = json.loads(raw)
                        allowed = {"input_audio_buffer.append", "input_audio_buffer.clear", "conversation.item.create", "response.create"}
                        if msg.get("type") in allowed:
                            await xai_ws.send(json.dumps(msg))
                except (WebSocketDisconnect, Exception):
                    pass

            async def xai_to_browser():
                try:
                    async for raw_msg in xai_ws:
                        event = json.loads(raw_msg)
                        etype = event.get("type", "")

                        if etype == "response.function_call_arguments.done":
                            func_name = event.get("name", "")
                            call_id = event.get("call_id", "")
                            try:
                                func_args = json.loads(event.get("arguments", "{}"))
                            except Exception:
                                func_args = {}

                            # Notify browser that function is running
                            try:
                                await websocket.send_json({"type": "function.started", "function": func_name})
                            except Exception:
                                pass

                            # Execute function — catch errors so one bad call never
                            # crashes the whole xai_to_browser task.
                            handler = FUNCTION_HANDLERS.get(func_name)
                            try:
                                if handler:
                                    result = await handler(func_args)
                                else:
                                    result = {"error": f"Unknown function: {func_name}"}
                            except Exception as e:
                                result = {"success": False, "error": str(e), "message": f"Function failed: {str(e)}"}

                            # Send result back to xAI
                            try:
                                await xai_ws.send(json.dumps({
                                    "type": "conversation.item.create",
                                    "item": {
                                        "type": "function_call_output",
                                        "call_id": call_id,
                                        "output": json.dumps(result),
                                    },
                                }))
                                await xai_ws.send(json.dumps({"type": "response.create"}))
                            except Exception:
                                pass

                            # Notify browser of result
                            try:
                                await websocket.send_json({
                                    "type": "function.executed",
                                    "function": func_name,
                                    "args": func_args,
                                    "result": result,
                                })
                            except Exception:
                                pass
                        else:
                            await websocket.send_text(raw_msg)
                except Exception:
                    pass

            task1 = asyncio.create_task(browser_to_xai())
            task2 = asyncio.create_task(xai_to_browser())
            done, pending = await asyncio.wait([task1, task2], return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()

    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# --- REST: Session Token ---
@app.post("/api/session")
async def get_session_token():
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.x.ai/v1/realtime/client_secrets",
            headers={"Authorization": f"Bearer {XAI_API_KEY}", "Content-Type": "application/json"},
            json={"expires_after": {"seconds": 300}},
        )
    return resp.json()


# --- REST: Tickets ---
@app.get("/api/tickets")
async def list_tickets(status: Optional[str] = None):
    query = {} if not status or status == "all" else {"status": status}
    tickets = []
    cursor = tickets_col.find(query).sort("created_at", -1)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        if isinstance(doc.get("updated_at"), datetime):
            doc["updated_at"] = doc["updated_at"].isoformat()
        tickets.append(doc)
    return tickets


@app.get("/api/tickets/{ticket_id}")
async def get_ticket_api(ticket_id: str):
    doc = await tickets_col.find_one({"ticket_id": ticket_id.upper()})
    if not doc:
        raise HTTPException(404, "Ticket not found")
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    if isinstance(doc.get("updated_at"), datetime):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return doc


@app.post("/api/tickets")
async def create_ticket_api(ticket: TicketCreate):
    result = await handle_create_ticket(ticket.dict())
    return result


@app.patch("/api/tickets/{ticket_id}")
async def update_ticket_api(ticket_id: str, update: TicketUpdate):
    update_doc = {"updated_at": datetime.now(timezone.utc)}
    if update.status:
        update_doc["status"] = update.status
    if update.resolution:
        update_doc["resolution"] = update.resolution
    if update.priority:
        update_doc["priority"] = update.priority
    result = await tickets_col.update_one({"ticket_id": ticket_id.upper()}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(404, "Ticket not found")
    return {"success": True}


@app.delete("/api/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str):
    result = await tickets_col.delete_one({"ticket_id": ticket_id.upper()})
    if result.deleted_count == 0:
        raise HTTPException(404, "Ticket not found")
    return {"success": True}


# --- REST: Priority Incidents ---
@app.get("/api/priority-incidents")
async def list_priority_incidents_api():
    incidents = []
    cursor = priority_incidents_col.find({"active": True}).sort("priority", 1)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        incidents.append(doc)
    return incidents


@app.post("/api/priority-incidents/{incident_id}/affected")
async def toggle_affected(incident_id: str, body: dict = {}):
    """Increment or decrement the affected count for a priority incident."""
    action = body.get("action", "add")
    inc_val = 1 if action == "add" else -1
    result = await priority_incidents_col.update_one(
        {"incident_id": incident_id.upper(), "active": True},
        {"$inc": {"affected": inc_val}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Incident not found")
    doc = await priority_incidents_col.find_one({"incident_id": incident_id.upper()})
    return {"success": True, "affected": doc.get("affected", 0)}


# --- REST: Knowledge Base ---
@app.get("/api/kb")
async def list_kb_articles():
    articles = []
    cursor = kb_col.find({}).sort("created_at", -1)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        articles.append(doc)
    return articles


@app.post("/api/kb")
async def create_kb_article(article: KBArticleCreate):
    article_num = await kb_col.count_documents({}) + 1
    article_id = f"KB-{article_num:03d}"
    doc = {
        "article_id": article_id,
        "title": article.title,
        "content": article.content,
        "category": article.category,
        "tags": article.tags,
        "source": "manual",
        "created_at": datetime.now(timezone.utc),
    }
    await kb_col.insert_one(doc)
    doc["_id"] = str(doc.get("_id", ""))
    return doc


@app.delete("/api/kb/{article_id}")
async def delete_kb_article(article_id: str):
    result = await kb_col.delete_one({"article_id": article_id.upper()})
    if result.deleted_count == 0:
        raise HTTPException(404, "Article not found")
    return {"success": True}


@app.put("/api/kb/{article_id}")
async def update_kb_article(article_id: str, update: KBArticleUpdate):
    update_doc = {}
    if update.title is not None:
        update_doc["title"] = update.title
    if update.content is not None:
        update_doc["content"] = update.content
    if update.category is not None:
        update_doc["category"] = update.category
    if update.tags is not None:
        update_doc["tags"] = update.tags
    if not update_doc:
        raise HTTPException(400, "No fields to update")
    update_doc["updated_at"] = datetime.now(timezone.utc)
    result = await kb_col.update_one({"article_id": article_id.upper()}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(404, "Article not found")
    return {"success": True}


# --- REST: Admin Config ---
@app.get("/api/admin/config")
async def get_config():
    cfg = await get_agent_config()
    cfg["default_prompt"] = DEFAULT_SYSTEM_PROMPT
    return cfg


@app.put("/api/admin/config")
async def update_config(config: AgentConfig):
    await config_col.update_one(
        {"key": "agent_config"},
        {"$set": {
            "key": "agent_config",
            "system_prompt": config.system_prompt,
            "voice": config.voice,
            "agent_name": config.agent_name,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"success": True, "message": "Agent configuration saved. Changes take effect on next voice session."}


@app.post("/api/admin/config/reset")
async def reset_config():
    await config_col.delete_one({"key": "agent_config"})
    return {"success": True, "system_prompt": DEFAULT_SYSTEM_PROMPT, "voice": "Rex", "agent_name": "Rex"}


@app.post("/api/kb/upload")
async def upload_kb_document(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename or ""
    text = ""

    if filename.lower().endswith(".pdf"):
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        except Exception as e:
            raise HTTPException(400, f"Could not read PDF: {e}")
    elif filename.lower().endswith(".docx"):
        try:
            doc = DocxDocument(io.BytesIO(content))
            text = "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            raise HTTPException(400, f"Could not read DOCX: {e}")
    elif filename.lower().endswith(".txt"):
        text = content.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(400, "Unsupported file type. Use PDF, DOCX, or TXT.")

    if not text.strip():
        raise HTTPException(400, "Could not extract text from the document.")

    # Use GPT-4.1 to structure the document into KB articles
    try:
        completion = await openai_client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": "You are an IT knowledge base manager. Extract and structure IT troubleshooting information from documents into KB articles."},
                {"role": "user", "content": f"""Document: {filename}
Content: {text[:6000]}

Extract 1-5 IT troubleshooting knowledge base articles from this document. Return ONLY valid JSON:
{{
  "articles": [
    {{
      "title": "Article title",
      "content": "Full troubleshooting content with steps",
      "category": "network|software|hardware|access|email|general",
      "tags": ["tag1", "tag2"]
    }}
  ]
}}"""},
            ],
            max_tokens=2000,
        )
        response = completion.choices[0].message.content

        # Parse JSON from response
        json_match = re.search(r"\{.*\}", response, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON found in response")
        parsed = json.loads(json_match.group())
        articles_data = parsed.get("articles", [])
    except Exception:
        # Fallback: create single article from full text
        articles_data = [
            {
                "title": filename.rsplit(".", 1)[0].replace("_", " ").title(),
                "content": text[:3000],
                "category": "general",
                "tags": ["uploaded"],
            }
        ]

    saved = []
    for art in articles_data:
        article_num = await kb_col.count_documents({}) + 1
        article_id = f"KB-{article_num:03d}"
        doc = {
            "article_id": article_id,
            "title": art.get("title", "Uploaded Article"),
            "content": art.get("content", ""),
            "category": art.get("category", "general"),
            "tags": art.get("tags", []),
            "source": filename,
            "created_at": datetime.now(timezone.utc),
        }
        await kb_col.insert_one(doc)
        saved.append({"article_id": article_id, "title": doc["title"]})

    return {"success": True, "articles_created": len(saved), "articles": saved}


@app.get("/api/kb/search")
async def search_kb_api(q: str = ""):
    if not q:
        return []
    result = await handle_search_knowledge_base({"query": q})
    return result


# --- Seeding ---
KB_SEED = [
    {
        "article_id": "KB-001",
        "title": "Cannot Connect to VPN",
        "content": "Symptoms: Unable to connect to company VPN, connection timeout errors.\n\nSolutions:\n1. Check your internet connection is working first\n2. Verify VPN credentials are correct (username/password)\n3. Ensure VPN client is up to date - download from IT portal\n4. Try disconnecting and reconnecting\n5. Disable Windows Firewall temporarily to test\n6. Flush DNS: Run 'ipconfig /flushdns' in Command Prompt\n7. Try connecting from a different network (mobile hotspot)\n8. Reinstall VPN client if issues persist\n\nIf none of these work, contact IT support with your employee ID and error message.",
        "category": "network",
        "tags": ["vpn", "network", "connectivity", "remote access"],
        "source": "preloaded",
    },
    {
        "article_id": "KB-002",
        "title": "Password Reset Procedure",
        "content": "How to reset your corporate password:\n\nSelf-Service Reset:\n1. Go to password reset portal: https://portal.company.com/reset\n2. Enter your employee ID or corporate email\n3. Verify identity via authenticator app or security questions\n4. Set new password (12+ chars, uppercase, lowercase, number, special char)\n5. Update password on all devices\n\nIf locked out:\n1. Call IT Helpdesk: ext. 4357\n2. Provide employee ID and manager's name\n3. Temporary password will be issued\n4. Must change password on first login",
        "category": "access",
        "tags": ["password", "reset", "login", "access", "authentication", "locked out"],
        "source": "preloaded",
    },
    {
        "article_id": "KB-003",
        "title": "Computer Running Slowly",
        "content": "Troubleshooting slow computer performance:\n\nQuick Fixes:\n1. Restart your computer (don't just lock screen)\n2. Check Task Manager (Ctrl+Shift+Esc) for high CPU/RAM usage\n3. Close unused applications and browser tabs\n4. Check disk space - need at least 15% free\n5. Run Disk Cleanup: Start > Disk Cleanup\n6. Clear browser cache and cookies\n\nIf still slow:\n1. Run Windows Update and restart\n2. Scan for malware via IT Endpoint Security\n3. Disable startup programs: Task Manager > Startup tab\n\nHardware issues:\n- If computer is 5+ years old, submit hardware refresh request\n- If fan is very loud, dust cleaning may be needed",
        "category": "software",
        "tags": ["slow", "performance", "computer", "speed", "optimization", "cpu", "memory"],
        "source": "preloaded",
    },
    {
        "article_id": "KB-004",
        "title": "Email Not Working or Not Syncing",
        "content": "Fix email sync and connectivity issues in Outlook:\n\nOutlook Not Opening:\n1. Close all Office applications\n2. Run Quick Repair: Control Panel > Programs > Microsoft Office > Change > Quick Repair\n3. Start Outlook in Safe Mode: Hold Ctrl while clicking Outlook icon\n\nEmail Not Syncing:\n1. Check internet connection\n2. Click Send/Receive All Folders (F9)\n3. Disconnect and reconnect Exchange: File > Account Settings\n4. Check mailbox quota - if over limit, archive old emails\n5. Clear Outlook cache: File > Account Settings > More Settings > Advanced\n\nMobile Email (OWA):\n- Access webmail at: https://mail.company.com\n- Use this as backup when Outlook desktop has issues",
        "category": "email",
        "tags": ["email", "outlook", "exchange", "sync", "microsoft", "not working"],
        "source": "preloaded",
    },
    {
        "article_id": "KB-005",
        "title": "Printer Not Working",
        "content": "Troubleshooting printer connectivity and print issues:\n\nPrinter Offline:\n1. Check printer is powered on and paper is loaded\n2. Windows: Settings > Printers & Scanners > right-click printer > See what's printing\n3. Click Printer menu > Uncheck 'Use Printer Offline'\n4. Clear print queue: delete all pending jobs\n\nCannot Find Printer:\n1. Ensure you're on the office network\n2. Run Add Printer wizard and search for network printers\n3. Install drivers from IT software center\n\nPrint Quality Issues:\n1. Run printer self-test (button on printer)\n2. Clean print heads from printer settings\n3. Replace ink/toner if low",
        "category": "hardware",
        "tags": ["printer", "print", "hardware", "offline", "driver", "queue"],
        "source": "preloaded",
    },
    {
        "article_id": "KB-006",
        "title": "WiFi Connectivity Issues",
        "content": "Fix wireless network connection problems:\n\nCannot Connect to WiFi:\n1. Ensure WiFi is enabled (check hardware switch/keyboard key)\n2. Forget and reconnect: Settings > WiFi > Network > Forget > Reconnect\n3. Use correct network (CorpWiFi for employees, CorpGuest for visitors)\n4. Enter corporate credentials (same as Windows login)\n\nSlow WiFi:\n1. Move closer to access point\n2. Disconnect from low-signal network and reconnect\n3. Connect to 5GHz for speed or 2.4GHz for range\n\nNo WiFi Networks Visible:\n1. Run: netsh wlan show networks in Command Prompt\n2. Disable/Enable network adapter in Device Manager\n3. Update network drivers\n4. Reset network: netsh winsock reset (admin CMD, then restart)",
        "category": "network",
        "tags": ["wifi", "wireless", "network", "connectivity", "internet", "no internet"],
        "source": "preloaded",
    },
    {
        "article_id": "KB-007",
        "title": "Software Installation and License Issues",
        "content": "Process for installing and managing software:\n\nApproved Software:\n1. Open Software Center (search in Start menu)\n2. Browse available applications\n3. Click Install - no approval needed for pre-approved software\n4. Restart if prompted\n\nNon-Standard Software Request:\n1. Submit request via IT Service Portal: https://itportal.company.com\n2. Include: software name, version, business justification\n3. Manager approval required\n4. IT security review: 3-5 business days\n\nLicense Issues:\n1. Check if license is assigned in software portal\n2. Log out and back in to refresh license\n3. Contact IT for additional license allocation",
        "category": "software",
        "tags": ["software", "installation", "application", "license", "install"],
        "source": "preloaded",
    },
    {
        "article_id": "KB-008",
        "title": "Blue Screen of Death (BSOD)",
        "content": "What to do after a Blue Screen of Death:\n\nImmediate Steps:\n1. Note the error code shown (e.g., MEMORY_MANAGEMENT, KERNEL_SECURITY)\n2. Computer will usually restart automatically\n3. If stuck on BSOD: hold power button 10 seconds to force restart\n\nAfter Restarting:\n1. Windows may attempt automatic repair - let it complete\n2. Check for Windows Updates\n3. Run System File Checker: sfc /scannow in Admin Command Prompt\n4. Run Memory Diagnostics: Windows Memory Diagnostic tool\n\nIf BSODs are recurring:\n- Create an IT ticket immediately with the error codes\n- IT will check Windows Event Logs\n- Hardware replacement may be needed",
        "category": "hardware",
        "tags": ["bsod", "blue screen", "crash", "error", "hardware", "memory"],
        "source": "preloaded",
    },
]

TICKET_SEED = [
    {
        "ticket_id": "TKT-001",
        "title": "VPN Connection Timeout",
        "description": "User cannot connect to company VPN from home office. Getting timeout errors after credentials are entered.",
        "priority": "high",
        "category": "network",
        "status": "in_progress",
        "user": "John Smith",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "resolution": None,
    },
    {
        "ticket_id": "TKT-002",
        "title": "Outlook Not Syncing Emails",
        "description": "Corporate email stopped syncing about 2 hours ago. New emails not appearing in inbox.",
        "priority": "medium",
        "category": "email",
        "status": "open",
        "user": "Sarah Connor",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "resolution": None,
    },
    {
        "ticket_id": "TKT-003",
        "title": "Printer Offline - Floor 3",
        "description": "HP LaserJet on Floor 3 showing as offline. Multiple users affected.",
        "priority": "medium",
        "category": "hardware",
        "status": "resolved",
        "user": "Mike Johnson",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "resolution": "Restarted print spooler service and cleared queue. Printer back online.",
    },
]


PRIORITY_INCIDENT_SEED = [
    {
        "incident_id": "INC-0091",
        "priority": "critical",
        "title": "Email service outage — Exchange Online",
        "status": "in_progress",
        "since": "09:14 AM",
        "affected": 142,
        "description": "Exchange Online is experiencing intermittent delivery failures across all regions. Emails delayed by 15-30 min.",
        "active": True,
    },
    {
        "incident_id": "INC-0088",
        "priority": "critical",
        "title": "VPN gateway unreachable — Global Protect",
        "status": "open",
        "since": "08:42 AM",
        "affected": 87,
        "description": "Global Protect VPN cluster not accepting connections. Users unable to access internal resources remotely.",
        "active": True,
    },
    {
        "incident_id": "INC-0085",
        "priority": "high",
        "title": "SSO login failures — PingMFA",
        "status": "in_progress",
        "since": "07:55 AM",
        "affected": 63,
        "description": "Intermittent 503 errors on SSO login via PingMFA. Some users able to authenticate after multiple retries.",
        "active": True,
    },
    {
        "incident_id": "INC-0082",
        "priority": "high",
        "title": "Shared drive latency — Network drives",
        "status": "in_progress",
        "since": "11:30 PM",
        "affected": 34,
        "description": "File operations on network drives are 5-10x slower than normal. Impacting departments on floors 4-6.",
        "active": True,
    },
]


@app.on_event("startup")
async def startup_event():
    # Create text indexes
    try:
        await kb_col.create_index([("title", "text"), ("content", "text"), ("tags", "text")], name="kb_text_index")
        await tickets_col.create_index([("ticket_id", 1)], unique=True, name="ticket_id_unique")
    except Exception:
        pass

    # Seed KB if empty
    kb_count = await kb_col.count_documents({})
    if kb_count == 0:
        for art in KB_SEED:
            art["created_at"] = datetime.now(timezone.utc)
            try:
                await kb_col.insert_one(art.copy())
            except Exception:
                pass

    # Seed Tickets if empty
    ticket_count = await tickets_col.count_documents({})
    if ticket_count == 0:
        for ticket in TICKET_SEED:
            try:
                await tickets_col.insert_one(ticket.copy())
            except Exception:
                pass

    # Seed Priority Incidents — upsert so they always exist
    for inc in PRIORITY_INCIDENT_SEED:
        inc_copy = inc.copy()
        inc_copy["created_at"] = datetime.now(timezone.utc)
        try:
            await priority_incidents_col.update_one(
                {"incident_id": inc_copy["incident_id"]},
                {"$setOnInsert": inc_copy},
                upsert=True,
            )
        except Exception:
            pass


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "IT Service Desk Voice Agent"}
