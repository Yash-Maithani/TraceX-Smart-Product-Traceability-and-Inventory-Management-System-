# TraceX Imagery Plan

> Date: 2026-10-24. Status: **Proposed, waiting for Yash's picks.** Nothing is downloaded or changed yet.
> Scope: frontend assets only (`design-assets/`, `src/assets/backdrops/`, backdrop components and CSS). No API, RBAC or route change.

## 1. Why imagery, and the decision it reopens

All 14 backdrop slots are flat placeholders (`placeholder: true`), so the photo pipeline built in Phase 5.1 has never shown a photo. On 2026-10-23 photos were limited to the sign-in pages and the public trace page (D-20 change, `SIGNED_IN_PAGE_BANNERS = false`). Yash now wants photos to carry the look of the product, so this plan **reopens D-20**:

| Where | Proposal | Today |
|---|---|---|
| Signed-in pages | Photo banner behind the page header, 176px desktop, 144px tablet, 112px phone (grows with content), flat scrim so text passes `check:contrast` | Banners switched off |
| Sign-in pages (login, request access, activate, verify OTP, forgot and reset password) | Split layout: photo panel 40% left, form 60% right; on phones a 160px photo band above the form | Empty dark 55% panel |
| Public QR trace page | Full-bleed photo behind one solid content panel | Empty dark frame |

**Needs your confirmation before D-20 changes back** (question 1 in section 7).

## 2. What was checked in TracX-Hemshakti

`frontend/public/` has 7 images (home-hero, about-hero, warehouse-bg, fefo-bg, qr-bg, login-panel, hero). They are AI images with garbled lettering ("ORGNIC PRODUCTS", "AUTHEN TICATED") and fake dashboards ("Firewall: ACTIVE, Intrusions: 0", "0xF4A7E9D2"). Per your instruction, **none are reused**. The useful idea taken from it: one photo per area of the app, so each page feels like a place (fields, warehouse, dock), not a template.

## 3. Rules every image must pass

1. Real photograph, natural light, photorealistic, consistent mood (warm daylight, green and earth tones).
2. No readable text, no garbled lettering, no screens, dashboards, numbers or metrics, no brand logos.
3. No AI artefacts (warped hands, melted objects, impossible geometry).
4. People: only distant or unidentifiable figures. Unsplash and Pexels licences carry no model release, and SPEC §5.2 bans identifiable people unless the licence permits it.
5. Open licence with source page, author and licence recorded in `design-assets/backdrops.json`.
6. Large enough: at least 1920px on the long side for auth and trace, at least 1280px for banners.
7. **Visual check on the actual file** before it ships (I have only read each page's title, description and tags so far). Any candidate that shows text, logos, a face or a screen gets dropped and the other option is used.

## 4. Candidates (2 per key, all real, verified page, author and licence)

Licences:
- **Unsplash License** and **Pexels License**: free for commercial use, attribution not required (credited anyway).
- **CC BY 2.0**, **CC BY-SA 2.0**, **CC BY-SA 4.0** (Wikimedia Commons): attribution required. Share-alike applies to the edited image file.

★ marks my first choice.

| Key (pages) | Option | Subject | Source page | Author | Licence | Why it fits / risk |
|---|---|---|---|---|---|---|
| **auth** (login, request access, activate, verify OTP) | ★A | Terrace farms of Ukhimath, Uttarakhand, rice season | [Commons](https://commons.wikimedia.org/wiki/File:Terrace_Farms_of_Uttarakhand_India.jpg) | Akash Singh | CC BY-SA 4.0 | Portrait 1501 x 2668, ideal for a tall left panel; it is the company's own region |
| | B | Terrace farming in the Uttarakhand hills | [Unsplash](https://unsplash.com/photos/green-grass-field-and-mountain-during-daytime-9qndr_Qh7Rg) | Ketan Pandey | Unsplash License | Landscape; same region; needs a crop for the panel |
| **auth-recovery** (forgot, reset password) | ★A | Terrace farming and irrigation, Uttarakhand | [Commons](https://commons.wikimedia.org/wiki/File:Terrace_farming_and_irrigation_in_Himalayan_state_of_Uttarakhand_India.jpg) | Sharada Prasad CS | CC BY 2.0 | 4288 x 2848; calmer, cooler tones than auth so the two flows feel related but distinct |
| | B | Kumaon village and terraces, Binsar | [Commons](https://commons.wikimedia.org/wiki/File:Terrace_farming_in_a_small_himalayan_village(binsar_wild_life_sanctury).jpg) | Rajborah123 | CC BY-SA 4.0 | 6000 x 4000; shows a house, check that no person is identifiable |
| **dashboard** (`/`) | ★A | Pallet racking aisle in a warehouse | [Unsplash](https://unsplash.com/photos/a-large-empty-warehouse-CeRq-JzKGi4) | Krisana Nakajo | Unsplash License | Strong lines, empty aisle, no people; reads as "stock" at a glance |
| | B | Tea estate rows below a hill, Karnataka | [Unsplash](https://unsplash.com/photos/a-field-of-tea-plants-with-a-hill-in-the-background-nPUPi2FKfGI) | Vasanth Kedige | Unsplash License | Farm-first mood; softer behind tiles |
| **batches** (list, detail, new, archived) | ★A | High stacks of cartons under a blue steel roof | [Pexels](https://www.pexels.com/photo/stacked-boxes-in-a-warehouse-10834810/) | Ihsan Adityawarman | Pexels License | Batches are physical stock; check cartons have no printed brand |
| | B | Warehouse shelves with stacked pallets | [Pexels](https://www.pexels.com/photo/photo-of-warehouse-4481326/) | Tiger Lily | Pexels License | Tidy, even light; good under a dark scrim |
| **fefo** (dispatch queue) | ★A | Warehouse of plastic-wrapped goods ready to ship | [Pexels](https://www.pexels.com/photo/a-warehouse-with-full-stocks-11432049/) | Bill Powers | Pexels License | "Ready to go out" stock; no people |
| | B | Blue forklift in a bright racked warehouse | [Pexels](https://www.pexels.com/photo/forklift-in-a-warehouse-14688882/) | Alex Urezkov | Pexels License | Movement of stock; check forklift has no maker logo in focus |
| **dispatch** (`/dispatch`) | ★A | Delivery van loaded with cartons inside a warehouse | [Pexels](https://www.pexels.com/photo/boxes-in-delivery-truck-in-warehouse-21838827/) | Wojciech Kotlicki | Pexels License | Exactly the dispatch moment; check van livery |
| | B | Cartons stacked at loading dock doors | [Pexels](https://www.pexels.com/photo/cartons-near-warehouse-gates-12585837/) | BOOM Photography | Pexels License | Strong yellow wall; may need a stronger scrim |
| **inspections** | ★A | Stacked crates of fresh vegetables in the field | [Pexels](https://www.pexels.com/photo/a-high-angle-shot-of-plastic-crates-with-vegetables-on-field-10041323/) | Los Muertos Crew | Pexels License | Produce being checked at source; high angle, no faces |
| | B | Crates of ripe tomatoes | [Unsplash](https://unsplash.com/photos/fresh-ripe-tomatoes-fill-these-crates-VV-KRDpSuek) | Serghey Savchuk | Unsplash License | Close, colourful; strong red needs the dark-mode scrim |
| **qr** (scan page) | ★A | Homemade jam jars lined up on a wooden shelf | [Pexels](https://www.pexels.com/photo/clear-glass-mason-jars-48817/) | Pixabay (contributor) | Pexels License | Packed product, which is what a QR code sits on; check jar lids for text |
| | B | Pantry shelves with glass jars and greenery | [Pexels](https://www.pexels.com/photo/wooden-shelves-with-glass-jars-filled-with-various-ingredients-5490824/) | Rachel Claire | Pexels License | Warmer, softer; check for labels |
| **trace-public** (public QR trace) | ★A | Apple orchards at Chaubatia, Ranikhet, Uttarakhand, early morning | [Commons](https://commons.wikimedia.org/wiki/File:Apple_orchards_in_Chaubatia,_Ranikhet,_Uttarakhand.jpg) | Harshit SR | CC BY-SA 4.0 | 7000 x 3158, wide; tells a shopper "this came from the hills of Uttarakhand" |
| | B | Assorted vegetables in a green crate at a farmers' market | [Unsplash](https://unsplash.com/photos/53f1vbOG7y8) | Ashley Winkler | Unsplash License | Food-first; good if the batch is produce rather than orchard fruit |
| **team** (team and access) | ★A | Desk with notebook, pencil and plant | [Unsplash](https://unsplash.com/photos/a-desk-with-a-notebook-headphones-and-a-potted-plant-T7yUACjd3hU) | Kelly Sikkema | Unsplash License | Quiet admin mood; no screen |
| | B | Farm workers in a rice field, Odisha | [Unsplash](https://unsplash.com/photos/a-group-of-people-working-in-a-field-GX94kzfVaYY) | Jagamohan Senapati | Unsplash License | "The team" literally; only usable if figures are distant and unidentifiable |
| **import** (bulk CSV import) | ★A | Person filling a form on a clipboard beside a parcel | [Pexels](https://www.pexels.com/photo/person-writing-on-paper-on-a-clipboard-6170191/) | Tima Miroshnichenko | Pexels License | Paper records becoming digital; risk: the form may have readable text (crop or blur-free scrim) |
| | B | Worker holding a box and a checklist | [Pexels](https://www.pexels.com/photo/clipboard-with-data-on-top-of-box-6170102/) | Tima Miroshnichenko | Pexels License | Same idea; same text risk, plus a person |
| **notifications** (notifications, messages) | ★A | Open notebook, pen, mug and plant on a desk | [Pexels](https://www.pexels.com/photo/stationery-near-mug-and-plant-7319189/) | Angela Roma | Pexels License | Calm "inbox" mood; check notebook is blank |
| | B | Coffee, notebook and pen on wood | [Pexels](https://www.pexels.com/photo/cup-of-coffee-and-notebook-with-pen-4195328/) | Karola G | Pexels License | Blank page from above |
| **settings** (profile, settings) | ★A | Fountain pen on an open notebook beside a mug | [Pexels](https://www.pexels.com/photo/fountain-pen-on-top-of-notebook-beside-drinking-mug-64776/) | FreePhotos.cc | Pexels License | Personal, quiet |
| | B | Potted plant on a wooden desk | [Unsplash](https://unsplash.com/photos/a-potted-plant-sitting-on-top-of-a-wooden-desk-z4lEDEwIMQc) | Robert Bye | Unsplash License | Tags mention a monitor: drop if a screen is visible |
| **default** (privacy, terms, styleguide, not found) | ★A | Garhwal Himalaya range above forests | [Commons](https://commons.wikimedia.org/wiki/File:Garhwal_Himalayas_Uttarakhand.jpg) | Paul Hamilton | CC BY-SA 2.0 | 3612 x 2500; neutral, wide, the region |
| | B | Almora hills and clouds | [Commons](https://commons.wikimedia.org/wiki/File:Almora_Uttarakhand.jpg) | SureshChandraPandey | CC BY-SA 4.0 | Portrait 2448 x 3264; needs a landscape crop |

Considered and rejected:
- **All 7 Hemshakti images:** garbled text and fake screens.
- **Unsplash "truck at a loading dock, Port of Manila"** (PortCalls Asia): a container terminal, likely shipping-line logos.
- **Unsplash "pears/apples in crates, cold storage"**: Unsplash+ (paid), credited to Getty Images.
- **Commons "Binsar, a view of Kumaon Himalayas"**: only 1024px wide.
- **Unsplash "empty room with a wooden table"** (Pascal Meier): it is a ping-pong table.

### Real vs AI

**14 of 14 keys have two real candidates. AI images needed: 0 (100% real).** The AI fallback you approved stays unused unless a visual check rejects both options for a key. In that case I'll ask before generating anything.

## 5. Treatment

| Item | Plan |
|---|---|
| Scrim | Flat colour, no gradient (gradients stay banned). Per-palette `--backdrop-scrim` lowered from 0.82 to about **0.60 light / 0.70 dark**, so the photo shows while white text still passes 4.5:1 over a worst-case white pixel (already checked by `check:contrast`: a 0.55 black over white gives about 4.8:1). Final values come from `check:contrast`, not by eye. |
| Grade | One shared tint per palette under the scrim (editorial warm, obsidian cool slate, emerald green), via a new `--backdrop-tint` token, so all 14 photos feel like one set. |
| Loading | Auth image `fetchpriority="high"` and eager; banners lazy below the fold, eager when they are the header; `width`/`height` set; AVIF, WebP, JPEG at 640, 1280, 1920 (pipeline exists). |
| Weight | Existing budgets: banner 60 KB at 640 and 120 KB at 1280, auth and trace 250 KB at 1920. First sign-in load adds at most 250 KB; a signed-in page adds at most 120 KB. Both far below the 1.5 MB cap. |
| Accessibility | `alt=""` and `aria-hidden="true"` (decorative); content always on solid panels; Save-Data, the "Page photos" switch and print all hide photos with zero layout shift (already built). |
| Credits | New "Photo credits" section on the Privacy Policy page, listing photographer, source and licence for every image (required for the CC BY and CC BY-SA files, courtesy for Unsplash and Pexels). |
| Files | Originals in `design-assets/originals/<key>.jpg` (no hotlinking); `backdrops.json` filled with `source`, `author`, `licence`, `licenceUrl`, `approvedByOwner: true`, `placeholder: false`, `objectPosition`, `aiGenerated: false`; `npm run prepare:backdrops` builds the 126 sized files. |

## 6. Gate changes

`scripts/check-backdrops.mjs` will fail when any entry:
- has `placeholder: true`
- is missing `source`, `author`, `licence` or `licenceUrl`
- has `aiGenerated: true` without `approvedByOwner: true` and an `aiTool` / `aiPrompt` record

`check-banned-patterns.mjs` already catches em dashes in UI copy and gradients in CSS (extended in R1).

## 7. What I need from you

1. Turn photo banners back on for signed-in pages and use the split sign-in layout? (yes / no)
2. Picks: say "all ★" or name the keys where you want option B.
3. May I download the 14 chosen originals (about 2 to 10 MB each, about 60 MB in all, from Wikimedia, Unsplash and Pexels) into `design-assets/originals/`? Downloading needs your OK.
4. Unsplash and Pexels use their own free licences, not CC. Both allow commercial use without attribution. Accept them alongside CC BY and CC BY-SA? (yes / no)

## 8. Final picks (2026-10-24)

Yash left the picks to Claude. After the visual check (text, logos, faces, screens, artefacts):

| Key | Used | Note |
|---|---|---|
| auth | B, Ketan Pandey (Unsplash) | |
| auth-recovery | ★A, Sharada Prasad CS (CC BY 2.0) | |
| dashboard | B, Vasanth Kedige (Unsplash) | cropped |
| batches | B, Tiger Lily (Pexels) | cropped |
| fefo | ★A, Bill Powers (Pexels) | cropped |
| dispatch | B, BOOM Photography (Pexels) | cropped |
| inspections | ★A, Los Muertos Crew (Pexels) | cropped |
| qr | ★A, Pixabay (Pexels) | |
| trace-public | ★A, Harshit SR (CC BY-SA 4.0) | |
| team | ★A, Kelly Sikkema (Unsplash) | cropped |
| import | Serghey Savchuk (Unsplash), listed as inspections B | both import options showed form text; cropped |
| notifications | ★A, Angela Roma (Pexels) | cropped |
| settings | ★A, FreePhotos.cc (Pexels) | |
| default | ★A, Paul Hamilton (CC BY-SA 2.0) | |

AI images used: 0. Credits are on the Privacy page, read from `backdrops.json`. Details: [phase-r4](../progress/phase-r4.md).
