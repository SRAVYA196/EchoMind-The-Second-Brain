# 🧠 EchoMind — Your AI Second Brain
## Complete Setup Guide for Windows

---

## STEP 1: Get Your FREE Groq API Key
1. Go to https://console.groq.com
2. Sign up with Google (free)
3. Click "API Keys" → "Create API Key"
4. Copy the key (starts with "gsk_...")

---

## STEP 2: Setup Backend

Open Command Prompt or PowerShell in the `backend` folder:

```bash
# Go to backend folder
cd echomind/backend

# Create virtual environment
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn chromadb groq sentence-transformers pydantic requests

# Add your Groq API key
# Open .env file and replace: your_groq_api_key_here
# with your actual key from Step 1

# Start the backend server
set GROQ_API_KEY=your_actual_key_here
uvicorn main:app --reload --port 8000
```

✅ Backend running at: http://localhost:8000

---

## STEP 3: Setup Frontend

Open a NEW Command Prompt in the `frontend` folder:

```bash
# Go to frontend folder
cd echomind/frontend

# Install dependencies
npm install

# Start the frontend
npm run dev
```

✅ Frontend running at: http://localhost:3000

---

## STEP 4: Open EchoMind
Open your browser and go to: **http://localhost:3000**

---

## HOW TO USE

1. **Add Thoughts** — Type any idea/note in the input box → click "Store"
2. **Voice Input** — Click the 🎤 button and speak your thought
3. **Brain Map** — See all your thoughts as an interactive graph
4. **Talk to Brain** — Ask questions about your stored thoughts
5. **Analytics** — See your top obsessions and emotions

---

## DEMO TIPS FOR EXPO

Before the expo, add 15-20 thoughts on different topics like:
- Project ideas you have
- Things you learned recently
- Goals and plans
- Random interesting thoughts

Then show:
1. The live knowledge graph with glowing nodes
2. Ask "What are my most recurring ideas?" in chat
3. Show the analytics tab with emotion breakdown
4. Add a voice note live on stage

---

## PROJECT STRUCTURE
```
echomind/
├── backend/
│   ├── main.py          ← FastAPI server
│   ├── requirements.txt
│   ├── .env             ← Put your API key here
│   ├── echomind.db      ← SQLite database (auto-created)
│   └── chroma_db/       ← Vector store (auto-created)
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   └── components/
    │       ├── ThoughtInput.jsx
    │       ├── ChatPanel.jsx
    │       ├── GraphView.jsx
    │       ├── ThoughtList.jsx
    │       └── Analytics.jsx
    ├── index.html
    └── package.json
```

---

## FREE TOOLS USED (Zero Cost)
- Groq API — Free LLM (Llama 3 70B)
- ChromaDB — Local vector database
- Sentence Transformers — Local embeddings
- SQLite — Local database
- React + Vite — Frontend
- FastAPI — Backend
