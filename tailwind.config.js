/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        wa: {
          green: {
            DEFAULT: '#00a884',
            dark: '#008069',
            light: '#25d366',
            teal: '#128c7e',
          },
          panel: {
            light: '#f0f2f5',
            dark: '#202c33',
            darker: '#111b21',
          },
          chat: {
            light: '#efeae2',
            dark: '#0b141a',
          },
          bubble: {
            in: {
              light: '#ffffff',
              dark: '#202c33',
            },
            out: {
              light: '#d9fdd3',
              dark: '#005c4b',
            },
          },
          border: {
            light: '#e9edef',
            dark: '#222e35',
          },
          text: {
            primary: {
              light: '#111b21',
              dark: '#e9edef',
            },
            secondary: {
              light: '#667781',
              dark: '#8696a0',
            },
            muted: {
              light: '#8696a0',
              dark: '#667781',
            }
          },
          tick: '#53bdeb',
        }
      },
    },
  },
  plugins: [],
};
