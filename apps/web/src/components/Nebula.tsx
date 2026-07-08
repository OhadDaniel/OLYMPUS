import { useEffect, useRef } from "react";
import { useReducedMotion } from "../motion/MotionProvider.js";

/**
 * The Living Void — one contained WebGL surface. A slow-drifting gold/bronze
 * fBm nebula with faint motes, rendered over the void. Dependency-free raw
 * WebGL on a single fullscreen triangle. DPR-capped at 1.5, paused when
 * offscreen or hidden, frozen to a single frame under prefers-reduced-motion.
 * Falls back to a CSS radial bloom if the GL context can't be created.
 *
 * `hue` is an [r,g,b] triple in 0..1 (defaults to MAXWELL gold) so the nebula
 * can be tinted to the active section's god.
 */
const FRAG = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;
uniform vec3 u_hue;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0,0.0)), c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res.xy) / u_res.y;
  float t = u_time * 0.03;
  vec2 q = p * 1.5;
  float warp = fbm(q * 1.4 - vec2(t * 0.25));
  float n = fbm(q + vec2(t, -t * 0.55) + warp * 0.6);
  n = pow(n, 1.9);
  float r = length(p - vec2(0.0, -0.12));
  float glow = smoothstep(1.15, 0.0, r);
  float density = n * glow;
  vec3 voidCol = vec3(0.043, 0.039, 0.063);
  vec3 col = voidCol + u_hue * density * 1.5;
  float m = pow(noise(gl_FragCoord.xy * 0.32 + t * 2.5), 42.0);
  col += vec3(1.0, 0.92, 0.72) * m * 0.6 * glow;
  gl_FragColor = vec4(col, 1.0);
}
`;
const VERT = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export function Nebula({ hue = [0.78, 0.63, 0.36] }: { hue?: [number, number, number] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) {
      canvas.style.display = "none"; // CSS fallback bloom (sibling) shows through
      return;
    }

    const compile = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      canvas.style.display = "none";
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // one big triangle covering the clip space
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uHue = gl.getUniformLocation(prog, "u_hue");
    gl.uniform3f(uHue, hue[0], hue[1], hue[2]);

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let start = 0;
    let visible = true;
    const io = new IntersectionObserver((es) => (visible = es[0]?.isIntersecting ?? true), { threshold: 0 });
    io.observe(canvas);

    const draw = (now: number) => {
      if (!start) start = now;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = 0;
      if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(draw);
    };
    if (reduced) {
      requestAnimationFrame((n) => draw(n)); // single static frame
    } else {
      raf = requestAnimationFrame(draw);
    }
    const onVis = () => {
      if (!document.hidden && !reduced && !raf) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [reduced, hue]);

  return (
    <>
      {/* CSS fallback bloom — sits behind; shown if the canvas hides itself */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(90% 70% at 50% 38%, rgba(198,161,91,0.16), transparent 60%), #0B0A10",
          pointerEvents: "none",
        }}
      />
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />
    </>
  );
}
