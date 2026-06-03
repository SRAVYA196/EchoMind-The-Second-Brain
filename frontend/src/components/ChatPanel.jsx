import { useState, useRef, useEffect } from "react";

function TypingDots({ darkMode }) {
  return (
    <div style={{ display: "flex", gap: "5px", alignItems: "center", padding: "4px 0" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: darkMode ? "#22d3ee" : "#0891b2",
          animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
        }} />
      ))}
    </div>
  );
}

export default function ChatPanel({ api, darkMode = true, currentRoom, currentUser }) {
  const c = {
    bg: darkMode ? "rgba(4,24,32,0.8)" : "rgba(255,255,255,0.95)",
    msgBg: darkMode ? "rgba(4,24,32,0.9)" : "#f8fafc",
    border: darkMode ? "rgba(34,211,238,0.1)" : "rgba(8,145,178,0.15)",
    text: darkMode ? "#e0f7fa" : "#0f172a",
    dim: darkMode ? "#164e63" : "#64748b",
    cyan: darkMode ? "#22d3ee" : "#0891b2",
    inputBg: darkMode ? "rgba(2,13,18,0.8)" : "#f1f5f9",
    suggBg: darkMode ? "rgba(34,211,238,0.04)" : "rgba(8,145,178,0.05)",
    panelBg: darkMode ? "transparent" : "#ffffff",
  };

  const btnBase = {
    borderRadius: "24px",
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    transition: "all 0.2s",
    background: "transparent",
    whiteSpace: "nowrap",
  };

  const getWelcome = () => {
    if (currentRoom) {
      return `Room brain online! I am the shared EchoMind for room "${currentRoom.toUpperCase()}". Ask me anything about the thoughts stored in this room!`;
    }
    return "Neural interface online. I am your EchoMind — your second brain. Ask me anything about your stored thoughts, ideas, and connections. What would you like to explore?";
  };

  const [messages, setMessages] = useState([{
    role: "brain",
    text: getWelcome(),
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    setMessages([{
      role: "brain",
      text: getWelcome(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
  }, [currentRoom]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg, time }]);
    setLoading(true);
    try {
      const endpoint = currentRoom ? `${api}/room/chat` : `${api}/chat`;
      const body = currentRoom
        ? { message: userMsg, room_code: currentRoom }
        : { message: userMsg };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const brainTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages(m => [...m, {
        role: "brain", text: data.response, time: brainTime,
        extended_idea: data.extended_idea || null,
      }]);
    } catch {
      setMessages(m => [...m, { role: "brain", text: "❌ Connection error", time: "" }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = currentRoom ? [
    "What are our most recurring ideas?",
    "Connect our thoughts for me",
    "What has the team been thinking?",
    "What ideas should we explore more?",
  ] : [
    "What are my most recurring ideas?",
    "Connect my thoughts for me",
    "What have I been thinking lately?",
    "What ideas should I explore more?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "620px" }}>

      {/* Header */}
      <div style={{ padding: "1rem 1.75rem", borderBottom: `1px solid ${c.border}`, background: c.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #0891b2, #22d3ee)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>⟁</div>
          <div>
            <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: "1rem", fontWeight: 700, color: c.text }}>
              {currentRoom ? `Room: ${currentRoom.toUpperCase()}` : "EchoMind"}
            </p>
            <p style={{ fontSize: "0.65rem", color: c.cyan, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: currentRoom ? "#f472b6" : c.cyan, marginRight: 5 }}></span>
              {loading ? "processing..." : currentRoom ? `shared brain • ${currentUser}` : "online"}
            </p>
          </div>
        </div>
        <div style={{ fontSize: "0.65rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace" }}>
          {messages.length - 1} exchanges
        </div>
      </div>

      {currentRoom && (
        <div style={{
          padding: "0.5rem 1.75rem",
          background: darkMode ? "rgba(244,114,182,0.06)" : "rgba(244,114,182,0.04)",
          borderBottom: "1px solid rgba(244,114,182,0.15)",
          fontSize: "0.7rem", color: "#f472b6",
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em",
        }}>
          🔴 Chatting with room brain — based on all members' thoughts
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem", background: c.panelBg }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "brain" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #0891b2, #22d3ee)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", marginRight: "0.75rem", flexShrink: 0, alignSelf: "flex-end" }}>⟁</div>
              )}
              <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  padding: "1rem 1.25rem",
                  background: m.role === "user" ? "linear-gradient(135deg, #0891b2, #22d3ee)" : c.msgBg,
                  border: m.role === "brain" ? `1px solid ${c.border}` : "none",
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  color: m.role === "user" ? "#ffffff" : c.text,
                  fontSize: "0.925rem", lineHeight: 1.75, fontFamily: "'Exo 2', sans-serif",
                }}>
                  {m.text}
                </div>
                {m.time && (
                  <span style={{ fontSize: "0.65rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace" }}>
                    {m.time}
                  </span>
                )}
              </div>
              {m.role === "user" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: darkMode ? "rgba(34,211,238,0.1)" : "rgba(8,145,178,0.1)", border: `1px solid ${darkMode ? "rgba(34,211,238,0.3)" : "rgba(8,145,178,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", marginLeft: "0.75rem", flexShrink: 0, alignSelf: "flex-end" }}>👤</div>
              )}
            </div>

            {m.role === "brain" && m.extended_idea && (
              <div style={{ marginLeft: "3rem", background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: "10px", padding: "1rem 1.25rem" }}>
                <p style={{ fontSize: "0.65rem", color: "#34d399", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: "0.6rem" }}>💡 UPGRADED IDEA:</p>
                <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#34d399", fontFamily: "'Exo 2', sans-serif", marginBottom: "0.5rem" }}>{m.extended_idea.title}</p>
                <p style={{ fontSize: "0.85rem", color: c.text, fontFamily: "'Exo 2', sans-serif", lineHeight: 1.7, marginBottom: "0.75rem" }}>{m.extended_idea.idea}</p>
                <div style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "6px", padding: "0.6rem 0.875rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ color: "#34d399", fontSize: "0.8rem" }}>▶</span>
                  <p style={{ fontSize: "0.8rem", color: "#34d399", fontFamily: "'JetBrains Mono', monospace" }}>{m.extended_idea.action}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #0891b2, #22d3ee)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>⟁</div>
            <div style={{ padding: "1rem 1.25rem", background: c.msgBg, border: `1px solid ${c.border}`, borderRadius: "16px 16px 16px 4px" }}>
              <TypingDots darkMode={darkMode} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div style={{ padding: "0 1.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", background: c.panelBg }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setInput(s)} style={{
              background: "transparent", border: `1px solid ${c.border}`,
              borderRadius: "20px", padding: "0.45rem 1rem",
              color: c.dim, cursor: "pointer",
              fontSize: "0.8rem", fontFamily: "'Exo 2', sans-serif", transition: "all 0.2s",
            }}>{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "1rem 1.75rem", borderTop: `1px solid ${c.border}`, background: c.bg, display: "flex", gap: "0.875rem", alignItems: "center" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={currentRoom ? "Ask the room brain anything..." : "Ask your second brain anything..."}
          style={{
            flex: 1, background: c.inputBg,
            border: `1px solid ${focused ? c.cyan : c.border}`,
            borderRadius: "24px", padding: "0.875rem 1.25rem",
            color: c.text, fontFamily: "'Exo 2', sans-serif",
            fontSize: "0.925rem", outline: "none",
            transition: "all 0.3s", caretColor: c.cyan,
          }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          background: "transparent",
          border: `1px solid ${loading || !input.trim() ? "rgba(34,211,238,0.3)" : darkMode ? "#22d3ee" : "#0891b2"}`,
          borderRadius: "10px",
          padding: "0.7rem 1.25rem",
          color: darkMode ? "#22d3ee" : "#0891b2",
          cursor: loading || !input.trim() ? "not-allowed" : "pointer",
          fontSize: "0.85rem",
          opacity: loading || !input.trim() ? 0.7 : 1,
          whiteSpace: "nowrap"
        }}>
          {loading ? "..." : "Ask"}
        </button>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}