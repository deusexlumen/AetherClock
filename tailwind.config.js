/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        digital: ['"Orbitron"', 'sans-serif'],
      },
      colors: {
        radio: {
          case: 'var(--radio-case, #1a1a1a)',
          face: 'var(--radio-face, #0a0a0a)',
          dim: 'var(--radio-dim, #2a2a2a)',
          lit: 'var(--radio-lit, #ff3333)',
          glow: 'var(--radio-glow, rgba(255, 51, 51, 0.6))',
          accent: '#3b82f6',
          btn: 'var(--radio-btn, #262626)',
        },
        neutral: {
          850: '#262626',
        },
      },
      backgroundImage: {
        'speaker-grille': 'radial-gradient(circle, #000 20%, transparent 25%)',
        'brushed-metal': 'linear-gradient(180deg, #333 0%, #222 50%, #1a1a1a 100%)',
      },
      boxShadow: {
        led: '0 0 10px rgba(255, 51, 51, 0.5), 0 0 20px rgba(255, 51, 51, 0.3)',
        device: '0 20px 50px -10px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)',
        btn: '0 4px 0 #000, 0 5px 10px rgba(0,0,0,0.5)',
        'btn-pressed': '0 1px 0 #000, inset 0 2px 5px rgba(0,0,0,0.5)',
        'inset-screen': 'inset 0 2px 10px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [],
};
