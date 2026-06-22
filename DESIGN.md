---
name: HR Management System
description: A calm, trustworthy system of record for a Thai agency's hybrid digital + paper HR workflow.
colors:
  civic-indigo: "oklch(0.488 0.243 264.376)"
  civic-indigo-foreground: "oklch(0.985 0 0)"
  ink: "oklch(0.145 0 0)"
  paper-bg: "oklch(0.985 0 0)"
  card-white: "oklch(1 0 0)"
  muted-surface: "oklch(0.97 0 0)"
  muted-ink: "oklch(0.556 0 0)"
  hairline: "oklch(0.922 0 0)"
  destructive-rose: "oklch(0.577 0.245 27.325)"
typography:
  title:
    fontFamily: "var(--font-inter), var(--font-noto-sans-thai), system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "normal"
  body:
    fontFamily: "var(--font-inter), var(--font-noto-sans-thai), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-inter), var(--font-noto-sans-thai), system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "0.3rem"
  md: "0.4rem"
  lg: "0.5rem"
  xl: "0.7rem"
  pill: "9999px"
spacing:
  xs: "0.375rem"
  sm: "0.625rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.civic-indigo}"
    textColor: "{colors.civic-indigo-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-primary-hover:
    backgroundColor: "{colors.civic-indigo}"
    textColor: "{colors.civic-indigo-foreground}"
  button-outline:
    backgroundColor: "{colors.paper-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-destructive:
    backgroundColor: "{colors.destructive-rose}"
    textColor: "{colors.destructive-rose}"
    rounded: "{rounded.lg}"
    height: "2rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  badge-status:
    backgroundColor: "{colors.muted-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "1.25rem"
    padding: "0.125rem 0.5rem"
---

# Design System: HR Management System

## 1. Overview

**Creative North Star: "The Civil Registry"**

This is the dependable government desk made digital: a calm, exact place where leave, travel, attendance, and official paperwork are recorded and trusted. The interface carries quiet institutional authority. It is not stiff, not loud, and never decorative for its own sake. Civic Indigo signals competence without shouting; everything else is a near-neutral surface so that the one thing that matters on any screen — *where a request is, and what happens next* — stands out. The system is bilingual at its core (Thai is the working language, English the secondary), and legibility in both scripts is a first-class constraint, not an afterthought.

The system explicitly rejects two opposite failures. It rejects the **cramped legacy Thai-government look** — tiny gray-on-gray text, dense tables with no breathing room, ASP.NET-era forms — by keeping real information density but pairing it with spacing rhythm, hairline structure, and high text contrast. And it rejects **over-minimal sparseness** that hides the data HR staff need to scan quickly; whitespace serves legibility here, it never replaces information. It equally rejects consumer-SaaS decoration (gradient heroes, marketing cards) and generic AI-dashboard scaffolding (identical icon+number stat cards, tracked eyebrows, gradient accents). This is a tool, not a brochure.

Density is tunable, not fixed: a global density control (compact / normal / large) scales the fluid base font, because the same product serves an HR power-user processing dozens of records and an older employee submitting one request. Depth is conveyed by hairline rings and tonal layering, never by drop shadows.

**Key Characteristics:**
- Calm, trustworthy, institutional — *steady, legible, unsurprising.*
- Civic Indigo as the single accent; everything else neutral.
- Status is the most prominent thing on any workflow screen.
- Flat surfaces with hairline rings; no decorative shadows.
- Monospace for all numeric/tabular data (balances, day counts, IDs, emails).
- Bilingual Thai/English legibility and WCAG 2.1 AA as hard constraints.
- Four themes (light / dark / soft / bold) and three density modes share one token system.

## 2. Colors

A near-monochrome neutral field with a single saturated indigo accent — Restrained by default, so that color always means something.

### Primary
- **Civic Indigo** (`oklch(0.488 0.243 264.376)` ≈ indigo-600): The only brand accent. Reserved for primary actions, the current/active selection, focus rings, and key state indicators. It is competence made visible — official, dependable, never decorative. Across the four themes it shifts value (deeper in *bold*, softer in *soft*) but never hue.

### Neutral
- **Ink** (`oklch(0.145 0 0)`): Primary text. Near-black, chroma 0 — maximum legibility against paper and card surfaces. This is the contrast anchor; when in doubt, body text moves toward Ink, never toward light gray.
- **Paper** (`oklch(0.985 0 0)`): The app background. A true off-white at chroma 0 — deliberately *not* a warm cream/sand tint.
- **Card White** (`oklch(1 0 0)`): Pure white for raised content surfaces, one step brighter than Paper to read as a distinct layer without a shadow.
- **Muted Surface** (`oklch(0.97 0 0)`): Secondary fills — ghost-button hover, secondary buttons, card footers (at 50% over), input disabled states.
- **Muted Ink** (`oklch(0.556 0 0)`): Secondary/supporting text and placeholders. Used sparingly; it must still clear 4.5:1 on Paper/Card. Never the carrier of essential information.
- **Hairline** (`oklch(0.922 0 0)`): Borders, input strokes, dividers, table rules. The structural workhorse — this system draws with thin lines, not boxes.

### Tertiary — Semantic Status
Status is carried by a fixed Tailwind-palette vocabulary, standardized across role-aware dashboards and safelisted in `globals.css`: **slate** (neutral/draft), **sky** (informational/in-progress), **emerald** (approved/completed/success), **amber** (awaiting/pending/warning), **rose** (rejected/error), **violet** & **indigo** (category accents). Each is used at the 50–700 range with matching text/bg/border. Status color is **always** paired with a label or icon — never the sole signal — for color-blind users.

### Named Rules
**The One Accent Rule.** Civic Indigo is the only brand color on the surface. If a screen has two competing accents, one is wrong. Status colors are a separate, semantic system and do not count as decoration.

**The No-Warm-Tint Rule.** Neutrals sit at chroma 0 (or tinted toward indigo in the *soft*/*bold* themes, never toward warm). The cream/sand/parchment body background is forbidden.

## 3. Typography

**Primary Font:** Inter (Latin) + Noto Sans Thai (Thai), loaded together as one bilingual `--font-sans` stack with `system-ui` fallback.
**Data Font:** A monospace stack (`ui-monospace, SFMono-Regular, Menlo, …`) via `font-mono`.

**Character:** One humanist sans carries every heading, label, button, and body string in both scripts — no display/body pairing, because product UI doesn't need one. The only deliberate second voice is monospace, reserved exclusively for numbers and machine values so columns of figures align and read cleanly. The base size is *fluid* (`clamp(14px → 17px)`) and scales with the density control.

### Hierarchy
- **Title** (medium / 500, `1rem`, line-height 1.375): Card titles and section headings. Quiet — one step up from body, not a display moment.
- **Body** (regular / 400, `0.875rem` / `text-sm`, line-height 1.5): The default for UI text. Prose blocks cap at 65–75ch; dense tables may run wider.
- **Data** (medium / 500, `0.875rem`, monospace): Leave balances, accrued/used day counts, currency amounts, record IDs, emails, file names. Anything countable or copyable.
- **Label** (medium / 500, `0.75rem` / `text-xs`): Form labels, badge text, table headers, metadata. Sentence case in Thai; reserve uppercase tracking for rare technical mono labels only.

### Named Rules
**The Mono-for-Numbers Rule.** Every balance, day count, amount, ID, and email renders in `font-mono`. Tabular figures are data, not prose; they must align and never reflow ambiguously.

**The No-Eyebrow Rule.** No tiny uppercase tracked kicker above sections. Headings stand on their own weight and size.

## 4. Elevation

This system is **flat by default and draws with hairlines, not shadows.** Depth comes from a 1px ring (`ring-1 ring-foreground/10`) and tonal layering — Paper background → Card White surface → Muted footer — never from a drop shadow at rest. A 2026 audit test: if a card floats on a soft gray blur, it's wrong; cards sit *on* the page, separated by a hairline ring and a brightness step.

The one place "elevation" is real is **transient overlays** — dropdowns, popovers, dialogs, the toast (sonner, top-right) — which lift above content via a semantic z-index scale and a restrained shadow that reads as "temporary," not "decorative." Focus is its own elevation language: a 3px indigo ring (`ring-ring/50`) plus a border shift, never a glow for glow's sake.

### Named Rules
**The Hairline Rule.** Structure is drawn with 1px lines and one-step brightness changes. A colored `border-left`/`border-right` thicker than 1px as an accent stripe is forbidden.

**The Flat-At-Rest Rule.** Surfaces are flat until they're transient. Shadows appear only on things that float above the page and will disappear (menus, dialogs, toasts).

## 5. Components

Components feel **crisp and dependable**: compact, predictable, and identical screen to screen. Every interactive element ships its full state set — default, hover, focus-visible, active, disabled, plus aria-invalid — and the same control looks the same everywhere.

### Buttons
- **Shape:** Gently rounded (`rounded-lg`, 0.5rem); compact default height **2rem** (`h-8`), `px-2.5`. Sizes xs/sm/lg/icon share the scale.
- **Primary:** Civic Indigo fill, near-white text; hover deepens to `primary/80`. The single high-emphasis action per view.
- **Outline / Secondary / Ghost:** Hairline-bordered Paper, Muted Surface fill, and transparent-until-hover respectively — the quiet majority of buttons.
- **Destructive:** Tinted, not solid — `bg-destructive/10` with rose text, deepening on hover. Destructive actions are signalled, not screamed.
- **Hover / Focus / Active:** All transitions ~`transition-all`; focus-visible draws a 3px indigo ring + border; active nudges down 1px (`translate-y-px`) for tactile feedback. Disabled drops to 50% opacity, pointer-events off.

### Inputs / Fields
- **Style:** `h-8`, `rounded-lg`, transparent background, 1px Hairline border. `text-base` on mobile (prevents iOS zoom), `text-sm` on desktop.
- **Focus:** Border shifts to indigo + 3px `ring-ring/50`. No glow.
- **Error / Disabled:** `aria-invalid` → rose border + rose ring. Disabled → muted fill, not-allowed cursor, 50% opacity.

### Cards / Containers
- **Corner Style:** `rounded-xl` (0.7rem) — one step softer than controls.
- **Surface:** Card White on Paper, separated by `ring-1 ring-foreground/10` (the Hairline Rule), never a shadow.
- **Structure:** Vertical flow, `gap-4`, `py-4` / `px-4` (`sm` size tightens to 3). Footer is a Muted Surface band with a top hairline. Title uses the Title role.
- **Doctrine:** Cards are used only when grouping truly helps. Nested cards are forbidden, and endless identical icon+heading+number card grids are an anti-pattern, not a layout.

### Badges (the status vocabulary)
- **Shape:** Full pill (`rounded-4xl`), `h-5`, `text-xs`, `px-2`. The system's primary way of showing state.
- **Variants:** default (indigo), secondary (muted), destructive (rose tint), outline (hairline), ghost. Pair the semantic status color with a label/icon, always.

### Navigation (App Shell)
- **Sidebar:** A second neutral layer — white with slate text and a hairline border in light theme; deep indigo in *bold*; near-black in *dark*. Active item carries Civic Indigo; width animates on collapse (`220ms` cubic-bezier). Mobile collapses to a sheet.
- **States:** Default slate, hover Muted Surface, active indigo accent + indigo text. Same vocabulary across every role's menu.

### Signature: Workflow Steppers & Status Strips
The spine of the product. Leave/travel/document detail pages render a **stepper** (draft → awaiting signature → approved → completed) and list pages render a **status stat strip** summarizing the queue. These get the most visual prominence on their screens, by design — status is the spine.

## 6. Do's and Don'ts

### Do:
- **Do** keep Civic Indigo as the only brand accent — primary actions, active state, focus rings. One accent per screen.
- **Do** render every number, balance, day count, amount, ID, and email in `font-mono`.
- **Do** draw structure with 1px hairlines and one-step brightness changes; separate cards with `ring-1 ring-foreground/10`.
- **Do** keep body text at or near Ink contrast; verify ≥4.5:1 (≥3:1 for large/bold), including placeholders and muted text on tinted surfaces.
- **Do** pair every status color with a label or icon, for color-blind users.
- **Do** ship the full state set on every control: default, hover, focus-visible, active, disabled, aria-invalid.
- **Do** honor reduced motion and the three density modes; keep transitions in the 150–250ms range.
- **Do** keep Thai legible — sentence case, generous line-height, the Noto Sans Thai stack.

### Don't:
- **Don't** reproduce the cramped legacy Thai-government look: tiny gray-on-gray text, shadow-stacked dense tables, ASP.NET-era forms with no whitespace.
- **Don't** over-minimize to the point HR can't scan dense info — whitespace serves legibility, it doesn't replace data.
- **Don't** add consumer-SaaS decoration (gradient heroes, marketing-style cards, decorative illustrations) or generic AI-dashboard scaffolding (identical icon+number stat-card grids, tracked uppercase eyebrows, gradient accents).
- **Don't** use a warm cream/sand/parchment background; neutrals stay at chroma 0 (or tinted toward indigo, never warm).
- **Don't** use drop shadows on resting surfaces — shadows are only for transient overlays (menus, dialogs, toasts).
- **Don't** use a colored `border-left`/`border-right` thicker than 1px as an accent stripe.
- **Don't** use gradient text (`background-clip: text`) or decorative glassmorphism.
- **Don't** make destructive actions solid-red and loud — tint them (`bg-destructive/10`), signal don't scream.
- **Don't** nest cards, and don't let an eyebrow or `01 / 02 / 03` marker scaffold every section.
