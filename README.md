# MobilityXchange

Branded to the logo: black, red (#d40d1f) and white. Dark is the default, and the sun/moon button in the header switches to light mode (the choice is remembered on that phone).

Static PWA: Home (town + budget filters, TikTok videos), Car page (`/c/KBZ123X`), Sell form (`/sell`).
No build step. Plain HTML, CSS and JS.

## 1. Set your details (config.js)
- `WHATSAPP`: your number as digits only, e.g. `254712345678`
- `TOWNS`, `TIMS_SEARCH_FEE`, `DELIVERY_FROM`: adjust as needed

## 2. Connect Supabase
1. Create a project, open **SQL Editor**, paste `supabase.sql`, run it.
2. **Project Settings > API**: copy the Project URL and the **anon** key into `config.js`.
   Never use the `service_role` key in this project, config.js is public.
3. Add cars in **Table Editor > cars**. A car only shows when `status = published`.
   - `reg`: uppercase, no spaces (`KBZ123X`)
   - `tiktok_url`: the full video link containing `/video/<digits>`
   - `photos`: upload to the `car-photos` bucket, paste the public URLs as a text array
   - `logbook_status`: set to `clear` only after you have actually checked it
   - `owner_verified`, `tims_checked`: set to true only when done. The badges follow these fields.
4. Seller submissions land in **seller_submissions**. Their logbook and ID are in the private `seller-docs` bucket.

While Supabase fields in `config.js` are empty, the site runs on the sample cars in `data.js` and shows a demo banner.

## 3. Deploy (free)
Push this folder to GitHub, then either:
- **Netlify**: Add new site > Import from Git. No build command, publish directory `.`. (`_redirects` is included.)
- **Vercel**: Import the repo, framework "Other". (`vercel.json` is included.)

## 4. Install on your phone
Open the live URL in Chrome > menu (three dots) > **Install app** / **Add to Home screen**.

## 5. Custom domain
Buy `mobilityxchange.co.ke`, then add it in Netlify/Vercel > Domains and follow the DNS steps.

## Logo and icons
`img/logo.png` (header/hero) and `icons/` (app icon, maskable icon, favicon) were cut from your logo. If you get a higher-resolution or SVG logo, replace those files and the hero will look sharper on big phone screens.

## After you change any file
Bump `VERSION` in `sw.js` (e.g. `mx-v3`) so phones fetch the new version.

## Before you collect IDs and logbooks
You are handling personal data. In Kenya you may need to register with the Office of the Data Protection Commissioner (ODPC). Check the current requirements.
