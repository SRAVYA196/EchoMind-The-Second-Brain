import { useEffect, useRef } from "react";

export default function NeuralBackground({ darkMode = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    };

    function draw() {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const dotColor = darkMode ? "rgba(187, 198, 198, 0.12)" : "rgba(8,145,178,0.08)";
      const blobColor = darkMode ? "rgba(34,211,238,0.06)" : "rgba(8,145,178,0.04)";
      const lineColor = darkMode ? "rgba(34,211,238,0.03)" : "rgba(8,145,178,0.02)";

      const spacing = 40;
      for (let x = 0; x < W; x += spacing) {
        for (let y = 0; y < H; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, 0.8, 0, Math.PI * 2);
          ctx.fillStyle = dotColor;
          ctx.fill();
        }
      }

      const blobs = [
        { x: 0, y: 0, r: 350 },
        { x: W, y: H, r: 400 },
        { x: W * 0.6, y: H * 0.3, r: 250 },
      ];
      blobs.forEach(({ x, y, r }) => {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, blobColor);
        grad.addColorStop(1, "rgba(34,211,238,0)");
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      for (let y = 0; y < H; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [darkMode]);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", top: 0, left: 0,
      width: "100vw", height: "100vh",
      zIndex: 0, pointerEvents: "none",
      background: darkMode ? "#020d12" : "#e8f4f8"
    }} />
  );
}