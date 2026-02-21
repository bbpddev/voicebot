/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        surface: "#0A0A0A",
        "surface-highlight": "#121212",
        primary: "#00F0FF",
        "primary-glow": "rgba(0, 240, 255, 0.5)",
        secondary: "#7000FF",
        accent: "#FF003C",
        success: "#00FF94",
        warning: "#FFD600",
        "text-primary": "#FFFFFF",
        "text-secondary": "#9CA3AF",
        border: "rgba(0, 240, 255, 0.15)",
      },
      fontFamily: {
        heading: ["Orbitron", "sans-serif"],
        sub: ["Rajdhani", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow": "spin 4s linear infinite",
        "ping-slow": "ping 2s cubic-bezier(0,0,0.2,1) infinite",
        "orb-idle": "orbIdle 3s ease-in-out infinite",
        "orb-listen": "orbListen 1s ease-in-out infinite",
        "scanline": "scanline 8s linear infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "wave": "wave 0.8s ease-in-out infinite alternate",
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "slide-in": "slideIn 0.3s ease-out forwards",
      },
      keyframes: {
        orbIdle: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        orbListen: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.08)", opacity: "0.9" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,240,255,0.3), 0 0 60px rgba(0,240,255,0.1)" },
          "50%": { boxShadow: "0 0 40px rgba(0,240,255,0.6), 0 0 120px rgba(0,240,255,0.2)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        wave: {
          "0%": { transform: "scaleY(0.3)" },
          "100%": { transform: "scaleY(1)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
