# Product

## Register

product

## Users

A single Thai agency/office of roughly 100 people, in four strict roles:

- **Employee** — submits their own leave, travel, and document requests; checks balances, status, and history. Often not highly technical; some are older staff. Bilingual context, but the working language is Thai (พ.ศ. dates, Thai names and titles).
- **Manager** — read-only across all personnel data; approves/rejects requests; reviews reports. In a decision-making flow, scanning queues.
- **HR** — the power user. Inputs data on behalf of paper-channel employees, manages every request type, uploads scanned signed documents, generates official .docx orders, runs reports. Processes many records per session, so density and speed matter most here.
- **Admin** — full system access, document templates, import/export, settings.

Context of use: desktop-first at an office, mixed with the physical "paper channel" — HR keys in data from paper forms, prints generated orders, routes them for wet-ink signature, then scans and uploads. The UI is a system of record people must trust, not a place they linger.

## Product Purpose

A comprehensive HR Management Information System built around a **hybrid workflow**: it accommodates both digital self-service requests and a physical paper trail where HR acts on an employee's behalf and tracks where the paper currently sits. Core modules: leave management (sick, personal, maternity, vacation — vacation being the most complex, with accumulated-day math and up to 3 acting substitutes), official travel requests with two-phase budget tracking (estimated vs. actual disbursed) and auto-generated Word orders, attendance summaries, training history, and document tracking.

Success looks like: HR finishing a request in fewer steps with zero ambiguity about status; managers clearing an approval queue at a glance; employees trusting that what they submitted is recorded correctly. The tool should disappear into the task.

## Brand Personality

**Calm, trustworthy, institutional.** Three words: *steady, legible, unsurprising.* Quiet government-grade reliability — nothing flashy, everything predictable. The indigo identity already in the codebase signals competence without shouting. Voice is plain and direct (in Thai), never playful or marketing-toned. The interface should lower anxiety around leave, pay-adjacent records, and official paperwork, not add to it.

## Anti-references

- **Legacy Thai government software** — cramped tables, tiny gray-on-gray text, ASP.NET-era forms with no whitespace, illegible density. This is the thing to escape: stay dense where HR needs it, but readable, well-spaced, and modern.
- **Over-minimal / sparse interfaces** — stripping away so much that HR staff can't find dense information quickly. Form must not win over function; whitespace serves legibility, it doesn't replace data.
- (Shared) Flashy consumer-SaaS decoration and generic AI-dashboard scaffolding (identical icon+heading+number stat cards, eyebrow kickers, gradient accents) are off-brand for a system of record.

## Design Principles

1. **Trust through legibility.** Every status, date, balance, and amount is unambiguous at a glance. Contrast and type clarity are non-negotiable — escaping the gray-on-gray legacy look is a core goal, not a nicety.
2. **Density without cramming.** HR is a power user processing many records; serve real information density, but earn it with spacing rhythm and hierarchy rather than shrinking everything.
3. **Status is the spine.** This is a workflow system. Where a request *is* (and what happens next) is always the most prominent thing — steppers, status strips, and queues over decorative chrome.
4. **One vocabulary across roles and channels.** The same button, form control, table, and status language everywhere — digital self-service and HR's paper-channel data entry share affordances, so nothing feels invented per screen.
5. **Quiet by default, loud only for state.** Color and motion carry meaning (approved, awaiting signature, completed, error), never decoration. The system stays calm so that signals stand out.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text ≥4.5:1, large text ≥3:1, including placeholder and muted text on tinted surfaces. Full keyboard navigation and visible focus rings (already ring-driven in the token system). Every animation needs a `prefers-reduced-motion` alternative. Honor the existing density modes (compact/normal/large) and bilingual type stack (Inter + Noto Sans Thai) — the **large** density and clear Thai rendering matter for older, less tech-savvy staff. Color must never be the sole carrier of status (pair with label/icon), for color-blind users.
