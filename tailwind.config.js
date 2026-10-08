/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0D1117',
        card: '#161B22',
        border: '#30363D',
        green: '#00E676',
        'dark-green': '#00C853',
        blue: '#00B0FF',
        purple: '#B388FF',
        orange: '#FFAB40',
        bio: '#8BC34A',
        rec: '#00B0FF',
        res: '#EF5350',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        btn: '14px',
        chip: '20px',
      },
    },
  },
  plugins: [],
}
