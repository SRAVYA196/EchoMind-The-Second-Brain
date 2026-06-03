import { useEffect, useRef, useState } from "react";

// All nodes use cyan variants for Arctic Dark theme
const EMOTION_COLORS = {
  excited:  "#22d3ee",
  curious:  "#67e8f9",
  stressed: "#f472b6",
  neutral:  "#4d8fa0",
  happy:    "#34d399",
  sad:      "#818cf8",
  confused: "#a78bfa"
};

const EMOTION_GLOW = {
  excited:  "34,211,238",
  curious:  "103,232,249",
  stressed: "244,114,182",
  neutral:  "77,143,160",
  happy:    "52,211,153",
  sad:      "129,140,248",
  confused: "167,139,250"
};

export default function GraphView({ graph }) {
  const canvasRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const nodesRef = useRef([]);
  const animRef = useRef(null);
  const pulseRef = useRef(0);

  useEffect(() => {
    if (!graph.nodes.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;

    const nodes = graph.nodes.map((n) => ({
      ...n,
      x: W / 2 + (Math.random() - 0.5) * W * 0.65,
      y: H / 2 + (Math.random() - 0.5) * H * 0.65,
      vx: 0, vy: 0, r: 10,
      pulseOffset: Math.random() * Math.PI * 2,
    }));
    nodesRef.current = nodes;

    const edges = graph.edges.slice(0, 80);

    function simulate() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1400 / (dist * dist);
          nodes[i].vx -= force * dx / dist;
          nodes[i].vy -= force * dy / dist;
          nodes[j].vx += force * dx / dist;
          nodes[j].vy += force * dy / dist;
        }
      }
      for (const e of edges) {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * 0.003;
        s.vx += force * dx / dist;
        s.vy += force * dy / dist;
        t.vx -= force * dx / dist;
        t.vy -= force * dy / dist;
      }
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.002;
        n.vy += (H / 2 - n.y) * 0.002;
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(30, Math.min(W - 30, n.x));
        n.y = Math.max(30, Math.min(H - 30, n.y));
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      pulseRef.current += 0.03;
      const pulse = pulseRef.current;

      // Draw edges with cyan glow
      for (const e of edges) {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        if (!s || !t) continue;

        // Glow line
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = "rgba(34,211,238,0.12)";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Core line
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = "rgba(34,211,238,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw nodes
      for (const n of nodes) {
        const isHovered = hoveredNode?.id === n.id;
        const color = EMOTION_COLORS[n.emotion] || "#22d3ee";
        const glowRGB = EMOTION_GLOW[n.emotion] || "34,211,238";
        const nodePulse = 0.7 + 0.3 * Math.sin(pulse + n.pulseOffset);
        const r = isHovered ? 16 : 11;

        // Layer 1: Wide outer glow
        const outerGrad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 5);
        outerGrad.addColorStop(0, `rgba(${glowRGB},${0.25 * nodePulse})`);
        outerGrad.addColorStop(1, `rgba(${glowRGB},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 5, 0, Math.PI * 2);
        ctx.fillStyle = outerGrad;
        ctx.fill();

        // Layer 2: Mid glow
        const midGrad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2.5);
        midGrad.addColorStop(0, `rgba(${glowRGB},${0.6 * nodePulse})`);
        midGrad.addColorStop(1, `rgba(${glowRGB},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = midGrad;
        ctx.fill();

        // Layer 3: Bright core
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Layer 4: White hot center
        const coreGrad = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
        coreGrad.addColorStop(0, "rgba(255,255,255,0.9)");
        coreGrad.addColorStop(0.4, `rgba(${glowRGB},0.6)`);
        coreGrad.addColorStop(1, `rgba(${glowRGB},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Hover label
        if (isHovered) {
          const label = n.label.length > 28 ? n.label.slice(0, 28) + "…" : n.label;
          const padding = 8;
          const fontSize = 11;
          ctx.font = `${fontSize}px JetBrains Mono, monospace`;
          const tw = ctx.measureText(label).width;

          // Label box
          const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          ctx.fillStyle = isDark ? "rgba(3,15,21,0.92)" : "rgba(255,255,255,0.92)";
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          const lx = n.x - tw / 2 - padding;
          const ly = n.y - r - 32;
          ctx.beginPath();
          ctx.roundRect(lx, ly, tw + padding * 2, 22, 4);
          ctx.fill();
          ctx.stroke();

          // Label text
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.fillText(label, n.x, n.y - r - 16);
        }
      }
    }

    function loop() {
      simulate();
      draw();
      animRef.current = requestAnimationFrame(loop);
    }
    loop();

    const handleMouse = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const found = nodesRef.current.find(n => Math.hypot(n.x - mx, n.y - my) < 18);
      setHoveredNode(found || null);
    };
    canvas.addEventListener("mousemove", handleMouse);

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const found = nodesRef.current.find(n => Math.hypot(n.x - mx, n.y - my) < 18);
      setSelectedNode(found || null);
    };
    canvas.addEventListener("click", handleClick);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", handleMouse);
      canvas.removeEventListener("click", handleClick);
    };
  }, [graph]);

  if (!graph.nodes.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "500px", color: "#164e63" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem", opacity: 0.3, color: "#22d3ee" }}>⟁</div>
        <p style={{ fontSize: "1rem", fontFamily: "'JetBrains Mono', monospace", color: "#22d3ee", opacity: 0.5 }}>No thoughts yet. Add your first idea above.</p>
      </div>
    );
  }

  const legend = Object.entries(EMOTION_COLORS);

  return (
    <div style={{ position: "relative", height: "550px" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

      {/* Legend */}
      <div style={{ position: "absolute", bottom: "1rem", left: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        {legend.map(([emotion, color]) => (
          <span key={emotion} style={{
            background: "var(--color-background-secondary)",
            border: `1px solid ${color}44`,
            borderRadius: "20px", padding: "0.2rem 0.6rem",
            fontSize: "0.7rem", color,
            fontFamily: "'JetBrains Mono', monospace",
            textShadow: `0 0 8px ${color}`
          }}>
            ● {emotion}
          </span>
        ))}
      </div>
      {/* Click popup */}
      {selectedNode && (
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(3, 15, 21, 0.97)",
          border: `1px solid ${EMOTION_COLORS[selectedNode.emotion] || "#22d3ee"}`,
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          width: "320px",
          maxWidth: "90%",
          zIndex: 10,
          boxShadow: `0 0 30px rgba(${EMOTION_GLOW[selectedNode.emotion] || "34,211,238"}, 0.3)`,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {/* Close button */}
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              position: "absolute", top: "10px", right: "12px",
              background: "transparent", border: "none",
              color: "#22d3ee", fontSize: "1.1rem",
              cursor: "pointer", lineHeight: 1,
            }}
          >✕</button>

          {/* Emotion badge */}
          <div style={{
            display: "inline-block",
            background: `rgba(${EMOTION_GLOW[selectedNode.emotion] || "34,211,238"}, 0.15)`,
            border: `1px solid ${EMOTION_COLORS[selectedNode.emotion] || "#22d3ee"}44`,
            borderRadius: "20px",
            padding: "2px 10px",
            fontSize: "0.68rem",
            color: EMOTION_COLORS[selectedNode.emotion] || "#22d3ee",
            marginBottom: "0.75rem",
            textTransform: "capitalize",
          }}>
            ● {selectedNode.emotion || "neutral"}
          </div>

          {/* Full thought text */}
          <div style={{
            fontSize: "0.78rem",
            color: "#94a3b8",
            lineHeight: 1.65,
            maxHeight: "200px",
            overflowY: "auto",
            borderTop: "1px solid rgba(34,211,238,0.1)",
            paddingTop: "0.6rem",
            marginTop: "0.4rem",
          }}>
            {selectedNode.label}
          </div>

          {/* Tags if available */}
          {selectedNode.tags && selectedNode.tags.length > 0 && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "4px",
              marginTop: "0.75rem",
            }}>
              {selectedNode.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: "0.65rem",
                  background: "rgba(34,211,238,0.08)",
                  border: "1px solid rgba(34,211,238,0.2)",
                  borderRadius: "4px",
                  padding: "1px 7px",
                  color: "#22d3ee",
                }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Stats */}
      <div style={{
        position: "absolute", top: "1rem", right: "1rem",
        background: "var(--color-background-secondary)", border: "1px solid rgba(34,211,238,0.2)",
        borderRadius: "6px", padding: "0.5rem 0.875rem",
        fontSize: "0.75rem", color: "var(--color-text-primary)",
        fontFamily: "'JetBrains Mono', monospace",
        textShadow: "0 0 8px rgba(34,211,238,0.5)"
      }}>
        {graph.nodes.length} nodes · {graph.edges.length} links
      </div>
    </div>
  );
}