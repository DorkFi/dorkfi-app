# DorkFi Brand Guide

> Reference for designers, developers, and contributors. Everything here is derived from the DorkFi app design system.

---

## Logo & Identity

**Name:** DorkFi  
**Tagline:** Borrow. Lend. Dork Out.  
**Domain:** dork.fi  
**Ecosystem:** Voi Network + Algorand (AVM)  

### Logos

| Asset | Preview | Usage |
|-------|---------|-------|
| dork.fi — white background | ![dork.fi logo on white](brand-assets/logo-dorkfi-white-bg.jpg) | Light backgrounds, print, docs |
| dork.fi — dark background | ![dork.fi logo on dark](brand-assets/logo-dorkfi-dark-bg.jpg) | App UI, dark mode, social profiles |
| Dork Labs — white background | ![Dork Labs logo](brand-assets/logo-dorklabs-white-bg.jpg) | Corporate/legal contexts, grants, press |

**Notes:**
- Primary logo color: **Whale Gold** `#A07C10` (as rendered)
- Always maintain clear space around the logo equal to the height of the "d"
- Do not recolor, stretch, or add effects to the logo

### Brand Background

![DorkFi dark landscape background](brand-assets/background-dark-landscape.jpg)

Dark rocky/ocean landscape — used as a scene background for NFTs, social cards, and hero imagery. Palette: deep navy `#1A2D4A`, slate grey `#3A4A5A`, off-white `#C8CDD4`.

---

## Mascots & Characters

### Lil Chubs (NFT Collection / Intern Mascot)

![Lil Chubs mascot](brand-assets/mascot-lil-chubs.jpg)

The chubby blue whale — DorkFi's unofficial mascot and NFT collection character. Carries a book, wears glasses, surrounded by gold coins. Friendly, earnest, slightly overwhelmed. Used for community content, the DorkFi Intern Discord bot, and @DorkFi_Intern persona on X.

### Gold Whale

![Gold whale](brand-assets/mascot-gold-whale.jpg)

The gold humpback whale — represents UNIT holders, governance power, and the "whale" archetype in DeFi. Used for premium content, UNIT-related materials, and brand hero imagery.

---

## Token Assets

### UNIT Token

![UNIT token coin](brand-assets/token-unit-coin.jpg)

Gold whale on a stone coin. Inscription: **CDXX-LXIX** (Roman numerals for 420,069 — the fixed supply). Used for UNIT governance communications, token listings, and marketing materials.



---

## Typography

**Primary Font:** [Poppins](https://fonts.google.com/specimen/Poppins) (Google Fonts)

```
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
font-family: 'Poppins', sans-serif;
```

| Weight | Usage |
|--------|-------|
| 300 | Subtle labels, captions |
| 400 | Body text |
| 500 | UI labels, nav items |
| 600 | Subheadings, card titles |
| 700 | Headings |
| 800 | Hero text, display |

---

## Color Palette

### Primary Colors

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Ocean Teal** | `#00A39E` | `178 100% 32%` | Primary actions, links, highlights |
| **Deep Sea Navy** | `#061838` | `218 76% 12%` | Background (dark mode) |
| **Whale Gold** | `#F0B800` | `46 100% 47%` | Accent, warnings, badges |
| **Deep Navy** | `#061838` | — | Page background, header |

### Extended Palette

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Ink Blue** | `#0F4068` | `204 69% 20%` | Secondary backgrounds, borders |
| **Highlight Aqua** | `#00BDBD` | `190 100% 37%` | Hover states, active indicators |
| **Sky Blue** | `#82D4F5` | `203 100% 73%` | Subtle highlights, info states |
| **Warning Orange** | `#F57C2D` | `25 95% 60%` | Warnings, at-risk indicators |
| **Destructive Red** | `#F87171` | `0 84.2% 60.2%` | Errors, liquidation alerts |
| **Bubble White** | `#FFFFFF` | `0 0% 100%` | Text on dark backgrounds |

### Ocean Gradient

| Name | HSL | Notes |
|------|-----|-------|
| Ocean Surface | `194 100% 51%` | Gradient start |
| Deep Ocean Blue | `203 100% 21%` | Gradient mid |
| Ocean Floor | `226 53% 11%` | Gradient end / deepest bg |
| Aqua Glow | `194 100% 50%` | Glow effects |

### Dark Mode Tokens

```css
--background:    218 76% 9%   /* #061228 — main app background */
--card:          218 76% 9%   /* same as background */
--primary:       178 100% 32% /* Ocean Teal */
--accent:        46 100% 47%  /* Whale Gold */
--muted:         217.2 32.6% 14%
--border:        217.2 32.6% 17.5%
```

---

## Shadows

```css
/* Card elevation */
box-shadow: 0 20px 40px rgba(6, 24, 56, 0.1), 0 1px 0px rgba(255, 255, 255, 0.8) inset;

/* Card hover */
box-shadow: 0 25px 50px rgba(6, 24, 56, 0.2), 0 1px 0px rgba(255, 255, 255, 0.9) inset;
```

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.5rem` (8px) | Base |
| `rounded-sm` | 6px | Small elements |
| `rounded-md` | 6px | Cards, inputs |
| `rounded-lg` | 8px | Modals, panels |

---

## UI States

| State | Color | Notes |
|-------|-------|-------|
| Healthy / Safe | Green (`#bbf7d0`) | HF > 1.5 |
| Warning / At Risk | Whale Gold (`#F0B800`) | HF 1.0–1.5 |
| Danger / Liquidatable | Destructive Red (`#F87171`) | HF < 1.0 |
| Primary action | Ocean Teal (`#00A39E`) | Buttons, CTAs |
| Disabled | Muted (`217.2 32.6% 14%`) | Inactive elements |

---

## Voice & Tone

- **Playful branding, serious economics.** The name is intentionally weird. The protocol is not.
- Short, direct copy. No fluff.
- No exclamation points in formal contexts.
- Audience: crypto-native traders, DeFi power users, DAO treasuries.
- Avoid: yield framing for WAD, investment language, overpromising.

### Token Naming
| Token | Full Name | Notes |
|-------|-----------|-------|
| WAD | Whale Asset Dollar | Overcollateralized stablecoin. Do not frame as yield. |
| UNIT | UNIT | Governance token. Fixed supply: 420,069. |
| nTokens | nTokens | Receipt tokens for deposits. Accrue interest automatically. |

---

## GitHub Profile Standards

- **Repository names:** lowercase, hyphenated (`dorkfi-app`, `dorkfi-liquidation-bot`)
- **README headers:** Use `#` H1 for project name, `##` for sections
- **Badges:** Use shields.io with `#00A39E` (Ocean Teal) for custom badges
- **Default branch:** `next` is production for the main app
- **Commit style:** Conventional commits (`feat:`, `fix:`, `chore:`)

### Suggested README Structure
```
# Project Name
> One-line description

## Overview
## Quick Start
## Architecture
## Contributing
## License
```

---

## Social Handles

| Platform | Handle |
|----------|--------|
| X (Twitter) | [@dork_fi](https://x.com/dork_fi) |
| Discord | discord.gg/6KSrmWJK3E |
| Medium | medium.com/@dorkfi |
| Docs | docs.dork.fi |
| App | dork.fi |

---

*Last updated: April 2026*
