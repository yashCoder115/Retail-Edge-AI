# RetailEdge AI

**Privacy-preserving Edge AI for real-time retail intelligence.**
Built for Smart India Hackathon 2026.

CCTV / Smart Camera → Video Pre-Processing → Edge AI Inference → Shopper /
Shelf / Queue Analytics → Analytics & Decision Engine → Alerts &
Recommendations → Local Retail Dashboard → Optional Cloud Sync.

---

## Project structure

```
retailedge-ai/
├── index.html               # Vite entry HTML (loads /src/main.jsx)
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── retailedge-ai.jsx        # Canonical dashboard component (single source of truth —
│                              also the file to open as a Claude Artifact)
├── src/
│   ├── main.jsx             # ReactDOM root, mounts <App />
│   ├── App.jsx              # Re-exports the default export from ../retailedge-ai.jsx
│   └── index.css            # Tailwind directives
├── backend/
│   ├── main.py               # FastAPI service: demo-mode engine + REST/WS API
│   └── requirements.txt
└── README.md
```

`retailedge-ai.jsx` at the project root stays the single source of truth for the
dashboard (and is what you'd paste into a Claude Artifact). `src/App.jsx` simply
re-exports it (`export { default } from "../retailedge-ai.jsx"`) so the Vite app
and the artifact never drift out of sync.



## Why demo mode

Real-time YOLO inference needs a camera and, ideally, a GPU — neither is
guaranteed in a judging environment. Per the brief's implementation rule, the
architecture is fully inference-ready, but ships with a realistic simulated
detection/tracking stream so the *entire* pipeline — spawning tracks, zone
occupancy, queue buildup, shelf depletion, threshold-based alerts,
recommendations — visibly runs end-to-end without external dependencies.

## Running the frontend

```bash
npm install
npm run dev
```

Open **http://localhost:5173/** — verified: `npm install` completes cleanly,
`npm run build` produces a working production bundle, and the dev server
serves HTTP 200 on `/`, `/src/main.jsx`, `/src/App.jsx`, and `/retailedge-ai.jsx`
with no import-resolution errors.

## Running the backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Docs: `http://localhost:8000/docs`

Key endpoints:

| Method | Path                     | Purpose                                   |
|--------|--------------------------|--------------------------------------------|
| POST   | `/api/demo/start`        | Reset + start a scenario (`normal`/`peak`/`crisis`) |
| GET    | `/api/metrics/snapshot`  | Advance one tick, return KPI snapshot      |
| GET    | `/api/tracks`            | Current anonymous shopper tracks           |
| GET    | `/api/alerts`            | Alert log (severity, reason, recommendation) |
| GET    | `/api/shelf`             | Shelf Zone A/B occupancy + stock status    |
| GET    | `/api/queue`             | Queue length, status, average wait         |
| WS     | `/ws/live`                | Push snapshot + alerts every 1.6s          |

## Privacy by design

- No facial recognition, no raw identity storage — shoppers are tracked only
  by anonymous session-scoped track IDs (`T-001`, `T-002`, …).
- Inference and storage are local by default; Cloud Sync is an explicit,
  off-by-default toggle that (when on) transmits only anonymized aggregate
  metrics, never raw video or per-person identity.

## Decision engine rules (MVP)

| Condition                          | Alert / Recommendation                          |
|-------------------------------------|--------------------------------------------------|
| Queue length > 8                    | "Long Queue" — open an additional checkout counter |
| Queue length > 14                   | High congestion — deploy staff / open backup counters |
| Shelf Zone A/B occupancy < 30% / 25% | Potential stock-out — restock required           |
| Footfall rising rapidly (> 65/hr)   | Prepare additional staff                          |

## Known MVP limitations (stated honestly, not hidden)

- Shelf monitoring uses ROI-based occupancy, not SKU-level product
  classification — results are reported as "Potential Stock-Out," never as
  exact inventory counts.
- The shipped detection stream is simulated (DEMO_MODE); the real-inference
  seam (`DetectionEngine.step()` in `backend/main.py`) is implemented but not
  wired to a live camera in this submission.
