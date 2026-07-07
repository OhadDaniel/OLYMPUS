/** The breathing gold orb over a slow parallax starfield (Olympus beat 1). */
export function Orb() {
  return (
    <div className="relative flex h-40 w-full items-center justify-center overflow-hidden">
      {/* starfield */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, #EDE6D6 40%, transparent), radial-gradient(1px 1px at 70% 60%, #B9B2A2 40%, transparent), radial-gradient(1.5px 1.5px at 45% 80%, #C6A15B 40%, transparent), radial-gradient(1px 1px at 85% 20%, #EDE6D6 40%, transparent)",
          backgroundSize: "600px 300px, 400px 200px, 500px 250px, 300px 300px",
          animation: "drift 60s linear infinite alternate",
        }}
      />
      {/* orb */}
      <div
        className="h-20 w-20 rounded-full"
        style={{
          background: "radial-gradient(circle at 38% 34%, #E8C87E 0%, #C6A15B 42%, #8C6A3F 74%, #4a3a1e 100%)",
          boxShadow: "0 0 40px 8px rgba(198,161,91,0.35), inset 0 0 18px rgba(255,240,200,0.25)",
          animation: "breathe 6s ease-in-out infinite",
        }}
      />
    </div>
  );
}
