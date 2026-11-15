# Aap ka Khet · آپ کا کھیت

**Crop planning for Pakistani farmers, built on NASA Earth observations — in Urdu and English.**
NASA Space Apps Challenge 2026 · Challenge: **Field Shift: Adapting Farms with NASA Data** · Team **Shaheen X**

**Live app:** https://aapkakhet.readhaven.online · **API repo:** [nasa_backend](https://github.com/Aqeel0317/nasa_backend)

A farmer tells the app where their farm is, what they grow and how much water they have. The app reads
NASA data for that exact place and answers three questions in plain words:

1. **What should I do today?** Water or not, for each field, and when the next watering is due.
2. **What would a disaster cost me?** Drought, heatwave or heavy rain — the loss in rupees, played out
   on a 3D model of the farm.
3. **Which rotation is better for next season?** The farmer's current rotation next to five genuinely
   different alternatives, each with its evidence, benefits, information gaps and risks.

---

## What a farmer sees

| Page | What it does |
|---|---|
| **Today** | Per-field "what to do today" (with the next irrigation date), the week's forecast, the last 14 days from NASA satellites, NASA SMAP soil moisture, and the year's biggest risk in rupees. **Listen** reads it aloud; **Send on WhatsApp** shares it. |
| **My fields** | Up to four fields (summer + winter crop, acres). Test normal weather, drought, heatwave or heavy rain; see the loss in rupees, which field holds up best, waterlogged days, and a day-by-day 3D farm. |
| **Next season** | Three taps (place, water, what matters most) plus farm size, soil type, how you sell, your own mandi prices and your equipment. |
| **Plans** | Your current rotation first, then five strategies — best overall, least water, best for soil, safest in a hotter future, best earning — each explained with **Why · Evidence (NASA dataset, value, date, link) · Benefits · Information gaps · Risks**. |
| **Field · Crops · Soil** | The climate of the field, weather risks, soil, satellite greenness; how well each crop fits now and by 2041–2050 (with hot days and water need); and whether a plan builds or drains the soil. |

### Built for farmers, not experts

- **Urdu and English** throughout (Noto Nastaliq, right-to-left layout), with money in rupees and
  harvests in maunds per acre.
- **Narrated "How to use" guides** on every page and a **voiced farm setup** — English and native Urdu
  voices — so reading is not required.
- **Plain-language explanations** of NDVI, evapotranspiration, soil moisture, water balance and frost.
- **Data sources with links** on the page; anything the model computes is labelled as an estimate.
- Every page is designed to work at **360 px** phone width.
- Honest by design: *"Check with your local agriculture officer before big changes."*

## NASA data in the app

| NASA dataset | Where farmers see it |
|---|---|
| **NASA POWER** | Today's last-14-days panel, field climate, very hot days, the running season's weather |
| **NASA MODIS NDVI** (via NASA GIBS) | How green the farmland has been, crop cycles per year, bare-soil time |
| **NASA SMAP L4** soil moisture | Today's root-zone soil moisture and every plan's evidence |
| **NASA EONET** | Storms, floods and fires happening now near the farm |

Plus ISRIC SoilGrids (soil), Open-Meteo (forecast) and the Open-Meteo CMIP6 Climate API (2041–2050).
See the [API repo](https://github.com/Aqeel0317/nasa_backend) for how each one is read and modelled.

## Tech

- **React 18 + Vite 6**, plain CSS with light/dark themes, `lucide-react` icons, `recharts` charts,
  `three.js` for the 3D farm (loaded only when needed).
- **Cloudflare Worker** (`worker/index.js`) serves the built app and proxies `/api/*` to the Azure API,
  so the browser talks to one origin (no CORS). A cron trigger pings the API every 10 minutes to keep the
  free tier warm.
- **Light on bandwidth:** pages load on demand, results are cached in the browser per farm (and dropped
  automatically when the model changes), and the narration clips are small mono MP3s.
- **One farm profile** (`src/farmProfile.js`) shared by every page — location, water, fields, prices —
  so a change on one page is the same everywhere and survives a reload.
- **Never a blank screen:** if a deploy replaces files while a page is open, the app reloads once; any
  page that fails shows a reload message instead.

## Run locally

Requires Node 20+. The API should be running on port 8000 (see the API repo).

```bash
npm install
npm run dev            # http://localhost:5173 (proxies /api to http://localhost:8000)
npm run build          # production build in dist/
```

## Deploy

```bash
npx wrangler login
npm run deploy         # vite build && wrangler deploy
```

`wrangler.jsonc` serves `dist/` as static assets with single-page-app fallback, routes `/api/*` to the
Worker, sets `API_ORIGIN`, and binds the custom domain. `wrangler.staging.jsonc` deploys a separate
staging copy on workers.dev for checking changes before they go live.

## Project layout

```
src/
  App.jsx                routes, planner state, error boundary
  farmProfile.js         the one shared farm profile
  farmCache.js           browser cache of farm results (versioned)
  i18n.jsx               every string in English and Urdu
  weather.js             forecast, places, auto weather scenario
  pages/                 Landing, Farm (Today + My fields), Setup, Plans, Field, Crops, Soil, Tour
  components/farm/       Today card, disaster panel, fields, 3D/2D farm, live NASA panel,
                         setup wizard, narrated guide, glossary, data sources
public/guide, public/tour   narration clips (English + Urdu)
worker/index.js          Cloudflare Worker: static assets + /api proxy + keep-warm cron
```

## Team

**Shaheen X** — NASA Space Apps Challenge 2026.

## Use of AI

The code was written with the help of an AI coding assistant. The narration in the guides and the tour
is AI-generated speech (Deepgram, Azure AI Speech). All data comes from NASA and the open sources listed
above; no data is AI-generated.
