# TraceX UI/UX Research (shipped products and official docs)

> Date: 2026-10-23. Synthesised with the research-synthesis skill.
> Sources are shipped products and their official design-system or product docs. No Dribbble or Behance shots were used. We take ideas only; no branding, layouts, copy or assets are copied.
> UXKIN and Figma were not connected in this session, so no UXKIN comparisons were made.

## Summary

Shipped operations tools converge on four habits that TraceX is missing: a keyboard way to jump to any record, filters that sit in one compact row and say when they are active, tables tuned for scanning (fixed row heights, sortable headers, a density choice), and status shown as a short sentence-case label with an icon. Dashboards that work answer one question and order tiles by urgency, not by data type. Consumer trace pages lead with origin and dates in plain words, not with internal codes.

## Theme 1: Navigation and finding things

| Idea | Source | Verdict |
|---|---|---|
| Ctrl/Cmd+K command menu that opens any page or runs an action by name. | [Linear: navigating Linear](https://linear.app/enablement/guide/navigating-linear) | **Adopt.** Pages plus batch search through the existing search endpoint. |
| `/` focuses search; typing an identifier (like `LIN-123`) jumps straight to it. | [Linear: navigating Linear](https://linear.app/enablement/guide/navigating-linear) | **Adopt.** Typing a full `TX-YYYY-MM-NNN` in the palette opens that batch. |
| `?` opens a searchable shortcuts list. | [Linear changelog: keyboard shortcuts help](https://linear.app/changelog/2021-03-25-keyboard-shortcuts-help) | **Adopt** (small dialog listing Ctrl+K, /, ?, G then D/B/F). |
| Two-key "G then X" go-to shortcuts. | [Linear: navigating Linear](https://linear.app/enablement/guide/navigating-linear) | **Adopt, limited** to 4 destinations so it stays learnable. |
| Sidebar grouped by personal work vs shared areas. | [Linear: navigating Linear](https://linear.app/enablement/guide/navigating-linear) | **Adopt** as Operations / Team groups. |

## Theme 2: Dense data tables

| Idea | Source | Verdict |
|---|---|---|
| Fixed row sizes 24/32/40/48/64px; header matches row size; 40px default. | [Carbon: data table usage](https://carbondesignsystem.com/components/data-table/usage/) | **Adopt** three densities: 32 compact, 40 default, 48 comfortable. |
| Sort arrow shows on hover; only the sorted column keeps it. | [Carbon: data table usage](https://carbondesignsystem.com/components/data-table/usage/) | **Adopt.** |
| Toolbar holds at most five global actions; extra go to an overflow menu. | [Carbon: data table usage](https://carbondesignsystem.com/components/data-table/usage/) | **Adopt.** |
| Batch action bar replaces the toolbar when rows are selected. | [Carbon: data table usage](https://carbondesignsystem.com/components/data-table/usage/) | **Reject for now.** No bulk endpoints; N single calls would be slow and partial failures confusing. |
| Skeletons over spinners when load time is noticeable; avoid frame-only skeletons. | [Carbon: data table usage](https://carbondesignsystem.com/components/data-table/usage/), [NN/g: skeleton screens](https://www.nngroup.com/articles/skeleton-screens/) | **Adopt.** Table-shaped and tile-shaped skeletons; nothing under 1s. |
| Zebra stripes as an optional aid. | [Carbon: data table usage](https://carbondesignsystem.com/components/data-table/usage/) | **Reject.** Row hover plus 1px dividers is enough and quieter. |
| Filter chips: "suggested" chip with + opens a menu; active chip shows the value and a clear button; "Clear filters" link only when something is active; chip label matches column header. | [Stripe Apps: filter controls](https://docs.stripe.com/stripe-apps/patterns/filter-controls) | **Adopt** for status, SKU, verdict filters. |
| Filter the data before counting so counts and pagination stay accurate. | [Stripe Apps: filter controls](https://docs.stripe.com/stripe-apps/patterns/filter-controls) | **Adopt** (already server-side; show the filtered total in the header). |

## Theme 3: Status and colour

| Idea | Source | Verdict |
|---|---|---|
| Semantic lozenges for workflow status, sentence case, short labels, never colour alone. | [Atlassian: lozenge](https://atlassian.design/components/lozenge/usage) | **Adopt.** Replace ALL CAPS badges. |
| Keep bold/filled styles rare so critical states stand out. | [Atlassian: lozenge](https://atlassian.design/components/lozenge/usage) | **Adopt.** Only Expired and On hold get the strong style. |
| Colour scales with fixed roles per step (backgrounds, borders, text). | [Vercel Geist: colors](https://vercel.com/geist/colors) | **Adopt the method** for status tokens (bg / border / text per status). |
| Pill-shaped (9999px) badges. | [Vercel Geist reconstruction](https://open-design.ai/zh/plugins/design-system-vercel/) | **Reject.** Breaks HARD UI RULE 2. |

## Theme 4: Dashboards that tell a story

| Idea | Source | Verdict |
|---|---|---|
| Each dashboard answers one question; general to specific; show only what is in trouble. | [Grafana: dashboard best practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/) | **Adopt.** The question is "What needs action today?" |
| Stat panels for single current values with meaningful threshold colours. | [Grafana stat thresholds (AWS docs)](https://docs.aws.amazon.com/grafana/latest/userguide/thresholds.html) | **Adopt.** Tiles turn to their status colour only when the count is above zero. |
| Expiry plus a separate "removal" date earlier than expiry drives FEFO picking. | [Odoo 18: FEFO removal](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies/fefo.html) | **Adopt the idea, not the field.** Show days left as a bar against total shelf life (pack to expiry). No new data. |
| Configurable 30/60/90-day alert thresholds. | [ECOSIRE Odoo app listing](https://ecosire.com/de/apps/odoo/lot-serial-expiry-traceability) | **Reject.** Tiers are fixed by the backend (D-16); vendor claim. |

## Theme 5: Batch journey and timelines

| Idea | Source | Verdict |
|---|---|---|
| Vertical timeline: badge icon, connecting line, body; condensed items for minor events; breaks between groups (state the meaning in text, breaks are not announced). | [Primer: timeline](https://primer.style/product/components/timeline/) | **Adopt** for batch detail (packed, inspections, note edits, dispatches, first and last scan, comments). |

## Theme 6: Empty states and confirmations

| Idea | Source | Verdict |
|---|---|---|
| Three empty-state kinds: first use (explain + create), temporarily empty, error (alert icon, no playfulness, a fix). | [Primer: empty states](https://primer.style/product/ui-patterns/empty-states/) | **Adopt.** Add "no match" with a Clear filters action as a fourth kind. |
| Specific confirmations naming the item and effect; buttons say the outcome ("Archive batch" / "Keep batch"); safe option is default. | [NN/g: confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/) | **Adopt** for archive, delete user, reject request, rollback import, dispatch override. |
| Undo instead of confirm where possible. | [NN/g: confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/) | **Reject for archive** (server action with audit; restore exists on Archived page). |

## Theme 7: Consumer QR trace page

| Idea | Source | Verdict |
|---|---|---|
| Scanning shows who grew it, where, and the product's journey. | [INI Farms case (Agrivi retail)](https://www2.agrivi.com/industries/retail) | **Adopt partly.** Village and journey dates only; farmer name stays private (SPEC privacy rules). |
| QR resolves to provenance plus a genuine-product confirmation. | [GS1 Netherlands: Friso case study (PDF)](https://mocdn.gs1.org/system/files/gs1netherlands-case-study-friso.pdf) | **Adopt** a plain "This is a recorded TraceX batch" line with the batch code. |
| Marketing page around the trace data. | [AgSights (University of Alberta)](https://livestockgentec.ualberta.ca/?p=1407) | **Reject.** HARD UI RULE 4; the page states facts only. |

## Typography evidence

| Idea | Source | Verdict |
|---|---|---|
| Inter: OFL licence, tabular figures (`tnum`) for aligned table numbers. | [Inter](https://rsms.me/inter/) | **Considered.** Very common default; IBM Plex is proposed instead (DESIGN.md). |

## Opportunities ranked

| Insight | Opportunity | Impact | Effort |
|---|---|---|---|
| Users cannot jump to a batch | Ctrl+K palette | High | Medium |
| Dispatch staff cannot see holds | On-hold state in FEFO and badges | High | Low |
| Dashboard has no "act now" view | Needs-action row + shelf-life bar | High | Medium |
| Tables wrap and are tall | Column rules, density, sticky header | Medium | Low |
| Shoppers see internal tiers | Plain consumer trace page | Medium | Low |

## Method notes

- Sites studied through official docs pages, fetched on 2026-10-23. Polaris IndexTable docs could not be fetched (connection closed), so it is not cited.
- Vendor listings (Odoo app store) are self-reported and used only as a contrast.

## Theme 8: Photography with dense UI (added 2026-10-24)

| Idea | Source | Verdict |
|---|---|---|
| Put text on photos only with a scrim or a uniform overlay, and test contrast against the real image, including its brightest parts. | [Smashing: accessible text over images](https://smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1), [Acquia: text over images contrast](https://docs.acquia.com/web-governance/does-text-over-background-image-meet-minimum-contrast-requirements) | **Adopt.** `check:contrast` already tests a worst-case white pixel under the scrim. |
| Scrims are translucent layers for text protection; target only the area that holds text on large surfaces. | [Material Design: imagery, text protection](https://m1.material.io/style/imagery.html) | **Adopt as a flat scrim.** Reject the gradient form (HARD UI RULE 1 and SPEC §5.2 ban gradients). |
| A uniform 30% to 70% dark overlay as a starting point. | [UX Collective: text over background images](https://uxdesign.cc/techniques-to-display-text-over-background-images-b089de1cc8bc) | **Adopt** about 0.60 light and 0.70 dark, then let the contrast gate decide. |
| Split sign-in: brand visual on one side, form on the other; reuse the same shell for sign-up and password reset; stack on phones. | [Dash design patterns: auth split-screen](https://brand.dash.fi/patterns/auth-split-screen), [UX Planet: split screen design](https://uxplanet.org/best-practices-for-split-screen-design-ad8507d92e66) | **Adopt** (40% photo, 60% form, so the form stays dominant). |
| Do not split one sign-in into two steps (email, then password) without a reason such as SSO. | [Smashing: 2-page login pattern](https://www.smashingmagazine.com/2024/06/2-page-login-pattern-how-fix-it) | **Adopt** (keep the single form). |
| Dense consoles (Linear, Stripe, Vercel, Grafana) keep photos out of tables and charts entirely. | Product docs studied in Themes 1 to 4 | **Adopt.** Photos only in page headers, sign-in and the public trace page; never behind tables, forms or numbers. |
| Consumer QR pages lead with origin (who grew it, where). | [Agrivi retail (INI Farms case)](https://www2.agrivi.com/industries/retail) | **Adopt** a real orchard photo from the company's own region on the trace page. |
