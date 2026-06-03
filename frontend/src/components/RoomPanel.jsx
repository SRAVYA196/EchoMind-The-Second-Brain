import { useState } from "react";

const USER_COLORS = [
  "#22d3ee", "#f472b6", "#34d399", "#a78bfa",
  "#fb923c", "#67e8f9", "#4ade80", "#e879f9",
];

function getUserColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export default function RoomPanel({ darkMode = true, onJoinRoom, onLeaveRoom, currentRoom, currentUser }) {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [focused1, setFocused1] = useState(false);
  const [focused2, setFocused2] = useState(false);

  const c = {
    bg: darkMode ? "rgba(4,24,32,0.8)" : "#f8fafc",
    bg2: darkMode ? "rgba(2,13,18,0.9)" : "#ffffff",
    border: darkMode ? "rgba(34,211,238,0.15)" : "rgba(8,145,178,0.2)",
    borderFocus: darkMode ? "rgba(34,211,238,0.5)" : "rgba(8,145,178,0.5)",
    text: darkMode ? "#e0f7fa" : "#0f172a",
    dim: darkMode ? "#4d8fa0" : "#64748b",
    cyan: darkMode ? "#22d3ee" : "#0891b2",
    dimColor: darkMode ? "#164e63" : "#94a3b8",
  };

  const btnBase = {
    borderRadius: "8px",
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: "0.75rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    transition: "all 0.2s",
    background: "transparent",
    cursor: "pointer",
  };

  const handleJoin = () => {
    if (!username.trim()) { setError("Please enter your name!"); return; }
    if (!roomCode.trim()) { setError("Please enter a room code!"); return; }
    if (roomCode.trim().length < 3) { setError("Room code must be at least 3 characters!"); return; }
    setError("");
    onJoinRoom(username.trim(), roomCode.trim().toLowerCase());
  };

  if (currentRoom) {
    return (
      <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        <div style={{ background: c.bg, border: `1px solid ${c.cyan}44`, borderRadius: "12px", padding: "1.5rem" }}>
          <p style={{ fontSize: "0.65rem", color: c.cyan, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2em", marginBottom: "1rem" }}>
            ✅ CURRENTLY IN ROOM
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: getUserColor(currentUser),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.2rem", fontWeight: 700, color: "#020d12",
              fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
            }}>
              {currentUser[0].toUpperCase()}
            </div>
            <div>
              <p style={{ color: c.text, fontFamily: "'Exo 2', sans-serif", fontSize: "1rem", fontWeight: 700 }}>{currentUser}</p>
              <p style={{ color: c.dim, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem" }}>your username</p>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <p style={{ color: c.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.1em" }}>
                {currentRoom.toUpperCase()}
              </p>
              <p style={{ color: c.dim, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem" }}>room code</p>
            </div>
          </div>

          <div style={{ background: darkMode ? "rgba(34,211,238,0.05)" : "rgba(8,145,178,0.05)", border: `1px solid ${c.border}`, borderRadius: "8px", padding: "1rem", marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "0.75rem", color: c.dim, fontFamily: "'Exo 2', sans-serif", lineHeight: 1.6 }}>
              Share code <strong style={{ color: c.cyan }}>{currentRoom.toUpperCase()}</strong> with others to join this room!
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={() => { navigator.clipboard.writeText(currentRoom.toUpperCase()); alert(`Room code "${currentRoom.toUpperCase()}" copied!`); }}
              style={{
                ...btnBase,
                border: `1px solid ${c.cyan}`,
                padding: "0.7rem 1.5rem",
                color: c.cyan,
              }}
            >
              📋 Copy Room Code
            </button>
            <button
              onClick={onLeaveRoom}
              style={{
                ...btnBase,
                border: "1px solid rgba(244,114,182,0.4)",
                padding: "0.7rem 1.5rem",
                color: "#f472b6",
              }}
            >
              🚪 Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <p style={{ fontSize: "0.65rem", color: c.cyan, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2em", marginBottom: "0.5rem" }}>
            👤 YOUR NAME
          </p>
          <input
            value={username}
            onChange={e => { setUsername(e.target.value); setError(""); }}
            onFocus={() => setFocused1(true)}
            onBlur={() => setFocused1(false)}
            onKeyDown={e => e.key === "Enter" && handleJoin()}
            placeholder="Enter your name (e.g. Sravya)"
            style={{
              width: "100%", background: c.bg2,
              border: `1px solid ${focused1 ? c.borderFocus : c.border}`,
              borderRadius: "8px", padding: "0.875rem 1rem",
              color: c.text, fontFamily: "'Exo 2', sans-serif",
              fontSize: "1rem", outline: "none", caretColor: c.cyan, transition: "all 0.2s",
            }}
          />
        </div>

        <div>
          <p style={{ fontSize: "0.65rem", color: c.cyan, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2em", marginBottom: "0.5rem" }}>
            🔑 ROOM CODE
          </p>
          <input
            value={roomCode}
            onChange={e => { setRoomCode(e.target.value); setError(""); }}
            onFocus={() => setFocused2(true)}
            onBlur={() => setFocused2(false)}
            onKeyDown={e => e.key === "Enter" && handleJoin()}
            placeholder="Enter room code (e.g. myteam123)"
            style={{
              width: "100%", background: c.bg2,
              border: `1px solid ${focused2 ? c.borderFocus : c.border}`,
              borderRadius: "8px", padding: "0.875rem 1rem",
              color: c.text, fontFamily: "'Exo 2', sans-serif",
              fontSize: "1rem", outline: "none", caretColor: c.cyan,
              transition: "all 0.2s", textTransform: "lowercase",
            }}
          />
          <p style={{ fontSize: "0.7rem", color: c.dimColor, fontFamily: "'JetBrains Mono', monospace", marginTop: "0.4rem" }}>
            Share this code with friends so they can join your room
          </p>
        </div>

        {error && (
          <p style={{ color: "#f472b6", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem" }}>
            ⚠ {error}
          </p>
        )}

        <button
          onClick={handleJoin}
          disabled={!username.trim() || !roomCode.trim()}
          style={{
            background: "transparent",
            border: `1px solid ${!username.trim() || !roomCode.trim() ? "rgba(34,211,238,0.3)" : darkMode ? "#22d3ee" : "#0891b2"}`,
            borderRadius: "10px",
            padding: "0.875rem",
            color: darkMode ? "#22d3ee" : "#0891b2",
            cursor: !username.trim() || !roomCode.trim() ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
            opacity: !username.trim() || !roomCode.trim() ? 0.7 : 1,
            whiteSpace: "nowrap",
            width: "100%",
            transition: "all 0.2s",
          }}
        >
          Enter Brain Room 
        </button>
      </div>
    </div>
  );
}