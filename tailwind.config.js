/** @type {import('tailwindcss').Config} */
// ECOReward staff console: the café's back office after hours. Same brand as the kiosk and the phone app
// (Crave navy #142477 and sun #FFC914, cream; Fraunces + DM Sans), dark for long shifts.
// Token NAMES are unchanged so every page picks the new look up; category colours (bio/rec/res) stay
// identical across the kiosk, app and console.
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        white: '#FFF8EC',        // Crave cream: all "white" text and overlays are warm
        bg: '#080D2B',           // night navy: the counter after closing
        card: '#0F1847',
        raised: '#16205A',       // inputs, hovered rows
        border: '#26336F',
        green: '#FFC914',        // Crave sun: the brand accent (name kept so every page follows); navy text on sun fills
        'dark-green': '#D9A800',
        forest: '#23359E',     // navy light: icon tiles
        blue: '#00B0FF',
        purple: '#B388FF',
        orange: '#FF8F5A',       // coral: points and "needs attention", apart from the sun accent
        bio: '#8BC34A',
        rec: '#00B0FF',
        res: '#EF5350',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '20px',
        btn: '14px',
        chip: '20px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
