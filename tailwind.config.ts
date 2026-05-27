import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        bg: { 950:"#04070D", 900:"#070B14", 800:"#0B111C", 700:"#0F1726", 600:"#141D30" },
        line:{ 900:"#172033", 800:"#1F2A40", 700:"#293551", 600:"#36446A" },
        ink: { 50:"#F1F5FB", 100:"#E4EAF2", 200:"#C9D2DF", 300:"#A4B0C2", 400:"#7B8AA0", 500:"#5C6B82", 600:"#3F4C61", 700:"#2A364A" },
        cy:  { 50:"#E6FBFE",100:"#C2F6FB",200:"#86ECF7",300:"#4DE2F0",400:"#22D3EE",500:"#06B6D4",600:"#0891B2",700:"#0E7490" },
        lime:{ 200:"#E5FBA8",300:"#D1F574",400:"#BEF264",500:"#A3E635",600:"#84CC16",700:"#65A30D" },
      },
      boxShadow: {
        'glow-cy':  '0 0 0 1px rgba(34,211,238,0.35), 0 0 24px -2px rgba(34,211,238,0.45)',
        'glow-lime':'0 0 0 1px rgba(190,242,100,0.4), 0 0 28px -4px rgba(163,230,53,0.55)',
        'card':     '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 40px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
export default config;
