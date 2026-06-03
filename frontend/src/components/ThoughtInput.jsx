import { useState, useEffect } from "react";

const DEFAULT_CATEGORIES = ["General", "Work", "Personal", "Ideas", "Health", "Learning"];

export default function ThoughtInput({ onAdd, loading, darkMode = true, activeCategory, setActiveCategory, currentRoom }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [isVoice, setIsVoice] = useState(false);
  const [focused, setFocused] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState("");

  const c = {
    bg: darkMode ? "#030f15" : "#ffffff",
    border: darkMode ? "rgba(34,211,238,0.15)" : "rgba(8,145,178,0.2)",
    borderFocused: darkMode ? "rgba(34,211,238,0.5)" : "rgba(8,145,178,0.5)",
    text: darkMode ? "#e0f7fa" : "#0f172a",
    dim: darkMode ? "rgba(34,211,238,0.5)" : "rgba(8,145,178,0.6)",
    cyan: darkMode ? "#22d3ee" : "#0891b2",
    dimColor: darkMode ? "#164e63" : "#64748b",
  };

  useEffect(() => {
    fetch("/categories")
      .then(r => r.json())
      .then(data => {
        const merged = [...new Set([...DEFAULT_CATEGORIES, ...data])];
        setCategories(merged);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!text.trim()) return;

    const reminderPattern = /remind\s+me|in\s+\d+\s*(sec|second|mins|min|minutes|minute|hours|hour|hr)/i;
    const timePattern = /(\d+)\s*(sec|second|mins|min|minutes|minute|hours|hour|hr)/i;

    if (reminderPattern.test(text)) {
      const match = text.match(timePattern);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        let seconds = value;
        if (unit.startsWith("min")) seconds = value * 60;
        else if (unit.startsWith("hour") || unit.startsWith("hr")) seconds = value * 3600;
        try {
          const res = await fetch("/reminders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: text.trim(), total_seconds: seconds }),
          });
          const saved = await res.json();
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            const reg = await navigator.serviceWorker.ready;
            reg.active?.postMessage({
              type: "SCHEDULE_NOTIFICATION",
              title: "⏰ EchoMind Reminder",
              body: text.trim(),
              delayMs: seconds * 1000,
              tag: saved.id ?? String(Date.now()),
            });
            alert(`✅ Reminder set for ${match[1]} ${match[2]}!`);
          }
        } catch (e) {
          console.error("Reminder error:", e);
        }
      }
    }

    await onAdd(text.trim(), isVoice ? "voice" : "text", activeCategory === "All" ? "General" : activeCategory);
    setText("");
    setIsVoice(false);
  };

  const handleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Voice not supported. Use Chrome.");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-US";
    setListening(true);
    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setText(t);
      setListening(false);
      setIsVoice(true);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const addNewCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories(prev => [...prev, trimmed]);
    setActiveCategory(trimmed);
    setNewCat("");
    setShowNewCat(false);
  };

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${focused ? c.borderFocused : c.border}`,
      borderRadius: "8px",
      padding: "1.25rem 1.5rem",
      display: "flex", flexDirection: "column", gap: "0.875rem",
      boxShadow: focused ? `0 0 0 3px ${darkMode ? "rgba(34,211,238,0.08)" : "rgba(8,145,178,0.08)"}` : "0 4px 20px rgba(0,0,0,0.1)",
      transition: "all 0.3s", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "1px",
        background: `linear-gradient(90deg, transparent, ${c.cyan}, transparent)`,
        opacity: focused ? 0.8 : 0.3,
      }} />

      {/* Category selector */}
      {!currentRoom && (
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.65rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em" }}>FOLDER:</span>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={{
            background: activeCategory === cat ? `${c.cyan}22` : "transparent",
            border: `1px solid ${activeCategory === cat ? c.cyan : c.border}`,
            borderRadius: "20px", padding: "0.2rem 0.75rem",
            color: activeCategory === cat ? c.cyan : c.dimColor,
            fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem",
            cursor: "pointer", transition: "all 0.2s",
          }}>{cat}</button>
        ))}
        {showNewCat ? (
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <input
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addNewCategory()}
              placeholder="New folder..."
              autoFocus
              style={{
                background: "transparent", border: `1px solid ${c.border}`,
                borderRadius: "20px", padding: "0.2rem 0.75rem",
                color: c.text, fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.7rem", outline: "none", width: "100px",
              }}
            />
            <button onClick={addNewCategory} style={{
              background: `${c.cyan}22`, border: `1px solid ${c.cyan}`,
              borderRadius: "20px", padding: "0.2rem 0.5rem",
              color: c.cyan, fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.7rem", cursor: "pointer",
            }}>✓</button>
            <button onClick={() => { setShowNewCat(false); setNewCat(""); }} style={{
              background: "transparent", border: "none",
              color: c.dimColor, cursor: "pointer", fontSize: "0.8rem",
            }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowNewCat(true)} style={{
            background: "transparent", border: `1px dashed ${c.border}`,
            borderRadius: "20px", padding: "0.2rem 0.75rem",
            color: c.dimColor, fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.7rem", cursor: "pointer",
          }}>+ New</button>
        )}
      </div>
    )}

      {/* Input row */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: "0.65rem", color: c.dim,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.5rem",
          }}>
            &gt; capture thought
          </p>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setIsVoice(false); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
            placeholder="drop an idea, memory, or insight into your second brain..."
            rows={2}
            style={{
              width: "100%", background: "transparent",
              border: "none", outline: "none",
              color: c.text, fontFamily: "'Exo 2', sans-serif",
              fontSize: "1rem", resize: "none", lineHeight: 1.7,
              caretColor: c.cyan,
            }}
          />
        </div>

        <button onClick={handleVoice} style={{
          background: "transparent",
          border: `1px solid ${listening ? c.cyan : c.border}`,
          borderRadius: "8px", padding: "0.75rem",
          color: listening ? c.cyan : c.dimColor,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700, fontSize: "0.75rem",
          cursor: "pointer", transition: "all 0.2s",
        }}>
          {listening ? "⏺" : "🎤"}
        </button>

        <button onClick={handleSubmit} disabled={loading || !text.trim()} style={{
          background: "transparent",
          border: `1px solid ${loading || !text.trim() ? "rgba(34,211,238,0.3)" : darkMode ? "#22d3ee" : "#0891b2"}`,
          borderRadius: "10px", padding: "0.7rem 1.25rem",
          color: darkMode ? "#22d3ee" : "#0891b2",
          cursor: loading || !text.trim() ? "not-allowed" : "pointer", fontSize: "0.85rem",
          opacity: loading || !text.trim() ? 0.7 : 1, whiteSpace: "nowrap",
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
        }}>
          {loading ? "storing..." : "Store"}
        </button>
      </div>
    </div>
  );
}