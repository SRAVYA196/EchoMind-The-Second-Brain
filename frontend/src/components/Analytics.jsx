import { useState, useEffect } from "react";

const EMOTION_COLORS = {
  excited: "#f59e0b", curious: "#4f8eff", stressed: "#ef4444",
  neutral: "#8892b0", happy: "#06d6a0", sad: "#6366f1", confused: "#a855f7"
};

function MoodTimeline({ thoughts, currentRoom }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentRoom) {
      // Build timeline from room thoughts
      const timelineMap = {};
      thoughts.forEach(t => {
        const date = t.created_at?.slice(0, 10);
        if (!date) return;
        if (!timelineMap[date]) timelineMap[date] = {};
        timelineMap[date][t.emotion] = (timelineMap[date][t.emotion] || 0) + 1;
      });
      const result = Object.entries(timelineMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, emotions]) => ({
          date,
          emotions,
          dominant: Object.entries(emotions).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral",
          total: Object.values(emotions).reduce((a, b) => a + b, 0)
        }));
      setTimeline(result);
      setLoading(false);
    } else {
      fetch(`/mood-timeline`)
        .then(r => r.json())
        .then(data => { setTimeline(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [currentRoom, thoughts]);

  if (loading) return <p style={{ color: "var(--text2)", padding: "1rem" }}>Loading mood timeline...</p>;
  if (!timeline.length) return <p style={{ color: "var(--text2)", padding: "1rem" }}>No mood data yet. Add some thoughts!</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {timeline.map((day, i) => (
        <div key={i} style={{
          background: "var(--bg3)", border: "1px solid var(--border)",
          borderRadius: "10px", padding: "0.875rem 1.25rem"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontFamily: "Space Mono, monospace", fontSize: "0.8rem", color: "var(--text2)" }}>{day.date}</span>
            <span style={{
              background: `${EMOTION_COLORS[day.dominant]}22`,
              border: `1px solid ${EMOTION_COLORS[day.dominant]}44`,
              borderRadius: "20px", padding: "0.15rem 0.6rem",
              fontSize: "0.75rem", color: EMOTION_COLORS[day.dominant],
              fontFamily: "Space Mono, monospace"
            }}>
              {day.dominant}
            </span>
          </div>
          <div style={{ display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden", gap: "2px" }}>
            {Object.entries(day.emotions).map(([emotion, count]) => (
              <div key={emotion} style={{
                flex: count, background: EMOTION_COLORS[emotion] || "#8892b0", transition: "flex 0.3s"
              }} title={`${emotion}: ${count}`} />
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
            {Object.entries(day.emotions).map(([emotion, count]) => (
              <span key={emotion} style={{ fontSize: "0.7rem", color: EMOTION_COLORS[emotion], fontFamily: "Space Mono, monospace" }}>
                {emotion} ({count})
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BrainSummary({ thoughts, currentRoom, darkMode = true }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setSummary(null);
    try {
      if (currentRoom) {
        // Generate summary from room thoughts using backend
        const thoughtsText = thoughts.map(t => `[${t.username}]: ${t.content}`).join("\n");
        const res = await fetch(`/room/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Analyze these shared room thoughts and return ONLY this JSON:
{
  "summary": "warm 3-4 sentence insight about the group's thinking",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "encouragement": "one encouraging message for the group"
}

Thoughts:
${thoughtsText}`,
            room_code: currentRoom
          })
        });
        const data = await res.json();
        // Try to parse JSON from response
        try {
          const raw = data.response || "";
          const s = raw.indexOf("{");
          const e = raw.lastIndexOf("}") + 1;
          if (s !== -1) {
            setSummary(JSON.parse(raw.slice(s, e)));
          } else {
            setSummary({ summary: raw, insights: [], encouragement: "Keep thinking together!" });
          }
        } catch {
          setSummary({ summary: data.response || "Could not generate summary.", insights: [], encouragement: "" });
        }
      } else {
        const res = await fetch(`/brain-summary`);
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      setSummary({ summary: "Could not connect to backend.", insights: [], encouragement: "" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ color: "var(--text2)", fontSize: "0.85rem" }}>
          {currentRoom
            ? "AI reads your room's thoughts and generates a group insight report."
            : "AI reads your recent thoughts and generates a personal insight report."}
        </p>
        <button onClick={generate} disabled={loading} style={{
        background: "transparent",
        border: `1px solid ${loading ? "rgba(34,211,238,0.3)" : darkMode ? "#22d3ee" : "#0891b2"}`,
        borderRadius: "10px", padding: "0.7rem 1.25rem",
        color: darkMode ? "#22d3ee" : "#0891b2",
          cursor: loading ? "not-allowed" : "pointer", fontSize: "0.85rem",
          opacity: loading ? 0.7 : 1, whiteSpace: "nowrap"
        }}>
          {loading ? "Thinking..." : "Generate Summary"}
        </button>
      </div>

      {loading && (
        <div style={{
          background: "var(--bg3)", border: "1px solid var(--border)",
          borderRadius: "12px", padding: "1.5rem", textAlign: "center"
        }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem", animation: "pulse 1.5s infinite" }}>⟁</div>
          <p style={{ color: "var(--text2)", fontSize: "0.85rem" }}>
            {currentRoom ? "AI is reading the room's mind..." : "AI is reading your mind..."}
          </p>
        </div>
      )}

      {summary && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{
            background: "rgba(79,142,255,0.05)", border: "1px solid rgba(79,142,255,0.2)",
            borderRadius: "12px", padding: "1.25rem"
          }}>
            <p style={{ fontSize: "0.8rem", color: "var(--accent)", fontFamily: "Space Mono, monospace", marginBottom: "0.6rem" }}>
              {currentRoom ? "ROOM BRAIN SUMMARY" : "BRAIN SUMMARY"}
            </p>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: "var(--text)" }}>{summary.summary}</p>
          </div>

          {summary.insights?.length > 0 && (
            <div style={{
              background: "var(--bg3)", border: "1px solid var(--border)",
              borderRadius: "12px", padding: "1.25rem"
            }}>
              <p style={{ fontSize: "0.8rem", color: "var(--accent2)", fontFamily: "Space Mono, monospace", marginBottom: "0.75rem" }}>
                KEY INSIGHTS
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {summary.insights.map((insight, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ color: "var(--accent2)", fontWeight: 700, fontSize: "0.9rem", minWidth: "20px" }}>{i + 1}.</span>
                    <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--text)" }}>{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.encouragement && (
            <div style={{
              background: "rgba(6,214,160,0.05)", border: "1px solid rgba(6,214,160,0.2)",
              borderRadius: "12px", padding: "1.25rem",
              display: "flex", gap: "0.75rem", alignItems: "center"
            }}>
              <span style={{ fontSize: "1.5rem" }}>💡</span>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "#06d6a0", fontStyle: "italic" }}>
                {summary.encouragement}
              </p>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

export default function Analytics({ analytics, darkMode, currentRoom, currentUser, thoughts = [] }) {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "mood", label: "Mood Timeline" },
    { id: "summary", label: "Brain Summary" },
  ];

  if (!analytics || analytics.total === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", color: "var(--text2)" }}>
        No data yet. Add thoughts to see analytics!
      </div>
    );
  }

  const maxCount = Math.max(...analytics.top_tags.map(t => t.count), 1);
  const totalEmotions = Object.values(analytics.emotions).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: "1.5rem" }}>

      {/* Room indicator */}
      {currentRoom && (
        <div style={{
          background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.25)",
          borderRadius: "8px", padding: "0.5rem 1rem", marginBottom: "1rem",
          fontSize: "0.7rem", color: "#f472b6", fontFamily: "'JetBrains Mono', monospace"
        }}>
          🔴 Showing analytics for room: {currentRoom.toUpperCase()}
        </div>
      )}

      {/* Sub tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0" }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            background: "none", border: "none",
            color: activeSection === s.id ? "var(--accent)" : "var(--text2)",
            padding: "0.5rem 1rem", cursor: "pointer",
            fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "0.85rem",
            borderBottom: activeSection === s.id ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: "-1px", transition: "all 0.2s"
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeSection === "overview" && (
        <div style={{ display: "piechart", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <div style={{
            gridColumn: "1 / -1", background: "var(--bg3)", border: "1px solid var(--border)",
            borderRadius: "12px", padding: "1.25rem", display: "flex", gap: "2rem", alignItems: "center"
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--accent)", fontFamily: "Space Mono" }}>
                {analytics.total}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text2)" }}>Total Thoughts</div>
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--text2)", lineHeight: 1.7 }}>
              Your brain has <strong style={{ color: "var(--text)" }}>{analytics.total} thoughts</strong> across{" "}
              <strong style={{ color: "var(--text)" }}>{analytics.top_tags.length} topics</strong>. Dominant emotion:{" "}
              <strong style={{ color: EMOTION_COLORS[Object.entries(analytics.emotions).sort((a, b) => b[1] - a[1])[0]?.[0]] }}>
                {Object.entries(analytics.emotions).sort((a, b) => b[1] - a[1])[0]?.[0]}
              </strong>.
            </div>
          </div>

          <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem" }}>
            <h3 style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "1rem", fontFamily: "Space Mono, monospace", letterSpacing: "0.1em" }}>
              TOP OBSESSIONS
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {analytics.top_tags.map(({ tag, count }) => (
                <div key={tag}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.85rem", fontFamily: "Space Mono, monospace", color: "var(--accent)" }}>#{tag}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{count}x</span>
                  </div>
                  <div style={{ height: "4px", background: "var(--bg)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "2px", width: `${(count / maxCount) * 100}%`, background: "linear-gradient(90deg, var(--accent), var(--accent2))", transition: "width 0.5s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem" }}>
            <h3 style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "1rem", fontFamily: "Space Mono, monospace", letterSpacing: "0.1em" }}>
              EMOTION BREAKDOWN
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {Object.entries(analytics.emotions).sort((a, b) => b[1] - a[1]).map(([emotion, count]) => (
                <div key={emotion}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.85rem", color: EMOTION_COLORS[emotion] || "#8892b0" }}>{emotion}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{Math.round(count / totalEmotions * 100)}%</span>
                  </div>
                  <div style={{ height: "4px", background: "var(--bg)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "2px", width: `${(count / totalEmotions) * 100}%`, background: EMOTION_COLORS[emotion] || "#8892b0", transition: "width 0.5s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === "mood" && <MoodTimeline thoughts={thoughts} currentRoom={currentRoom} />}
      {activeSection === "summary" && <BrainSummary thoughts={thoughts} currentRoom={currentRoom} darkMode={darkMode} />}
    </div>
  );
}