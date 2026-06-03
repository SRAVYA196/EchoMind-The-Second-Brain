import { useState, useRef, useEffect } from "react";

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

export default function VideoPanel({ darkMode = true, currentRoom, currentUser }) {
  const c = {
    bg: darkMode ? "rgba(4,24,32,0.9)" : "#ffffff",
    bg2: darkMode ? "rgba(4,24,32,0.8)" : "#f8fafc",
    border: darkMode ? "rgba(34,211,238,0.15)" : "rgba(8,145,178,0.2)",
    text: darkMode ? "#e0f7fa" : "#0f172a",
    dim: darkMode ? "#164e63" : "#64748b",
    cyan: darkMode ? "#22d3ee" : "#0891b2",
    inputBg: darkMode ? "rgba(2,13,18,0.9)" : "#f1f5f9",
  };

  const btnBase = {
    borderRadius: "8px",
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: "0.8rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    transition: "all 0.2s",
    background: "transparent",
    cursor: "pointer",
    padding: "0.875rem 1.5rem",
  };

  // Full origin URL — works on localhost AND ngrok/mobile
  const BASE = window.location.origin;

  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState(null);
  const [debugMsg, setDebugMsg] = useState("");

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchVideos();
    return () => {
      stopStream();
      clearInterval(timerRef.current);
    };
  }, [currentRoom]);

  const fetchVideos = async () => {
    try {
      const url = currentRoom ? `${BASE}/room/videos/${currentRoom}` : `${BASE}/get-videos`;
      const res = await fetch(url);
      const data = await res.json();
      setVideos(data);
    } catch (e) { console.error("Could not fetch videos"); }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const analyzeTranscript = async (text) => {
    if (!text.trim()) return { emotion: "neutral", summary: "Video recording" };
    try {
      const res = await fetch(`${BASE}/analyze-text`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      return { emotion: data.emotion || "neutral", summary: data.summary || text.slice(0, 80) };
    } catch (e) { console.error("Analysis error:", e); }
    return { emotion: "neutral", summary: text.slice(0, 80) || "Video recording" };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm") ? "video/webm"
        : MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/mp4" });
        const url = URL.createObjectURL(blob);
        stopStream();
        if (videoRef.current) videoRef.current.srcObject = null;
        setTranscribing(true);

        // Convert blob to base64
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(blob);
        });

        let finalTranscript = "";
        try {
          // Using BASE (full origin) so it works on mobile via ngrok
          const res = await fetch(`${BASE}/transcribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio_base64: base64 }),
          });
          const rawText = await res.text();
          const data = JSON.parse(rawText);
          finalTranscript = data.transcript || "";
        } catch (e) {
          setDebugMsg(prev => prev + ` | Error: ${e.message}`);
          console.error("Transcribe error:", e);
        }

        const analysis = await analyzeTranscript(finalTranscript);
        setDetectedEmotion(analysis);
        setTranscribing(false);
        setPreview({ url, blob, transcript: finalTranscript, ...analysis });
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setSaved(false);
      setPreview(null);
      setDetectedEmotion(null);
      setRecordingTime(0);
      setDebugMsg("");
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (e) {
      alert("Camera access denied! Please allow camera and microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(preview.blob);
      });
      const filename = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
      const url = currentRoom ? `${BASE}/room/save-video` : `${BASE}/save-video`;
      const body = currentRoom
        ? {
            video_base64: base64, snapshot_base64: "", filename,
            transcript: preview.transcript || "", emotion: preview.emotion || "neutral",
            summary: preview.summary || "Video recording",
            username: currentUser, room_code: currentRoom,
          }
        : {
            video_base64: base64, snapshot_base64: "", filename,
            transcript: preview.transcript || "", emotion: preview.emotion || "neutral",
            summary: preview.summary || "Video recording",
          };
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.id) { setSaved(true); setPreview(null); setDebugMsg(""); await fetchVideos(); }
    } catch (e) { alert("Error saving video."); }
    finally { setSaving(false); }
  };

  const handleDiscard = () => {
    setPreview(null); setSaved(false);
    setDetectedEmotion(null); setDebugMsg("");
  };

  const handleDelete = async (id) => {
    const url = currentRoom ? `${BASE}/room/videos/${id}` : `${BASE}/delete-video/${id}`;
    await fetch(url, { method: "DELETE" });
    await fetchVideos();
    if (activeVideo?.id === id) setActiveVideo(null);
  };

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: c.text, fontFamily: "'Exo 2', sans-serif" }}>
          🎥 Video Recorder
        </h2>
        {currentRoom && (
          <span style={{
            background: "rgba(244,114,182,0.08)", border: "1px solid rgba(244,114,182,0.25)",
            borderRadius: "20px", padding: "0.3rem 0.875rem",
            color: "#f472b6", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem",
          }}>
            🔴 Room: {currentRoom.toUpperCase()}
          </span>
        )}
      </div>


      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

        {/* Left: Camera */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{
            background: c.bg, border: `1px solid ${recording ? "rgba(244,114,182,0.5)" : c.border}`,
            borderRadius: "12px", overflow: "hidden", position: "relative",
            aspectRatio: "16/9", transition: "all 0.3s",
          }}>
            <video ref={videoRef} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: recording ? "block" : "none" }} />
            {preview && !recording && (
              <video src={preview.url} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            {!recording && !preview && !transcribing && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.75rem" }}>
                <div style={{ fontSize: "3rem", opacity: 0.3, color: c.cyan }}>🎥</div>
                <p style={{ color: c.dim, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", letterSpacing: "0.1em" }}>CAMERA READY</p>
              </div>
            )}
            {transcribing && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.75rem" }}>
                <span style={{ fontSize: "2rem", color: c.cyan, animation: "spin 1s linear infinite", display: "inline-block" }}>⟁</span>
                <p style={{ color: c.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem" }}>ANALYZING SPEECH...</p>
              </div>
            )}
            {recording && (
              <div style={{ position: "absolute", top: "0.75rem", left: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(0,0,0,0.7)", borderRadius: "20px", padding: "0.3rem 0.75rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f472b6", animation: "blink 1s infinite" }} />
                <span style={{ color: "#f472b6", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem" }}>REC {formatTime(recordingTime)}</span>
              </div>
            )}
            {saved && (
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(52,211,153,0.15)", border: "1px solid #34d399", borderRadius: "12px", padding: "1rem 2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
                <p style={{ color: "#34d399", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem" }}>VIDEO SAVED!</p>
              </div>
            )}
          </div>

          {preview && !saving && (
            <div style={{ background: c.bg2, border: `1px solid ${c.border}`, borderRadius: "8px", padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <p style={{ fontSize: "0.65rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>WHAT DID YOU SAY?</p>
                <input
                  defaultValue={preview.transcript || ""}
                  onChange={e => {
                    const val = e.target.value;
                    if (val.trim().length > 3) {
                      clearTimeout(window._emotionTimer);
                      window._emotionTimer = setTimeout(async () => {
                        const analysis = await analyzeTranscript(val);
                        setDetectedEmotion(analysis);
                        setPreview(p => ({ ...p, transcript: val, ...analysis }));
                      }, 800);
                    }
                  }}
                  placeholder="Type what you said in the video..."
                  style={{
                    width: "100%", background: c.inputBg,
                    border: `1px solid ${c.border}`, borderRadius: "6px",
                    padding: "0.6rem 0.875rem", color: c.text,
                    fontFamily: "'Exo 2', sans-serif", fontSize: "0.85rem",
                    outline: "none", caretColor: c.cyan,
                  }}
                />
              </div>

              {detectedEmotion && (
                <div>
                  <p style={{ fontSize: "0.65rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>DETECTED EMOTION:</p>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <span style={{ color: EMOTION_COLORS[detectedEmotion.emotion] || c.dim, fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", fontWeight: 700 }}>
                      ● {detectedEmotion.emotion}
                    </span>
                    <p style={{ fontSize: "0.8rem", color: c.text, fontFamily: "'Exo 2', sans-serif" }}>{detectedEmotion.summary}</p>
                  </div>
                </div>
              )}

              <div>
                <p style={{ fontSize: "0.65rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>OR PICK EMOTION MANUALLY:</p>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {Object.entries(EMOTION_COLORS).map(([emotion, color]) => (
                    <button key={emotion} onClick={() => {
                      setDetectedEmotion(d => ({ ...d, emotion }));
                      setPreview(p => ({ ...p, emotion }));
                    }} style={{
                      background: "transparent",
                      border: `1px solid ${detectedEmotion?.emotion === emotion ? color : c.border}`,
                      borderRadius: "20px", padding: "0.25rem 0.75rem",
                      color: detectedEmotion?.emotion === emotion ? color : c.dim,
                      fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem",
                      cursor: "pointer", transition: "all 0.2s",
                    }}>● {emotion}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            {!recording && !preview && !transcribing && (
              <button onClick={startRecording} style={{
                ...btnBase,
                border: `1px solid ${c.cyan}`,
                color: c.cyan,
                padding: "0.875rem 2rem",
              }}>START RECORDING</button>
            )}
            {recording && (
              <button onClick={stopRecording} style={{
                ...btnBase,
                border: "1px solid #f472b6",
                color: "#f472b6",
                padding: "0.875rem 2rem",
              }}>⏹ STOP RECORDING</button>
            )}
            {preview && !saving && (
              <>
                <button onClick={handleSave} style={{
                  ...btnBase,
                  border: "1px solid #34d399",
                  color: "#34d399",
                }}>✅ SAVE</button>
                <button onClick={handleDiscard} style={{
                  ...btnBase,
                  border: "1px solid rgba(244,114,182,0.4)",
                  color: "#f472b6",
                }}>✕ DISCARD</button>
              </>
            )}
            {saving && (
              <div style={{ color: c.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟁</span>
                Saving video...
              </div>
            )}
          </div>
        </div>

        {/* Right: Saved Videos */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "0.75rem", color: c.dim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
            SAVED VIDEOS ({videos.length})
          </p>
          {videos.length === 0 ? (
            <div style={{ background: c.bg2, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "2rem", textAlign: "center" }}>
              <p style={{ color: c.dim, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem" }}>No videos saved yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "400px", overflowY: "auto" }}>
              {videos.map(v => {
                const userColor = v.username ? getUserColor(v.username) : c.cyan;
                return (
                  <div key={v.id} style={{
                    background: activeVideo?.id === v.id ? `${c.cyan}12` : c.bg2,
                    border: `1px solid ${activeVideo?.id === v.id ? `${c.cyan}66` : currentRoom ? `${userColor}22` : c.border}`,
                    borderLeft: currentRoom ? `3px solid ${userColor}` : undefined,
                    borderRadius: "10px", padding: "0.875rem 1rem",
                    cursor: "pointer", transition: "all 0.2s",
                  }} onClick={() => setActiveVideo(v)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        {currentRoom && v.username && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.35rem" }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: "50%",
                              background: userColor,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.6rem", fontWeight: 700, color: "#020d12",
                              fontFamily: "'JetBrains Mono', monospace",
                            }}>
                              {v.username[0].toUpperCase()}
                            </div>
                            <span style={{ fontSize: "0.68rem", color: userColor, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                              {v.username}
                            </span>
                          </div>
                        )}
                        <p style={{ fontSize: "0.8rem", color: c.text, fontFamily: "'Exo 2', sans-serif", marginBottom: "0.4rem" }}>
                          🎥 {v.summary || "Video recording"}
                        </p>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <span style={{ color: EMOTION_COLORS[v.emotion] || c.dim, fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>● {v.emotion}</span>
                          <span style={{ color: c.dim, fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>
                            {new Date(v.created_at).toLocaleDateString()} {new Date(v.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                      {(!currentRoom || v.username === currentUser) && (
                        <button onClick={e => { e.stopPropagation(); handleDelete(v.id); }} style={{
                          background: "transparent", border: "none", color: c.dim,
                          cursor: "pointer", fontSize: "0.9rem", opacity: 0.5, transition: "all 0.2s",
                        }}
                          onMouseOver={e => { e.target.style.opacity = 1; e.target.style.color = "#f472b6"; }}
                          onMouseOut={e => { e.target.style.opacity = 0.5; e.target.style.color = c.dim; }}
                        >✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeVideo && (
        <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <p style={{ color: c.cyan, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>NOW PLAYING</p>
              <p style={{ color: c.text, fontFamily: "'Exo 2', sans-serif", fontSize: "0.9rem" }}>{activeVideo.summary}</p>
              {currentRoom && activeVideo.username && (
                <p style={{ color: getUserColor(activeVideo.username), fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", marginTop: "0.25rem" }}>
                  👤 {activeVideo.username}
                </p>
              )}
            </div>
            <span style={{
              background: "transparent",
              border: `1px solid ${EMOTION_COLORS[activeVideo.emotion]}44`,
              borderRadius: "20px", padding: "0.3rem 0.875rem",
              color: EMOTION_COLORS[activeVideo.emotion],
              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem",
            }}>● {activeVideo.emotion}</span>
          </div>
          <video src={`${BASE}/videos/${activeVideo.filename}`} controls style={{ width: "100%", borderRadius: "8px", maxHeight: "300px", background: "#000" }} />
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}