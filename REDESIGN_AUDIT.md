# TimmyTails Redesign V2 — Architecture Audit

## Design direction
The application now uses a warm, premium pet-care visual system rather than the previous purple theme/recolor approach. The system separates brand colors from semantic state colors and uses white content surfaces against a soft bone canvas.

### Core palette
- Ink: `#13231B`
- Secondary ink: `#405148`
- Evergreen: `#2F6B57`
- Deep evergreen: `#1F4D3E`
- Sage: `#DCE9E0`
- Canvas: `#F6F7F2`
- Surface: `#FFFFFF`
- Coral accent: `#E8795B`
- Border: `#DDE4DE`

Success, warning, and destructive states use separate semantic greens, ambers, and reds rather than the brand accent.

## Structural redesign
- Global shell: rebuilt header, mobile navigation, footer, type hierarchy, focus states, spacing, surfaces, and action styles.
- Home: asymmetric editorial hero, layered visit-flow content, service comparison layout, process section, gallery, and salon story composition.
- Services: large-format service comparison instead of a repeated card grid.
- Login: full-height editorial image panel paired with a focused authentication workspace.
- Customer dashboard: welcome/action panel, next-visit module, compact metrics, visit workspace, and pet rail.
- Appointments: visit-timeline layout with upcoming/history metrics and clearer action hierarchy.
- My Pets: household-style profile workspace with larger pet records and less dashboard-card repetition.
- Admin: persistent desktop operations rail plus dedicated content workspace; customer access management uses clear state controls and semantic account-status indicators.
- Booking: neutral white task surfaces, clearer step/selection states, accessible controls, and reduced decorative color noise.
- About / Contact: editorial split layouts instead of generic stacked cards.

## Persistence architecture retained
MongoDB `accountStatus` remains the single source of truth. Status changes are persisted before UI confirmation, API responses return the persisted value, and page refresh renders the database value without inferring enforcement from notification copy.
