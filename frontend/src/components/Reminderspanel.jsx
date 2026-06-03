import { useState, useEffect, useRef } from "react";

// FIX 1: Use correct port 8001 for local, ngrok URL for mobile
const API =
  window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : `${window.location.protocol}//${window.location.hostname.replace("echomind-2026", "echomind-api-2026")}`;

// ── Notification helper ─────────────────────────────────────────────
// FIX 2: Direct Notification API instead of Service Worker postMessage
// SW postMessage silently fails on mobile/ngrok — direct API is reliable
async function fireNotification(content, tag = String(Date.now())) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[Reminder] Notification permission denied");
      return false;
    }

    // Try Service Worker showNotification first (works better on mobile)
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("⏰ EchoMind Reminder", {
          body: content,
          icon: "/favicon.ico",
          vibrate: [200, 100, 200, 100, 200],
          tag,
          renotify: true,
          requireInteraction: true, // keeps notification visible until dismissed
        });
        return true;
      } catch (swErr) {
        console.warn("[Reminder] SW notification failed, using fallback:", swErr);
      }
    }

    // Fallback: direct Notification API
    new Notification("⏰ EchoMind Reminder", {
      body: content,
      icon: "/favicon.ico",
      tag,
      renotify: true,
    });
    return true;
  } catch (e) {
    console.error("[Reminder] Notification error:", e);
    return false;
  }
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error("SW registration failed:", e);
    return null;
  }
}

export default function RemindersPanel({ darkMode = true }) {
  const c = {
    bg: darkMode ? "rgba(4,24,32,0.8)" : "#ffffff",
    border: darkMode ? "rgba(34,211,238,0.2)" : "rgba(8,145,178,0.2)",
    text: darkMode ? "#e0f7fa" : "#0f172a",
    dim: darkMode ? "#4d8fa0" : "#64748b",
    cyan: darkMode ? "#22d3ee" : "#0891b2",
    inputBg: darkMode ? "rgba(2,13,18,0.8)" : "#f8fafc",
    doneBg: darkMode ? "rgba(2,13,18,0.5)" : "#f1f5f9",
    doneBorder: darkMode ? "rgba(34,211,238,0.08)" : "rgba(8,145,178,0.1)",
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

  const [reminders, setReminders] = useState([]);
  const [recurring, setRecurring] = useState(false);
  const [content, setContent] = useState("");
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const swRegistered = useRef(false);

  // Store active timers: { [reminderId]: timeoutId }
  const timersRef = useRef({});

  useEffect(() => {
    if (!swRegistered.current) {
      registerSW();
      swRegistered.current = true;
    }
    // Request notification permission on mount
    Notification.requestPermission().then(p => {
      console.log("[Reminder] Notification permission:", p);
    });
  }, []);

  const fetchReminders = async () => {
    try {
      const res = await fetch(`${API}/reminders`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setReminders(data);
    } catch (e) {
      console.error("Failed to fetch reminders:", e);
    }
  };

  useEffect(() => {
    fetchReminders();
    const interval = setInterval(fetchReminders, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalSeconds = parseInt(minutes || 0) * 60 + parseInt(seconds || 0);

  // ── FIX 3: Reliable one-time reminder using direct setTimeout ──────
  function scheduleOneTime(reminderId, content, delayMs) {
    console.log(`[Reminder] Scheduling one-time: "${content}" in ${delayMs}ms`);

    // Clear any existing timer for this id
    if (timersRef.current[reminderId]) {
      clearTimeout(timersRef.current[reminderId]);
    }

    const timeoutId = setTimeout(async () => {
      console.log(`[Reminder] Firing one-time: "${content}"`);
      await fireNotification(content, reminderId);
      delete timersRef.current[reminderId];
      await fetchReminders(); // refresh to show as done
    }, delayMs);

    timersRef.current[reminderId] = timeoutId;
  }

  // ── FIX 4: Reliable recurring reminder — fires immediately then repeats
  function scheduleRecurring(reminderId, content, intervalMs) {
    console.log(`[Reminder] Scheduling recurring: "${content}" every ${intervalMs}ms`);

    // Clear existing timer
    if (timersRef.current[reminderId]) {
      clearTimeout(timersRef.current[reminderId]);
    }

    // FIX: Fire first notification after interval (not immediately)
    // Use recursive setTimeout instead of setInterval — more reliable
    const scheduleNext = () => {
      const timeoutId = setTimeout(async () => {
        // Check if reminder was cancelled
        if (!timersRef.current[reminderId]) return;

        console.log(`[Reminder] Firing recurring: "${content}"`);
        await fireNotification(content, `${reminderId}-${Date.now()}`);

        // Schedule next repetition
        scheduleNext();
      }, intervalMs);

      timersRef.current[reminderId] = timeoutId;
    };

    scheduleNext();
  }

  const addReminder = async () => {
    const total = parseInt(minutes || 0) * 60 + parseInt(seconds || 0);
    if (!content.trim() || total <= 0) return;

    setLoading(true);
    setError("");

    try {
      // Save to backend
      const res = await fetch(`${API}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          total_seconds: total,
          recurring,
          interval_seconds: total,
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const saved = await res.json();

      // FIX 5: Request permission explicitly before scheduling
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("⚠ Please allow notifications in your browser to receive reminders.");
        setLoading(false);
        return;
      }

      // Schedule notification
      if (recurring) {
        scheduleRecurring(saved.id, content.trim(), total * 1000);
      } else {
        scheduleOneTime(saved.id, content.trim(), total * 1000);
      }

      // Reset form
      setContent("");
      setMinutes(0);
      setSeconds(30);
      setRecurring(false);
      await fetchReminders();

    } catch (e) {
      console.error("Failed to set reminder:", e);
      setError("Failed to set reminder. Is the server running?");
    }

    setLoading(false);
  };

  const deleteReminder = async (id) => {
    // Cancel timer
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
      console.log(`[Reminder] Cancelled timer for ${id}`);
    }

    try {
      await fetch(`${API}/reminders/${id}`, { method: "DELETE" });
      await fetchReminders();
    } catch (e) {
      console.error("Failed to delete reminder:", e);
    }
  };

  const pending = reminders.filter(r => !r.done);
  const done = reminders.filter(r => r.done);

  const timeLeft = (fireAt) => {
    const diff = new Date(fireAt) - new Date();
    if (diff <= 0) return "firing...";
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const inputStyle = {
    background: c.inputBg,
    border: `1px solid ${c.border}`, borderRadius: "8px",
    padding: "0.6rem 0.75rem", color: c.text,
    fontFamily: "'JetBrains Mono', monospace", fontSize: "0.9rem",
    outline: "none", textAlign: "center", width: "70px",
  };

  const presets = [
    { label: "10s", m: 0, s: 10 }, { label: "30s", m: 0, s: 30 },
    { label: "1 min", m: 1, s: 0 }, { label: "5 min", m: 5, s: 0 },
    { label: "10 min", m: 10, s: 0 }, { label: "30 min", m: 30, s: 0 },
    { label: "1 hr", m: 60, s: 0 },
  ];

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Add Reminder */}
      <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "1.25rem" }}>
        <p style={{ fontSize: "0.65rem", color: c.cyan, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2em", marginBottom: "1rem" }}>
          ⏰ NEW REMINDER
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addReminder()}
            placeholder="What do you want to be reminded about?"
            style={{
              background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: "8px",
              padding: "0.75rem 1rem", color: c.text, fontFamily: "'Exo 2', sans-serif",
              fontSize: "0.95rem", outline: "none",
            }}
          />

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace" }}>In</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input type="number" min="0" max="1440" value={minutes} onChange={e => setMinutes(e.target.value)} style={inputStyle} />
              <span style={{ fontSize: "0.75rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace" }}>min</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input type="number" min="0" max="59" value={seconds} onChange={e => setSeconds(e.target.value)} style={inputStyle} />
              <span style={{ fontSize: "0.75rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace" }}>sec</span>
            </div>
            {totalSeconds > 0 && (
              <span style={{ fontSize: "0.72rem", color: c.cyan, fontFamily: "'JetBrains Mono', monospace" }}>
                = {totalSeconds}s total
              </span>
            )}
            <button
              onClick={addReminder}
              disabled={loading || !content.trim() || totalSeconds <= 0}
              style={{
                ...btnBase,
                marginLeft: "auto",
                border: `1px solid ${loading || !content.trim() || totalSeconds <= 0 ? c.border : c.cyan}`,
                padding: "0.7rem 1.75rem",
                color: loading || !content.trim() || totalSeconds <= 0 ? c.dim : c.cyan,
                cursor: loading || !content.trim() || totalSeconds <= 0 ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}>
              {loading ? "Setting..." : "Set Reminder →"}
            </button>
          </div>

          {error && (
            <p style={{ color: "#f472b6", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem" }}>⚠ {error}</p>
          )}

          {/* Presets */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {presets.map(p => (
              <button key={p.label} onClick={() => { setMinutes(p.m); setSeconds(p.s); }} style={{
                background: "transparent",
                border: `1px solid ${minutes === p.m && seconds === p.s ? c.cyan : c.border}`,
                borderRadius: "20px", padding: "0.3rem 0.85rem",
                color: minutes === p.m && seconds === p.s ? c.cyan : c.dim,
                cursor: "pointer", fontSize: "0.75rem",
                fontFamily: "'JetBrains Mono', monospace", transition: "all 0.2s",
              }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Recurring toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem" }}>
            <button onClick={() => setRecurring(r => !r)} style={{
              background: "transparent",
              border: `1px solid ${recurring ? c.cyan : c.border}`,
              borderRadius: "20px", padding: "0.3rem 0.85rem",
              color: recurring ? c.cyan : c.dim,
              cursor: "pointer", fontSize: "0.75rem",
              fontFamily: "'JetBrains Mono', monospace", transition: "all 0.2s",
            }}>
              {recurring ? "🔁 Recurring ON" : "🔁 Recurring OFF"}
            </button>
            {recurring && (
              <span style={{ fontSize: "0.72rem", color: c.cyan, fontFamily: "'JetBrains Mono', monospace" }}>
                Repeats every {totalSeconds}s
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <p style={{ fontSize: "0.65rem", color: c.cyan, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2em", marginBottom: "0.75rem" }}>
            ⏳ PENDING ({pending.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {pending.map(r => (
              <div key={r.id} style={{
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: "8px", padding: "1rem 1.25rem",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <p style={{ color: c.text, fontFamily: "'Exo 2', sans-serif", fontSize: "0.9rem" }}>{r.content}</p>
                  <p style={{ color: c.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem" }}>⏱ {timeLeft(r.fire_at)}</p>
                  {r.recurring && (
                    <span style={{
                      fontSize: "0.65rem", color: c.cyan,
                      fontFamily: "'JetBrains Mono', monospace",
                      border: `1px solid ${c.cyan}44`,
                      borderRadius: "20px", padding: "0.1rem 0.5rem",
                      display: "inline-block",
                    }}>🔁 recurring</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {r.recurring && (
                    <button onClick={() => deleteReminder(r.id)} style={{
                      background: "transparent",
                      border: `1px solid ${c.cyan}`,
                      borderRadius: "8px", padding: "0.4rem 0.75rem",
                      color: c.cyan, cursor: "pointer", fontSize: "0.75rem",
                      fontFamily: "'JetBrains Mono', monospace", transition: "all 0.2s",
                    }}>⏹ Stop</button>
                  )}
                  <button onClick={() => deleteReminder(r.id)} style={{
                    background: "transparent",
                    border: "1px solid rgba(244,114,182,0.3)",
                    borderRadius: "8px", padding: "0.4rem 0.75rem",
                    color: "#f472b6", cursor: "pointer", fontSize: "0.75rem",
                    fontFamily: "'JetBrains Mono', monospace", transition: "all 0.2s",
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {done.length > 0 && (
        <div>
          <p style={{ fontSize: "0.65rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2em", marginBottom: "0.75rem" }}>
            ✓ COMPLETED ({done.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {done.map(r => (
              <div key={r.id} style={{
                background: c.doneBg, border: `1px solid ${c.doneBorder}`,
                borderRadius: "8px", padding: "1rem 1.25rem",
                display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.6,
              }}>
                <p style={{ color: c.dim, fontFamily: "'Exo 2', sans-serif", fontSize: "0.9rem", textDecoration: "line-through" }}>
                  {r.content}
                </p>
                <button onClick={() => deleteReminder(r.id)} style={{
                  ...btnBase,
                  border: "1px solid rgba(244,114,182,0.2)",
                  padding: "0.4rem 0.75rem",
                  color: "#f472b6",
                }}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && done.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: c.dim }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⏰</p>
          <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: "0.9rem" }}>No reminders yet. Set one above!</p>
        </div>
      )}
    </div>
  );
}