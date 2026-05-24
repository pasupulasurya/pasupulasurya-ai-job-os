# Design Principles

Benchmark: **Apple** (apple.com, macOS, iOS).
We borrow restraint, precision, and motion discipline.

## Color

### Dark mode (default, locked)

- `--background` — `#000000` (true OLED black, top-level surfaces)
- `--surface` — `#0A0A0A` (elevated panels, modals)
- `--card` — `#171717` (cards, list items)
- `--border` — `rgba(255, 255, 255, 0.08)` (barely visible, glass-like)
- `--border-strong` — `rgba(255, 255, 255, 0.16)` (focus, dividers)

### Text

- `--text-primary` — `#FFFFFF` (headlines, body)
- `--text-secondary` — `rgba(255, 255, 255, 0.70)` (supporting copy)
- `--text-tertiary` — `rgba(255, 255, 255, 0.40)` (timestamps, hints)
- `--text-disabled` — `rgba(255, 255, 255, 0.24)`

### Accent (used sparingly)

- `--accent` — `#0A84FF` (Apple blue — for CTAs, focus rings, links)
- `--accent-hover` — `#3B9DFF`
- `--accent-pressed` — `#0066CC`

### Semantic

- `--success` — `#30D158` (matches macOS green)
- `--warning` — `#FFD60A`
- `--danger` — `#FF453A`

### Light mode (port of dark)

- `--background` — `#FFFFFF`
- `--surface` — `#F5F5F7` (Apple's signature off-white)
- `--card` — `#FFFFFF`
- `--text-primary` — `#000000`
- `--border` — `rgba(0, 0, 0, 0.08)`
- Accent stays `#0A84FF`

## Typography

### Font stack

- **Display:** `Inter Display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
- **Body:** `Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
- **Mono:** `JetBrains Mono, SF Mono, Menlo, monospace`

### Scale (locked — no in-between sizes)

| Token       | px  | Use                             |
| ----------- | --- | ------------------------------- |
| `text-xs`   | 12  | timestamps, badges              |
| `text-sm`   | 14  | secondary copy, dense data      |
| `text-base` | 16  | body                            |
| `text-md`   | 18  | emphasized body                 |
| `text-lg`   | 22  | small headlines, section titles |
| `text-xl`   | 28  | page titles                     |
| `text-2xl`  | 36  | screen titles                   |
| `text-3xl`  | 48  | hero headlines                  |
| `text-4xl`  | 64  | landing hero only               |

### Tracking (letter-spacing)

- Body sizes: 0
- 22-28px headlines: -0.01em
- 36px+: -0.02em
- All-caps labels (rare): +0.04em

### Line height

- Headlines: 1.2
- Body: 1.5
- Code: 1.6

## Spacing

8px base unit. Allowed values only:
`4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192`

Tailwind classes: `gap-1` (4), `gap-2` (8), `gap-3` (12), `gap-4` (16),
`gap-6` (24), `gap-8` (32), `gap-12` (48), `gap-16` (64), `gap-24` (96).

## Motion

### Easing (locked)

- Default ease: `cubic-bezier(0.16, 1, 0.3, 1)` — sharp out, soft land
- Linear allowed only for: progress bars, loading spinners

### Spring presets (Framer Motion)

- **`snappy`** — `{ stiffness: 400, damping: 30 }` — buttons, taps
- **`smooth`** — `{ stiffness: 300, damping: 30 }` — page transitions
- **`gentle`** — `{ stiffness: 200, damping: 40 }` — hero reveals

### Duration

- Micro-interactions (hover, press): 150–200ms
- Layout transitions: 300–400ms
- Hero reveals: 500–800ms

### Forbidden

- Bouncy/elastic springs (no `overshoot > 1.05`)
- Linear ease on UI elements
- Animations < 100ms (feels broken) or > 1000ms (feels sluggish)

## Density & layout

- **Marketing surfaces:** generous, Apple landing-page levels of whitespace
- **App dashboard:** dense, Bloomberg-meets-Linear; data forward but never cluttered
- **Form pages:** 480-600px max-width, centered
- **Empty states:** designed with the same care as populated states

## Iconography

- **Source:** Lucide (matches shadcn default)
- **Size:** 16px (inline), 20px (buttons), 24px (standalone)
- **Stroke width:** 1.5 (lighter than default 2 — feels more refined)
- **Color:** inherits from text token; no colored icons in v1

## Forbidden patterns

- Gradients in primary UI surfaces (allowed only in hero/marketing moments)
- Drop shadows beyond `0 1px 2px rgba(0,0,0,0.04)` — Apple uses surface elevation, not shadows
- Multiple accent colors
- Skeuomorphism (no glossy buttons, no 3D bevels)
- Bouncy animations (we are precise, never cute)
- Emoji in production UI (replace with Lucide icons)

## Tone of voice (UI copy)

- Direct, calm, never apologetic
- "Done" not "Yay! All done! 🎉"
- "We couldn't find that job" not "Oops! Something went wrong."
- Empty states use one short sentence + one optional secondary line

## Quality bar — every component must

1. Look identical in dark + light mode (no broken contrast)
2. Animate enter + exit (no popping into existence)
3. Have a designed empty/loading/error state
4. Be keyboard-navigable
5. Pass accessibility contrast (WCAG AA minimum)
6. Render correctly at 320px, 768px, 1024px, 1440px, 1920px
