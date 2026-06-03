import { useState, useEffect } from "react";
import ThoughtInput from "./components/ThoughtInput";
import ChatPanel from "./components/ChatPanel";
import GraphView from "./components/GraphView";
import Analytics from "./components/Analytics";
import ThoughtList from "./components/ThoughtList";
import VideoPanel from "./components/VideoPanel";
import RemindersPanel from "./components/Reminderspanel";
import RoomPanel from "./components/RoomPanel";
import NeuralBackground from "./components/NeuralBackground";
import "./App.css";

const API = "";

export default function App() {
  const [thoughts, setThoughts] = useState([]);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState("thoughts");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeCategory, setActiveCategory] = useState("General");

  useEffect(() => {
    document.body.style.background = darkMode ? "#020d12" : "#e8f4f8";
    document.body.style.color = darkMode ? "#e0f7fa" : "#0f172a";
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const fetchAll = async () => {
    try {
      if (currentRoom) {
        const t = await fetch(`/room/thoughts/${currentRoom}`).then(r => r.json());
        setThoughts(t);
        setGraph({ nodes: [], edges: [] });
        const tagCount = {};
        const emotionCount = {};
        t.forEach(thought => {
          thought.tags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
          });
          emotionCount[thought.emotion] = (emotionCount[thought.emotion] || 0) + 1;
        });
        const topTags = Object.entries(tagCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([tag, count]) => ({ tag, count }));
        setAnalytics({ top_tags: topTags, emotions: emotionCount, total: t.length });
      } else {
        const [t, g, a] = await Promise.all([
          fetch(`/thoughts`).then(r => r.json()),
          fetch(`/graph`).then(r => r.json()),
          fetch(`/analytics`).then(r => r.json()),
        ]);
        setThoughts(t);
        setGraph(g);
        setAnalytics(a);
      }
    } catch (e) {
      console.error("Backend not connected", e);
    }
  };

  useEffect(() => {
    fetchAll();
    Notification.requestPermission();
  }, [currentRoom]);

  const addThought = async (content, source = "text", category = "General") => {
    setLoading(true);
    try {
      if (currentRoom) {
        await fetch(`/room/thoughts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content, source,
            username: currentUser,
            room_code: currentRoom
          })
        });
      } else {
        await fetch(`/thoughts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, source, category })
        });
      }
      await fetchAll();
    } finally {
      setLoading(false);
    }
  };

  const deleteThought = async (id) => {
    if (currentRoom) {
      await fetch(`/room/thoughts/${id}`, { method: "DELETE" });
    } else {
      await fetch(`/thoughts/${id}`, { method: "DELETE" });
    }
    await fetchAll();
  };

  const handleJoinRoom = (username, roomCode) => {
    setCurrentUser(username);
    setCurrentRoom(roomCode);
    setThoughts([]);
    setGraph({ nodes: [], edges: [] });
    setActiveTab("thoughts");
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    setCurrentUser(null);
    setThoughts([]);
    setGraph({ nodes: [], edges: [] });
    setActiveTab("brain");
  };

  const tabs = [
    { id: "thoughts", label: "Thoughts" },
    { id: "videos", label: "Videos" },
    { id: "brain", label: "Brain Map" },
    { id: "chat", label: "Talk to Brain" },
    { id: "analytics", label: "Analytics" },
    ...(!currentRoom ? [{ id: "reminders", label: "Reminders" }] : []),
    { id: "room", label: currentRoom ? `🔴 Room: ${currentRoom.toUpperCase()}` : "Join Room" },
  ];

  return (
    <div className="app">
      <NeuralBackground darkMode={darkMode} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <header className="header">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-icon">⟁</span>
              <div>
                <span className="logo-text">EchoMind</span>
                <span className="logo-sub" style={{ display: "block" }}>
                  {currentRoom ? `Room: ${currentRoom.toUpperCase()} • ${currentUser}` : "Your Second Brain"}
                </span>
              </div>
            </div>
            <div className="stats">
              <span className="stat">{thoughts.length} <small>thoughts</small></span>
              <span className="stat">{graph.edges.length} <small>connections</small></span>
            </div>
            <button
              onClick={() => setDarkMode(d => !d)}
              style={{
                background: darkMode ? "rgba(34,211,238,0.1)" : "rgba(15,23,42,0.1)",
                border: `1px solid ${darkMode ? "rgba(34,211,238,0.3)" : "rgba(15,23,42,0.2)"}`,
                borderRadius: "20px", padding: "0.4rem 1rem",
                color: darkMode ? "#22d3ee" : "#0f172a",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.75rem", cursor: "pointer",
                letterSpacing: "0.1em", transition: "all 0.3s"
              }}
            >
              {darkMode ? "☀ Light" : "🌙 Dark"}
            </button>
          </div>
        </header>

        <main className="main">
          <div className="input-section">
            <ThoughtInput
              onAdd={addThought}
              loading={loading}
              darkMode={darkMode}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              currentRoom={currentRoom}
            />
          </div>

          <nav className="tabs">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
                style={t.id === "room" && currentRoom ? { color: "#f472b6" } : {}}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="panel">
            {activeTab === "brain" && (
              currentRoom ? (
                <div style={{ position: "relative", width: "100%", height: "500px", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: "1rem", left: "1rem", zIndex: 10, background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.3)", borderRadius: "20px", padding: "0.3rem 0.875rem", fontSize: "0.7rem", color: "#f472b6", fontFamily: "'JetBrains Mono', monospace" }}>
                    🔴 {currentRoom.toUpperCase()} — {thoughts.length} thoughts
                  </div>
                  <div style={{ position: "absolute", top: "1rem", right: "1rem", zIndex: 10, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {[...new Set(thoughts.map(t => t.username))].map(username => {
                      const colors = ["#22d3ee","#f472b6","#34d399","#a78bfa","#fb923c","#67e8f9","#4ade80","#e879f9"];
                      let hash = 0;
                      for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
                      const color = colors[Math.abs(hash) % colors.length];
                      return (
                        <div key={username} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(2,13,18,0.8)", borderRadius: "20px", padding: "0.2rem 0.6rem", border: `1px solid ${color}44` }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
                          <span style={{ fontSize: "0.65rem", color, fontFamily: "'JetBrains Mono', monospace" }}>{username}</span>
                        </div>
                      );
                    })}
                  </div>
                  {thoughts.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#164e63", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.85rem" }}>
                      No thoughts in this room yet. Add some above!
                    </div>
                  ) : (() => {
                    const colors = ["#22d3ee","#f472b6","#34d399","#a78bfa","#fb923c","#67e8f9","#4ade80","#e879f9"];
                    const getUserColor = (username) => {
                      let hash = 0;
                      for (let i = 0; i < (username || "").length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
                      return colors[Math.abs(hash) % colors.length];
                    };
                    const total = thoughts.length;
                    const cx = 50, cy = 50, rx = 35, ry = 38;
                    const nodes = thoughts.map((t, i) => {
                      const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
                      return { ...t, x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), color: getUserColor(t.username) };
                    });
                    const edges = [];
                    for (let i = 0; i < nodes.length; i++) {
                      for (let j = i + 1; j < nodes.length; j++) {
                        const sharedTags = nodes[i].tags.filter(tag => nodes[j].tags.includes(tag));
                        if (sharedTags.length > 0) edges.push({ from: i, to: j });
                      }
                    }
                    return (
                      <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
                        <defs>
                          {nodes.map((n, i) => (
                            <radialGradient key={i} id={`rg${i}`} cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor={n.color} stopOpacity="0.8" />
                              <stop offset="100%" stopColor={n.color} stopOpacity="0.2" />
                            </radialGradient>
                          ))}
                        </defs>
                        {edges.map((e, i) => (
                          <line key={i} x1={nodes[e.from].x} y1={nodes[e.from].y} x2={nodes[e.to].x} y2={nodes[e.to].y} stroke={nodes[e.from].color} strokeWidth="0.15" strokeOpacity="0.25" />
                        ))}
                        {nodes.map((n, i) => (
                          <g key={i}>
                            <circle cx={n.x} cy={n.y} r="2.2" fill={n.color} fillOpacity="0.08" />
                            <circle cx={n.x} cy={n.y} r="1.4" fill={`url(#rg${i})`} stroke={n.color} strokeWidth="0.2" strokeOpacity="0.8" />
                            <text x={n.x} y={n.y + 0.45} textAnchor="middle" fontSize="1.2" fill={darkMode ? "#020d12" : "#ffffff"} fontWeight="bold" fontFamily="monospace">
                              {(n.username || "?")[0].toUpperCase()}
                            </text>
                          </g>
                        ))}
                      </svg>
                    );
                  })()}
                </div>
              ) : (
                <GraphView graph={graph} darkMode={darkMode} />
              )
            )}
            {activeTab === "chat" && (
              <ChatPanel api={API} darkMode={darkMode} currentRoom={currentRoom} currentUser={currentUser} />
            )}
            {activeTab === "thoughts" && (
              <ThoughtList
                thoughts={thoughts}
                onDelete={deleteThought}
                onPin={fetchAll}
                api={API}
                darkMode={darkMode}
                currentRoom={currentRoom}
                currentUser={currentUser}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
              />
            )}
            {activeTab === "analytics" && (
              <Analytics
                analytics={analytics}
                darkMode={darkMode}
                currentRoom={currentRoom}
                currentUser={currentUser}
                thoughts={thoughts}
              />
            )}
            {activeTab === "videos" && (
              <VideoPanel darkMode={darkMode} currentRoom={currentRoom} currentUser={currentUser} />
            )}
            {activeTab === "reminders" && <RemindersPanel darkMode={darkMode} />}
            {activeTab === "room" && (
              <RoomPanel
                darkMode={darkMode}
                onJoinRoom={handleJoinRoom}
                onLeaveRoom={handleLeaveRoom}
                currentRoom={currentRoom}
                currentUser={currentUser}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}