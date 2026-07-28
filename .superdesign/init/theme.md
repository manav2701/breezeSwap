# BreezeSwap Design System & Theme Tokens

## Part 1 — Compact Token Summary

- **Design Style Target**: Hyper-Saturated Fluid (High-Contrast Fluidity, Glassmorphic Overlays, Liquid Sectioning)
- **Primary / Hero Color ("The Shout Color")**: Cyber Yellow (`#FDE047` / `rgb(253 224 71)`) or Electric Cyan (`#06B6D4` / `rgb(6 182 212)`)
- **Background ("The Void")**: Deep Onyx (`#0A0A0A` / `rgb(10 10 10)` or `#020617` Slate-950)
- **Surface**: Charcoal (`#171717` or `#0F172A` Slate-900)
- **Accents**: Pure White (`#FFFFFF`), Neon Emerald (`#10B981`), Rose Red (`#F43F5E`), Amber Gold (`#F59E0B`), Electric Blue (`#3B82F6`)
- **Typography**: Inter / Sans-Serif
  - Hero Headline: `text-6xl` to `text-8xl`, `font-extrabold`, `tracking-tight`
  - Sub-headers: `text-xl`, `font-semibold`
  - Body: `text-xs` / `text-sm`, `font-normal`, `leading-relaxed`
  - Labels: `text-[10px]`, `uppercase`, `tracking-widest`, `font-mono`
- **Shapes & Radii**:
  - Asymmetrical Liquid Cuts: `rounded-b-[100px]`, `rounded-bl-[40px]`
  - Component Radii: `rounded-full` for CTA pills/badges, `rounded-3xl` / `rounded-[32px]` for glass containers
- **Glassmorphism Depth**: `backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl`

---

## Part 2 — Raw Source Dumps

### `web/app/globals.css`
```css
@import "tailwindcss";

@layer base {
  body {
    background-color: #090d16;
    color: #f8fafc;
  }
}
```
