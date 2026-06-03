import { useState } from "react";

const EMOTION_COLORS = {
  excited: "#22d3ee", curious: "#67e8f9", stressed: "#f472b6",
  neutral: "#4d8fa0", happy: "#34d399", sad: "#818cf8", confused: "#a78bfa",
};

const USER_COLORS = [
  "#22d3ee", "#f472b6", "#34d399", "#a78bfa",
  "#fb923c", "#67e8f9", "#4ade80", "#e879f9",
];

function getUserColor(username) {
  if (!username) return "#4d8fa0";
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function exportPDF(thoughts) {
  const date = new Date().toLocaleDateString();
  let html = `<html><head><meta charset="UTF-8"><title>EchoMind Brain Export</title>
    <style>body{font-family:'Courier New',monospace;padding:50px;color:#0a2a33;background:#f0fafa;}
    h1{color:#0891b2;border-bottom:2px solid #22d3ee;padding-bottom:12px;}
    .thought{background:#fff;border-left:3px solid #22d3ee;padding:14px 18px;margin-bottom:14px;border-radius:0 8px 8px 0;}
    .pinned{border-left:3px solid #f59e0b;}
    .thought p{margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#0a2a33;}
    .tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}
    .tag{background:rgba(34,211,238,0.1);color:#0891b2;padding:2px 10px;border-radius:10px;font-size:11px;}
    .emotion{font-size:11px;color:#4d8fa0;margin-top:5px;}.date{font-size:11px;color:#aaa;float:right;}
    </style></head><body>
    <h1>EchoMind — Brain Export</h1>
    <div style="color:#4d8fa0;font-size:13px;margin-bottom:35px">Exported on ${date} | ${thoughts.length} thoughts</div>`;
  thoughts.forEach(t => {
    html += `<div class="thought ${t.pinned ? "pinned" : ""}">
      <span class="date">${new Date(t.created_at).toLocaleDateString()}</span>
      ${t.pinned ? '<span style="color:#f59e0b;font-size:11px;">📌 Pinned</span>' : ""}
      ${t.username ? `<span style="font-size:11px;color:#0891b2;">👤 ${t.username}</span>` : ""}
      <p>${t.content}</p>
      <div class="tags">${t.tags.map(tag => `<span class="tag">#${tag}</span>`).join("")}</div>
      <div class="emotion">Emotion: ${t.emotion}</div>
    </div>`;
  });
  html += `</body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  setTimeout(() => w && w.print(), 800);
}

export default function ThoughtList({ thoughts, onDelete, onPin, api, darkMode = true, currentRoom, currentUser, activeCategory = "General", setActiveCategory }) {
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [semanticResults, setSemanticResults] = useState(null);
  const [semanticLoading, setSemanticLoading] = useState(false);

  const c = {
    bg: darkMode ? "rgba(4,24,32,0.8)" : "#f8fafc",
    border: darkMode ? "rgba(34,211,238,0.12)" : "rgba(8,145,178,0.15)",
    text: darkMode ? "#e0f7fa" : "#0f172a",
    dim: darkMode ? "#164e63" : "#64748b",
    cyan: darkMode ? "#22d3ee" : "#0891b2",
    inputBg: darkMode ? "rgba(4,24,32,0.9)" : "#ffffff",
    tagBg: darkMode ? "rgba(34,211,238,0.06)" : "rgba(8,145,178,0.08)",
    dimColor: darkMode ? "#164e63" : "#64748b",
  };
  const handleSemanticSearch = async (query) => {
    setSearch(query);
    if (!query.trim()) {
      setSemanticResults(null);
      return;
    }
    setSemanticLoading(true);
    try {
      const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSemanticResults(data);
    } catch (e) {
      setSemanticResults(null);
    } finally {
      setSemanticLoading(false);
    }
  };
  const allCategories = ["All", ...new Set(thoughts.map(t => t.category || "General"))];

  const filtered = semanticResults
      ? semanticResults
      : thoughts.filter(t => {
          const matchesSearch = !search || t.content.toLowerCase().includes(search.toLowerCase()) ||
            t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase())) ||
            (t.username && t.username.toLowerCase().includes(search.toLowerCase()));
          const matchesCategory = currentRoom || !activeCategory || activeCategory === "All" || t.category === activeCategory;
          return matchesSearch && matchesCategory;
        });

  const pinned = filtered.filter(t => t.pinned);
  const unpinned = filtered.filter(t => !t.pinned);
  const sorted = [...pinned, ...unpinned];

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => { exportPDF(filtered); setExporting(false); }, 300);
  };

  const handlePin = async (id) => {
    try {
      await fetch(`/thoughts/${id}/pin`, { method: "PATCH" });
      if (onPin) onPin();
    } catch (e) {
      console.error("Pin error:", e);
    }
  };

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {currentRoom && (
        <div style={{
          background: darkMode ? "rgba(244,114,182,0.06)" : "rgba(244,114,182,0.05)",
          border: "1px solid rgba(244,114,182,0.25)",
          borderRadius: "8px", padding: "0.6rem 1rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <span style={{ color: "#f472b6", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
            🔴 ROOM: {currentRoom.toUpperCase()}
          </span>
          <span style={{ color: c.dim, fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>
            Showing shared thoughts from all room members
          </span>
        </div>
      )}

      {!currentRoom && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.65rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em" }}>FOLDER:</span>
          {allCategories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              background: activeCategory === cat ? `${c.cyan}22` : "transparent",
              border: `1px solid ${activeCategory === cat ? c.cyan : c.border}`,
              borderRadius: "20px", padding: "0.2rem 0.75rem",
              color: activeCategory === cat ? c.cyan : c.dimColor,
              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem",
              cursor: "pointer", transition: "all 0.2s",
            }}>
              {cat} {cat !== "All" && <span style={{ opacity: 0.6 }}>({thoughts.filter(t => (t.category || "General") === cat).length})</span>}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: c.cyan, fontSize: "0.9rem" }}>⌕</span>
          <input
            value={search}
            onChange={e => handleSemanticSearch(e.target.value)}
            placeholder="Semantic search — find thoughts by meaning..."
            style={{
              width: "100%", background: c.inputBg,
              border: `1px solid ${c.border}`, borderRadius: "8px",
              padding: "0.75rem 1rem 0.75rem 2.5rem",
              color: c.text, fontFamily: "'Exo 2', sans-serif",
              fontSize: "0.9rem", outline: "none", caretColor: c.cyan,
            }}
          />
        </div>
        <button onClick={handleExport} disabled={exporting || !thoughts.length} style={{
          background: thoughts.length ? "linear-gradient(135deg, #0891b2, #22d3ee)" : c.bg,
          border: `1px solid ${thoughts.length ? c.cyan : c.border}`,
          borderRadius: "8px", padding: "0.75rem 1.5rem",
          color: thoughts.length ? (darkMode ? "#020d12" : "#ffffff") : c.dim,
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
          cursor: !thoughts.length ? "not-allowed" : "pointer",
          fontSize: "0.72rem", letterSpacing: "0.12em",
          textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s",
        }}>
          {exporting ? "Exporting..." : search ? `Export (${filtered.length})` : "Export PDF"}
        </button>
      </div>

      {pinned.length > 0 && (
        <p style={{ fontSize: "0.65rem", color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2em" }}>
          📌 PINNED ({pinned.length})
        </p>
      )}

      {search && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.75rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace" }}>
            {semanticLoading ? "Searching..." : `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${search}"`}
          </p>
          {semanticResults && !semanticLoading && (
            <span style={{
              fontSize: "0.65rem", fontFamily: "'JetBrains Mono', monospace",
              background: "rgba(34,211,238,0.1)",
              border: "1px solid rgba(34,211,238,0.3)",
              borderRadius: "20px", padding: "0.15rem 0.6rem",
              color: "#22d3ee",
            }}>
              ✦ semantic
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "420px", overflowY: "auto" }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", color: c.dim, padding: "3rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.9rem" }}>
            {search ? `No thoughts found for "${search}"` : currentRoom ? "No thoughts in this room yet. Add your first thought above!" : activeCategory !== "All" ? `No thoughts in "${activeCategory}" folder yet!` : "No thoughts yet. Add your first thought above!"}
          </div>
        ) : (
          sorted.map(t => {
            const userColor = t.username ? getUserColor(t.username) : c.cyan;
            return (
              <div key={t.id} style={{
                background: t.pinned ? "rgba(245,158,11,0.06)" : c.bg,
                border: `1px solid ${t.pinned ? "rgba(245,158,11,0.35)" : currentRoom ? `${userColor}22` : c.border}`,
                borderLeft: currentRoom ? `3px solid ${userColor}` : `1px solid ${t.pinned ? "rgba(245,158,11,0.35)" : c.border}`,
                borderRadius: "8px", padding: "1rem 1.25rem",
                display: "flex", gap: "1rem", alignItems: "flex-start", transition: "all 0.2s",
              }}>
                <span style={{ fontSize: "1.1rem", opacity: 0.7, color: currentRoom ? userColor : c.cyan }}>
                  {t.source === "voice" ? "🎤" : t.source === "url" ? "🔗" : "📝"}
                </span>
                <div style={{ flex: 1 }}>
                  {currentRoom && t.username && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: userColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.65rem", fontWeight: 700, color: "#020d12",
                        fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
                      }}>
                        {t.username[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: userColor, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                        {t.username} {t.username === currentUser ? "(you)" : ""}
                      </span>
                    </div>
                  )}

                  {t.pinned && (
                    <span style={{ fontSize: "0.65rem", color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", marginBottom: "0.35rem", display: "block" }}>
                      📌 PINNED
                    </span>
                  )}

                  {t.category && t.category !== "General" && (
                    <span style={{
                      fontSize: "0.65rem", color: c.cyan,
                      fontFamily: "'JetBrains Mono', monospace",
                      background: `${c.cyan}11`,
                      border: `1px solid ${c.cyan}33`,
                      borderRadius: "20px", padding: "0.1rem 0.5rem",
                      marginBottom: "0.35rem", display: "inline-block",
                    }}>
                      📁 {t.category}
                    </span>
                  )}

                  <p style={{ fontSize: "0.925rem", lineHeight: 1.65, marginBottom: "0.6rem", color: c.text, fontFamily: "'Exo 2', sans-serif" }}>
                    {t.content}
                  </p>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    {t.tags.map(tag => (
                      <span key={tag} onClick={() => handleSemanticSearch(tag)} style={{
                        background: c.tagBg,
                        border: `1px solid ${darkMode ? "rgba(34,211,238,0.25)" : "rgba(8,145,178,0.25)"}`,
                        borderRadius: "20px", padding: "0.15rem 0.7rem",
                        fontSize: "0.7rem", color: c.cyan,
                        fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", transition: "all 0.2s",
                      }}>#{tag}</span>
                    ))}
                    <span style={{ color: EMOTION_COLORS[t.emotion] || c.dim, fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>
                      ● {t.emotion}
                    </span>
                    <span style={{ color: c.dim, fontSize: "0.7rem", marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace" }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {!currentRoom && (
                    <button onClick={() => handlePin(t.id)} title={t.pinned ? "Unpin" : "Pin"} style={{
                      background: t.pinned ? "rgba(245,158,11,0.15)" : "transparent",
                      border: `1px solid ${t.pinned ? "rgba(245,158,11,0.5)" : "transparent"}`,
                      borderRadius: "6px",
                      color: t.pinned ? "#f59e0b" : c.dim,
                      cursor: "pointer", fontSize: "0.85rem", padding: "0.25rem 0.4rem",
                      opacity: t.pinned ? 1 : 0.4, transition: "all 0.2s", lineHeight: 1,
                    }}
                      onMouseOver={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = "#f59e0b"; }}
                      onMouseOut={e => { e.currentTarget.style.opacity = t.pinned ? 1 : 0.4; e.currentTarget.style.color = t.pinned ? "#f59e0b" : c.dim; }}
                    >📌</button>
                  )}
                  {(!currentRoom || t.username === currentUser) && (
                    <button onClick={() => onDelete(t.id)} style={{
                      background: "transparent", border: "none", color: c.dim,
                      cursor: "pointer", fontSize: "1rem", padding: "0.25rem",
                      opacity: 0.5, transition: "all 0.2s", lineHeight: 1,
                    }}
                      onMouseOver={e => { e.target.style.opacity = 1; e.target.style.color = "#f472b6"; }}
                      onMouseOut={e => { e.target.style.opacity = 0.5; e.target.style.color = c.dim; }}
                    >✕</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}