/** @type {import('tailwindcss').Config} */
// ECOReward staff console: the café's back office after hours. Same brand as the kiosk and the phone app
// (forest/mint, coffee/crema, cream; Fraunces + DM Sans), dark for long shifts.
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
        white: '#F2EDE3',        // cream: all "white" text and overlays are warm, never blue-white
        bg: '#0E1310',           // espresso-forest
        card: '#161D18',
        raised: '#1C2520',       // inputs, hovered rows
        border: '#2A342D',
        green: '#7CCFA5',        // brand mint (text 9:1 on card; dark text on mint fills)
        'dark-green': '#5BB287',
        forest: '#2F5D3A',
        blue: '#00B0FF',
        purple: '#B388FF',
        orange: '#E2AE68',       // crema: points and "needs attention"
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
