from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import chromadb
from chromadb.utils import embedding_functions
import sqlite3
import json
import datetime
import os
import threading
import base64 as b64lib
import subprocess
import tempfile
import traceback
from fastapi.staticfiles import StaticFiles
from groq import Groq

app = FastAPI(title="EchoMind API")
VIDEOS_DIR = "./videos"
os.makedirs(VIDEOS_DIR, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

chroma_client = chromadb.PersistentClient(path="./chroma_db")
embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
collection = chroma_client.get_or_create_collection("echomind", embedding_function=embed_fn)

def get_db():
    conn = sqlite3.connect("echomind.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS thoughts (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            source TEXT DEFAULT 'text',
            tags TEXT DEFAULT '[]',
            emotion TEXT DEFAULT 'neutral',
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            fire_at TEXT NOT NULL,
            done INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            recurring INTEGER DEFAULT 0,
            interval_seconds INTEGER DEFAULT 0
        )
    """)
    try:
        conn.execute("ALTER TABLE thoughts ADD COLUMN pinned INTEGER DEFAULT 0")
    except:
        pass
    try:
        conn.execute("ALTER TABLE thoughts ADD COLUMN category TEXT DEFAULT 'General'")
    except:
        pass
    try:
        conn.execute("ALTER TABLE reminders ADD COLUMN recurring INTEGER DEFAULT 0")
    except:
        pass
    try:
        conn.execute("ALTER TABLE reminders ADD COLUMN interval_seconds INTEGER DEFAULT 0")
    except:
        pass
    conn.commit()
    conn.close()

init_db()

@app.on_event("startup")
async def warmup():
    print("Warming up EchoMind... please wait...")
    try:
        embed_fn(["warmup sentence one", "warmup sentence two", "warmup sentence three"])
        groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=1
        )
        print("EchoMind warmup complete! Ready to use.")
    except Exception as e:
        print(f"Warmup note: {e}")

# ── Check if ffmpeg is installed at startup ─────────────────────────
def check_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False

FFMPEG_AVAILABLE = check_ffmpeg()
print(f"[Startup] ffmpeg available: {FFMPEG_AVAILABLE}")
if not FFMPEG_AVAILABLE:
    print("[Startup] WARNING: ffmpeg not found. Install it for transcription to work.")
    print("[Startup] Windows: winget install ffmpeg")
    print("[Startup] Mac:     brew install ffmpeg")
    print("[Startup] Linux:   sudo apt install ffmpeg")


# --- Models ---
class ThoughtInput(BaseModel):
    content: str
    source: Optional[str] = "text"
    category: Optional[str] = "General"

class ChatInput(BaseModel):
    message: str

class ReminderCreate(BaseModel):
    content: str
    total_seconds: int
    recurring: Optional[bool] = False
    interval_seconds: Optional[int] = 0

class PDFInput(BaseModel):
    filename: str
    base64: str

class VideoSaveInput(BaseModel):
    video_base64: str
    snapshot_base64: str
    filename: str
    transcript: Optional[str] = ""
    emotion: Optional[str] = "neutral"
    summary: Optional[str] = "Video recording"

class TextAnalysisInput(BaseModel):
    text: str

class AudioTranscribeInput(BaseModel):
    audio_base64: str


# --- Helpers ---
def extract_tags_emotion(content: str):
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": f'''Analyze this thought and return ONLY a JSON object with:
- "tags": list of 2-4 topic keywords
- "emotion": one word (excited/curious/stressed/neutral/happy/sad/confused)

Thought: "{content}"

Return ONLY valid JSON, nothing else.'''}],
            max_tokens=100
        )
        raw = response.choices[0].message.content.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end != 0:
            return json.loads(raw[start:end])
    except:
        pass
    return {"tags": ["general"], "emotion": "neutral"}


# --- Thoughts ---
@app.post("/thoughts")
async def add_thought(thought: ThoughtInput):
    import uuid
    thought_id = str(uuid.uuid4())
    created_at = datetime.datetime.now().isoformat()
    meta = extract_tags_emotion(thought.content)
    tags = meta.get("tags", ["general"])
    emotion = meta.get("emotion", "neutral")
    collection.add(documents=[thought.content], ids=[thought_id],
        metadatas=[{"source": thought.source, "tags": json.dumps(tags), "emotion": emotion, "created_at": created_at}])
    conn = get_db()
    conn.execute("INSERT INTO thoughts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    (thought_id, thought.content, thought.source, json.dumps(tags), emotion, created_at, 0, thought.category))
    conn.commit()
    conn.close()
    return {"id": thought_id, "tags": tags, "emotion": emotion, "created_at": created_at}

@app.get("/thoughts")
async def get_thoughts():
    conn = get_db()
    rows = conn.execute("SELECT * FROM thoughts ORDER BY pinned DESC, created_at DESC").fetchall()
    conn.close()
    return [{"id": r["id"], "content": r["content"], "source": r["source"], "tags": json.loads(r["tags"]), "emotion": r["emotion"], "created_at": r["created_at"], "pinned": bool(r["pinned"]), "category": r["category"] if r["category"] else "General"} for r in rows]

@app.get("/graph")
async def get_graph():
    conn = get_db()
    rows = conn.execute("SELECT * FROM thoughts ORDER BY created_at DESC LIMIT 50").fetchall()
    conn.close()
    nodes = []
    edges = []
    tag_map = {}
    for row in rows:
        tags = json.loads(row["tags"])
        nodes.append({"id": row["id"], "label": row["content"], "tags": tags, "emotion": row["emotion"], "created_at": row["created_at"]})
        for tag in tags:
            if tag not in tag_map:
                tag_map[tag] = []
            tag_map[tag].append(row["id"])
    for tag, ids in tag_map.items():
        for i in range(len(ids)):
            for j in range(i+1, len(ids)):
                edges.append({"source": ids[i], "target": ids[j], "tag": tag})
    return {"nodes": nodes, "edges": edges}

@app.post("/chat")
async def chat_with_brain(chat: ChatInput):
    # Get recent thoughts from SQLite (always up to date)
    conn = get_db()
    rows = conn.execute("SELECT content, emotion FROM thoughts ORDER BY created_at DESC").fetchall()
    conn.close()
    
    context_docs = [r["content"] for r in rows]
    context = "\n".join([f"- {doc} (emotion: {rows[i]['emotion']})" for i, doc in enumerate(context_docs)])
    
    if not context:
        return {"response": "Your brain is empty! Add some thoughts first.", "sources": [], "connections": [], "extended_idea": None}
    
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are EchoMind, the user's second brain. You have access to ALL of the user's thoughts. Answer questions by searching through ALL thoughts, not just recent ones. When asked about emotions like 'happiest', 'saddest', find thoughts with matching emotions."},
            {"role": "user", "content": f"Based on my thoughts (newest first):\n{context}\n\nAnswer: {chat.message}"}
        ],
        max_tokens=500
    )
    answer = response.choices[0].message.content
    extended_idea = None
    try:
        exploratory_keywords = ["explore", "idea", "suggest", "improve", "what if", "how can", "connect", "pattern", "insight", "think", "creative", "expand"]
        should_extend = any(keyword in chat.message.lower() for keyword in exploratory_keywords)
        if should_extend:
            ext_response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": f"""Based on these thoughts, suggest ONE powerful extended idea.
Thoughts:\n{context}\nQuestion asked: {chat.message}
Return ONLY this JSON:
{{"title": "Short catchy title","idea": "2-3 sentences","action": "One specific action"}}"""}],
                max_tokens=300
            )
            raw = ext_response.choices[0].message.content.strip()
            s = raw.find("{"); e = raw.rfind("}") + 1
            if s != -1: extended_idea = json.loads(raw[s:e])
    except:
        extended_idea = None
    return {"response": answer, "sources": context_docs, "connections": [], "extended_idea": extended_idea}

@app.get("/analytics")
async def get_analytics():
    conn = get_db()
    rows = conn.execute("SELECT * FROM thoughts ORDER BY created_at DESC").fetchall()
    conn.close()
    if not rows:
        return {"top_tags": [], "emotions": {}, "total": 0}
    tag_count = {}; emotion_count = {}
    for row in rows:
        for tag in json.loads(row["tags"]):
            tag_count[tag] = tag_count.get(tag, 0) + 1
        emotion_count[row["emotion"]] = emotion_count.get(row["emotion"], 0) + 1
    top_tags = sorted(tag_count.items(), key=lambda x: x[1], reverse=True)[:8]
    return {"top_tags": [{"tag": t, "count": c} for t, c in top_tags], "emotions": emotion_count, "total": len(rows)}

@app.get("/search")
async def semantic_search(q: str):
    if not q.strip():
        return []
    try:
        results = collection.query(
            query_texts=[q],
            n_results=min(10, collection.count())
        )
        if not results["ids"] or not results["ids"][0]:
            return []
        ids = results["ids"][0]
        conn = get_db()
        placeholders = ",".join(["?" for _ in ids])
        rows = conn.execute(
            f"SELECT * FROM thoughts WHERE id IN ({placeholders})",
            ids
        ).fetchall()
        conn.close()
        id_order = {id_: i for i, id_ in enumerate(ids)}
        sorted_rows = sorted(rows, key=lambda r: id_order.get(r["id"], 999))
        return [
            {
                "id": r["id"],
                "content": r["content"],
                "source": r["source"],
                "tags": json.loads(r["tags"]),
                "emotion": r["emotion"],
                "created_at": r["created_at"],
                "pinned": bool(r["pinned"]),
                "category": r["category"] if r["category"] else "General"
            }
            for r in sorted_rows
        ]
    except Exception as e:
        print(f"Search error: {e}")
        return []

@app.get("/mood-timeline")
async def get_mood_timeline():
    conn = get_db()
    rows = conn.execute("SELECT emotion, created_at FROM thoughts ORDER BY created_at ASC").fetchall()
    conn.close()
    timeline = {}
    for row in rows:
        date = row["created_at"][:10]
        if date not in timeline: timeline[date] = {}
        emotion = row["emotion"]
        timeline[date][emotion] = timeline[date].get(emotion, 0) + 1
    result = []
    for date, emotions in sorted(timeline.items()):
        dominant = max(emotions, key=emotions.get)
        result.append({"date": date, "emotions": emotions, "dominant": dominant, "total": sum(emotions.values())})
    return result

@app.get("/brain-summary")
async def get_brain_summary():
    conn = get_db()
    rows = conn.execute("SELECT content, emotion, tags FROM thoughts ORDER BY created_at DESC LIMIT 20").fetchall()
    conn.close()
    if not rows:
        return {"summary": "Your brain is empty! Add some thoughts first.", "insights": [], "encouragement": ""}
    thoughts_text = "\n".join([f"- {row['content']} (emotion: {row['emotion']})" for row in rows])
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"""Analyze this thought journal and return ONLY JSON:
{{"summary": "warm 3-4 sentence insight","insights": ["insight 1","insight 2","insight 3"],"encouragement": "one encouraging message"}}
Thoughts:\n{thoughts_text}"""}],
        max_tokens=500
    )
    raw = response.choices[0].message.content.strip()
    s = raw.find("{"); e = raw.rfind("}") + 1
    if s != -1:
        try: return json.loads(raw[s:e])
        except: pass
    return {"summary": raw, "insights": [], "encouragement": "Keep thinking and growing!"}

@app.delete("/thoughts/{thought_id}")
async def delete_thought(thought_id: str):
    conn = get_db()
    conn.execute("DELETE FROM thoughts WHERE id = ?", (thought_id,))
    conn.commit(); conn.close()
    try: collection.delete(ids=[thought_id])
    except: pass
    return {"success": True}

@app.patch("/thoughts/{thought_id}/pin")
async def pin_thought(thought_id: str):
    conn = get_db()
    row = conn.execute("SELECT pinned FROM thoughts WHERE id = ?", (thought_id,)).fetchone()
    if not row: raise HTTPException(status_code=404, detail="Not found")
    new_pinned = 0 if row["pinned"] else 1
    conn.execute("UPDATE thoughts SET pinned = ? WHERE id = ?", (new_pinned, thought_id))
    conn.commit(); conn.close()
    return {"pinned": bool(new_pinned)}

def init_videos_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            emotion TEXT DEFAULT 'neutral',
            summary TEXT DEFAULT '',
            transcript TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
    """)
    try: conn.execute("ALTER TABLE videos ADD COLUMN transcript TEXT DEFAULT ''")
    except: pass
    conn.commit(); conn.close()

init_videos_db()

@app.post("/analyze-text")
async def analyze_text(data: TextAnalysisInput):
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": f'''Analyze this text and return ONLY a valid JSON object:
- "emotion": one word from: excited, curious, stressed, neutral, happy, sad, confused
- "summary": one short sentence summarizing the main idea
Text: "{data.text}"
Return ONLY the JSON object.'''}],
            max_tokens=80
        )
        raw = response.choices[0].message.content.strip()
        s = raw.find("{"); e = raw.rfind("}") + 1
        if s != -1 and e != 0:
            result = json.loads(raw[s:e])
            return {"emotion": result.get("emotion", "neutral"), "summary": result.get("summary", data.text[:80])}
    except Exception as e:
        print(f"Analyze text error: {e}")
    return {"emotion": "neutral", "summary": data.text[:80]}


# ══════════════════════════════════════════════════════════════════
# FIXED /transcribe ROUTE
# Root cause: Browser records video/webm (has video+audio together).
# Old code just renamed .webm → .mp4 which does NOT convert the file.
# Groq Whisper rejects video files — it needs pure audio only.
# Fix: Use ffmpeg to strip the video track and extract WAV audio first.
# ══════════════════════════════════════════════════════════════════
@app.post("/transcribe")
async def transcribe_audio(data: AudioTranscribeInput):
    tmp_input  = None
    tmp_output = None

    try:
        # Step 1: Decode base64 → raw video bytes
        try:
            video_bytes = b64lib.b64decode(data.audio_base64)
        except Exception as e:
            print(f"[Transcribe] Base64 decode error: {e}")
            return {"transcript": "", "error": "Invalid base64 data"}

        print(f"[Transcribe] Received {len(video_bytes):,} bytes")

        # Step 2: Extract pure audio using ffmpeg
        if FFMPEG_AVAILABLE:
            try:
                # Save webm to temp file
                with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                    f.write(video_bytes)
                    tmp_input = f.name

                tmp_output = tmp_input.replace(".webm", ".wav")

                # Extract audio: strip video, output WAV 16kHz mono
                result = subprocess.run(
                    [
                        "ffmpeg", "-y",
                        "-i", tmp_input,
                        "-vn",                   # no video track
                        "-acodec", "pcm_s16le",  # WAV format
                        "-ar", "16000",          # 16kHz sample rate (Groq Whisper prefers this)
                        "-ac", "1",              # mono
                        tmp_output
                    ],
                    capture_output=True,
                    timeout=60
                )

                if result.returncode != 0:
                    ffmpeg_err = result.stderr.decode("utf-8", errors="replace")
                    print(f"[Transcribe] ffmpeg failed: {ffmpeg_err[:300]}")
                    # Fallback: try sending raw webm directly
                    audio_path = tmp_input
                    audio_ext  = "webm"
                else:
                    print(f"[Transcribe] ffmpeg extracted audio OK → WAV")
                    audio_path = tmp_output
                    audio_ext  = "wav"

            except Exception as ffmpeg_exc:
                print(f"[Transcribe] ffmpeg exception: {ffmpeg_exc}")
                audio_path = tmp_input
                audio_ext  = "webm"
        else:
            # ffmpeg not installed — save raw bytes and try directly
            print("[Transcribe] ffmpeg not available, trying raw webm")
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                f.write(video_bytes)
                tmp_input = f.name
            audio_path = tmp_input
            audio_ext  = "webm"

        # Step 3: Send extracted audio to Groq Whisper
        try:
            with open(audio_path, "rb") as f:
                transcription = groq_client.audio.transcriptions.create(
                    file=(f"audio.{audio_ext}", f),
                    model="whisper-large-v3",
                )
            transcript = transcription.text.strip() if transcription.text else ""
            print(f"[Transcribe] ✓ Success: '{transcript[:100]}'")
            return {"transcript": transcript}

        except Exception as groq_err:
            print(f"[Transcribe] Groq Whisper error: {groq_err}")
            return {"transcript": "", "error": str(groq_err)}

    except Exception as e:
        # Always return valid JSON — never empty response
        print(f"[Transcribe] Unexpected error:\n{traceback.format_exc()}")
        return {"transcript": "", "error": str(e)}

    finally:
        # Clean up all temp files
        for path in [tmp_input, tmp_output]:
            if path and os.path.exists(path):
                try: os.remove(path)
                except: pass


# ══════════════════════════════════════════════════════════════════

@app.post("/save-video")
async def save_video(data: VideoSaveInput):
    import uuid
    video_id = str(uuid.uuid4())
    created_at = datetime.datetime.now().isoformat()
    filename = f"{video_id}.webm"
    filepath = os.path.join(VIDEOS_DIR, filename)
    video_bytes = b64lib.b64decode(data.video_base64)
    with open(filepath, "wb") as f:
        f.write(video_bytes)
    conn = get_db()
    conn.execute("INSERT INTO videos VALUES (?, ?, ?, ?, ?, ?)",
        (video_id, filename, data.emotion or "neutral", data.summary or "Video recording", data.transcript or "", created_at))
    conn.commit(); conn.close()
    return {"id": video_id, "filename": filename, "emotion": data.emotion, "summary": data.summary, "created_at": created_at}

@app.get("/get-videos")
async def get_videos():
    conn = get_db()
    rows = conn.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
    conn.close()
    return [{"id": r["id"], "filename": r["filename"], "emotion": r["emotion"], "summary": r["summary"], "transcript": r["transcript"] if r["transcript"] else "", "created_at": r["created_at"]} for r in rows]

@app.delete("/delete-video/{video_id}")
async def delete_video(video_id: str):
    conn = get_db()
    row = conn.execute("SELECT filename FROM videos WHERE id = ?", (video_id,)).fetchone()
    if row:
        filepath = os.path.join(VIDEOS_DIR, row["filename"])
        if os.path.exists(filepath): os.remove(filepath)
        conn.execute("DELETE FROM videos WHERE id = ?", (video_id,))
        conn.commit()
    conn.close()
    return {"success": True}

# --- Reminders ---
@app.post("/reminders")
async def create_reminder(data: ReminderCreate):
    import uuid
    reminder_id = str(uuid.uuid4())
    created_at = datetime.datetime.now().isoformat()
    fire_at = (datetime.datetime.now() + datetime.timedelta(seconds=data.total_seconds)).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO reminders VALUES (?, ?, ?, 0, ?, ?, ?)",
        (reminder_id, data.content, fire_at, created_at,
         1 if data.recurring else 0, data.interval_seconds or data.total_seconds)
    )
    conn.commit(); conn.close()

    def fire_reminder():
        import time
        while True:
            time.sleep(data.total_seconds)
            c = get_db()
            if data.recurring:
                next_fire = (datetime.datetime.now() + datetime.timedelta(seconds=data.interval_seconds or data.total_seconds)).isoformat()
                c.execute("UPDATE reminders SET fire_at = ? WHERE id = ?", (next_fire, reminder_id))
                c.commit(); c.close()
                data.total_seconds = data.interval_seconds or data.total_seconds
            else:
                c.execute("UPDATE reminders SET done = 1 WHERE id = ?", (reminder_id,))
                c.commit(); c.close()
                break

    threading.Thread(target=fire_reminder, daemon=True).start()
    return {"id": reminder_id, "content": data.content, "fire_at": fire_at,
            "done": False, "created_at": created_at, "recurring": data.recurring}

@app.get("/reminders")
async def get_reminders():
    conn = get_db()
    rows = conn.execute("SELECT * FROM reminders ORDER BY fire_at ASC").fetchall()
    conn.close()
    return [{"id": r["id"], "content": r["content"], "fire_at": r["fire_at"],
         "done": bool(r["done"]), "created_at": r["created_at"],
         "recurring": bool(r["recurring"]),
         "interval_seconds": r["interval_seconds"]} for r in rows]

@app.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str):
    conn = get_db()
    conn.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
    conn.commit(); conn.close()
    return {"success": True}

# --- Room Models ---
class RoomThoughtInput(BaseModel):
    content: str
    source: Optional[str] = "text"
    username: str
    room_code: str

class RoomChatInput(BaseModel):
    message: str
    room_code: str

class RoomVideoSaveInput(BaseModel):
    video_base64: str
    snapshot_base64: str
    filename: str
    transcript: Optional[str] = ""
    emotion: Optional[str] = "neutral"
    summary: Optional[str] = "Video recording"
    username: str
    room_code: str

def init_room_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS room_thoughts (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            source TEXT DEFAULT 'text',
            tags TEXT DEFAULT '[]',
            emotion TEXT DEFAULT 'neutral',
            created_at TEXT NOT NULL,
            username TEXT NOT NULL,
            room_code TEXT NOT NULL,
            pinned INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS room_videos (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            emotion TEXT DEFAULT 'neutral',
            summary TEXT DEFAULT '',
            transcript TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            username TEXT NOT NULL,
            room_code TEXT NOT NULL
        )
    """)
    conn.commit(); conn.close()

init_room_db()

@app.post("/room/thoughts")
async def add_room_thought(thought: RoomThoughtInput):
    import uuid
    thought_id = str(uuid.uuid4())
    created_at = datetime.datetime.now().isoformat()
    meta = extract_tags_emotion(thought.content)
    tags = meta.get("tags", ["general"])
    emotion = meta.get("emotion", "neutral")
    conn = get_db()
    conn.execute(
        "INSERT INTO room_thoughts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (thought_id, thought.content, thought.source, json.dumps(tags),
         emotion, created_at, thought.username, thought.room_code, 0)
    )
    conn.commit(); conn.close()
    return {"id": thought_id, "tags": tags, "emotion": emotion,
            "created_at": created_at, "username": thought.username}

@app.get("/room/thoughts/{room_code}")
async def get_room_thoughts(room_code: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM room_thoughts WHERE room_code = ? ORDER BY pinned DESC, created_at DESC",
        (room_code,)
    ).fetchall()
    conn.close()
    return [{"id": r["id"], "content": r["content"], "source": r["source"],
             "tags": json.loads(r["tags"]), "emotion": r["emotion"],
             "created_at": r["created_at"], "username": r["username"],
             "pinned": bool(r["pinned"])} for r in rows]

@app.delete("/room/thoughts/{thought_id}")
async def delete_room_thought(thought_id: str):
    conn = get_db()
    conn.execute("DELETE FROM room_thoughts WHERE id = ?", (thought_id,))
    conn.commit(); conn.close()
    return {"success": True}

@app.post("/room/chat")
async def room_chat(chat: RoomChatInput):
    conn = get_db()
    rows = conn.execute(
        "SELECT content, username FROM room_thoughts WHERE room_code = ? ORDER BY created_at DESC LIMIT 20",
        (chat.room_code,)
    ).fetchall()
    conn.close()
    if not rows:
        return {"response": "This room has no thoughts yet!", "connections": [], "extended_idea": None}
    context = "\n".join([f"- [{r['username']}]: {r['content']}" for r in rows])
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are EchoMind, a shared second brain for a group."},
            {"role": "user", "content": f"Based on our shared thoughts:\n{context}\n\nAnswer: {chat.message}"}
        ],
        max_tokens=500
    )
    answer = response.choices[0].message.content
    extended_idea = None
    try:
        ext_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": f"""Based on these shared thoughts, suggest ONE powerful extended idea.
Thoughts:\n{context}\nQuestion: {chat.message}
Return ONLY this JSON:
{{"title": "Short catchy title","idea": "2-3 sentences","action": "One specific action"}}"""}],
            max_tokens=300
        )
        raw = ext_response.choices[0].message.content.strip()
        s = raw.find("{"); e = raw.rfind("}") + 1
        if s != -1: extended_idea = json.loads(raw[s:e])
    except:
        extended_idea = None
    return {"response": answer, "extended_idea": extended_idea}

@app.post("/room/save-video")
async def save_room_video(data: RoomVideoSaveInput):
    import uuid
    video_id = str(uuid.uuid4())
    created_at = datetime.datetime.now().isoformat()
    filename = f"{video_id}.webm"
    filepath = os.path.join(VIDEOS_DIR, filename)
    video_bytes = b64lib.b64decode(data.video_base64)
    with open(filepath, "wb") as f:
        f.write(video_bytes)
    conn = get_db()
    conn.execute(
        "INSERT INTO room_videos VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (video_id, filename, data.emotion or "neutral",
         data.summary or "Video recording", data.transcript or "",
         created_at, data.username, data.room_code)
    )
    conn.commit(); conn.close()
    return {"id": video_id, "filename": filename, "emotion": data.emotion,
            "summary": data.summary, "created_at": created_at, "username": data.username}

@app.get("/room/videos/{room_code}")
async def get_room_videos(room_code: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM room_videos WHERE room_code = ? ORDER BY created_at DESC",
        (room_code,)
    ).fetchall()
    conn.close()
    return [{"id": r["id"], "filename": r["filename"], "emotion": r["emotion"],
             "summary": r["summary"], "transcript": r["transcript"] or "",
             "created_at": r["created_at"], "username": r["username"]} for r in rows]

@app.delete("/room/videos/{video_id}")
async def delete_room_video(video_id: str):
    conn = get_db()
    row = conn.execute("SELECT filename FROM room_videos WHERE id = ?", (video_id,)).fetchone()
    if row:
        filepath = os.path.join(VIDEOS_DIR, row["filename"])
        if os.path.exists(filepath): os.remove(filepath)
        conn.execute("DELETE FROM room_videos WHERE id = ?", (video_id,))
        conn.commit()
    conn.close()
    return {"success": True}

@app.get("/categories")
async def get_categories():
    conn = get_db()
    rows = conn.execute("SELECT DISTINCT category FROM thoughts WHERE category IS NOT NULL").fetchall()
    conn.close()
    cats = [r["category"] for r in rows if r["category"]]
    if "General" not in cats:
        cats.insert(0, "General")
    return cats

app.mount("/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")