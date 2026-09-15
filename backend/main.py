"""
RetailEdge AI - Backend API
============================

FastAPI service that powers the RetailEdge AI dashboard.

Design goal: the API surface is identical whether detections come from a
real on-device YOLO + ByteTrack pipeline, or from DEMO_MODE's simulated
detection stream. This means the SAME frontend / SAME endpoints work
during judging even on machines without a GPU or a camera, while the
codebase is architecturally ready to swap in live inference.

Run:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Docs:
    http://localhost:8000/docs
"""

import os
import random
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
DEMO_MODE = os.getenv("RETAILEDGE_DEMO_MODE", "1") == "1"
DB_PATH = os.getenv("RETAILEDGE_DB_PATH", "retailedge.db")

QUEUE_ALERT_THRESHOLD = 8
QUEUE_CRITICAL_THRESHOLD = 14
SHELF_A_LOW_THRESHOLD = 30
SHELF_B_LOW_THRESHOLD = 25
FOOTFALL_SPIKE_THRESHOLD = 65

SCENARIOS = {
    "normal": dict(footfall_target=34, spawn_rate=0.35, queue_drift=0.02, shelf_drain=0.03),
    "peak": dict(footfall_target=78, spawn_rate=0.70, queue_drift=0.05, shelf_drain=0.06),
    "crisis": dict(footfall_target=58, spawn_rate=0.55, queue_drift=0.16, shelf_drain=0.16),
}

# --------------------------------------------------------------------------
# Database
# --------------------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS tracks (
            track_id TEXT PRIMARY KEY,
            entry_time TEXT,
            last_zone TEXT,
            last_seen TEXT
        );
        CREATE TABLE IF NOT EXISTS metrics_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            footfall INTEGER,
            active_shoppers INTEGER,
            avg_dwell REAL,
            queue_length INTEGER,
            shelf_a REAL,
            shelf_b REAL
        );
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            severity TEXT,
            reason TEXT,
            recommendation TEXT
        );
        """
    )
    conn.commit()
    conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="RetailEdge AI API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class Alert(BaseModel):
    severity: Literal["low", "medium", "high"]
    reason: str
    recommendation: str
    ts: str


class SnapshotMetrics(BaseModel):
    footfall: int
    active_shoppers: int
    avg_dwell: float
    queue_length: int
    queue_status: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    shelf_a: float
    shelf_b: float
    store_status: str
    ts: str


class ScenarioRequest(BaseModel):
    scenario: Literal["normal", "peak", "crisis"] = "normal"


# --------------------------------------------------------------------------
# Detection engine (DEMO_MODE simulated / real-inference-ready interface)
# --------------------------------------------------------------------------
class DetectionEngine:
    """
    Abstraction boundary between the API and the vision pipeline.

    - When DEMO_MODE=1 (default, judging-safe): produces a realistic
      simulated detection + tracking stream driven by scenario parameters.
    - When DEMO_MODE=0: `step()` should be replaced with a call into a real
      OpenCV capture -> YOLO(Ultralytics) -> ByteTrack/BoT-SORT pipeline.
      The output schema below is deliberately identical either way, so the
      rest of the stack (rules engine, DB, API, frontend) never changes.
    """

    def __init__(self):
        self.scenario = "normal"
        self.tracks = {}
        self.next_id = 1
        self.footfall = 0
        self.total_footfall = 0
        self.queue_length = 2
        self.avg_dwell = 45.0
        self.shelf_a = 86.0
        self.shelf_b = 91.0
        self.flags = {"queue_high": False, "shelf_a_low": False, "shelf_b_low": False, "footfall_spike": False}
        self.alerts: list[Alert] = []

    def set_scenario(self, scenario: str):
        self.scenario = scenario

    def _cfg(self):
        return SCENARIOS[self.scenario]

    def _push_alert(self, severity, reason, recommendation):
        a = Alert(severity=severity, reason=reason, recommendation=recommendation,
                   ts=datetime.now().isoformat(timespec="seconds"))
        self.alerts.insert(0, a)
        self.alerts = self.alerts[:50]
        conn = get_db()
        conn.execute(
            "INSERT INTO alerts (ts, severity, reason, recommendation) VALUES (?,?,?,?)",
            (a.ts, a.severity, a.reason, a.recommendation),
        )
        conn.commit()
        conn.close()

    def step(self):
        """Advance simulated (or real) detection state by one tick."""
        if not DEMO_MODE:
            # TODO: replace with real pipeline call, e.g.:
            #   frame = capture.read()
            #   results = yolo_model.track(frame, persist=True)
            #   self.tracks = parse_tracks(results)
            raise NotImplementedError("Wire up real YOLO inference here when DEMO_MODE=0")

        cfg = self._cfg()

        # spawn / despawn simulated shoppers
        if len(self.tracks) < 16 and random.random() < cfg["spawn_rate"]:
            tid = f"T-{self.next_id:03d}"
            self.next_id += 1
            self.tracks[tid] = {"entry": time.time(), "zone": "entrance"}
            self.total_footfall += 1

        for tid in list(self.tracks):
            age = time.time() - self.tracks[tid]["entry"]
            if age > random.uniform(18, 40) and random.random() < 0.35:
                del self.tracks[tid]

        self.footfall = int(max(0, min(120, self.footfall + (cfg["footfall_target"] - self.footfall) * 0.15 + random.uniform(-2, 2))))
        self.queue_length = int(max(0, min(22, self.queue_length + cfg["queue_drift"] * 6 + random.uniform(-1, 1))))
        self.shelf_a = max(4, min(100, self.shelf_a - cfg["shelf_drain"] * random.uniform(0.5, 1.5) * 5 + (8 if random.random() < 0.08 else 0)))
        self.shelf_b = max(4, min(100, self.shelf_b - cfg["shelf_drain"] * 0.4 * random.uniform(0.5, 1.5) * 5 + (6 if random.random() < 0.1 else 0)))
        self.avg_dwell = max(20, min(420, self.avg_dwell + random.uniform(-6, 6)))

        self._evaluate_rules()
        self._log_metrics()

    # --------------------------------------------------------------------
    # Rule-based decision engine
    # --------------------------------------------------------------------
    def _evaluate_rules(self):
        f = self.flags

        if self.queue_length > QUEUE_ALERT_THRESHOLD and not f["queue_high"]:
            f["queue_high"] = True
            self._push_alert("high", f"Queue length exceeded threshold ({self.queue_length} shoppers)",
                              "Open an additional checkout counter")
        elif self.queue_length <= 5:
            f["queue_high"] = False

        if self.queue_length > QUEUE_CRITICAL_THRESHOLD:
            self._push_alert("high", "High congestion detected near Checkout / Queue Zone",
                              "Deploy staff to manage overflow and open backup counters")

        if self.shelf_a < SHELF_A_LOW_THRESHOLD and not f["shelf_a_low"]:
            f["shelf_a_low"] = True
            self._push_alert("medium", "Potential stock-out detected in Shelf Zone A",
                              "Restock required — Shelf Zone A")
        elif self.shelf_a > 55:
            f["shelf_a_low"] = False

        if self.shelf_b < SHELF_B_LOW_THRESHOLD and not f["shelf_b_low"]:
            f["shelf_b_low"] = True
            self._push_alert("medium", "Potential stock-out detected in Shelf Zone B",
                              "Restock required — Shelf Zone B")
        elif self.shelf_b > 50:
            f["shelf_b_low"] = False

        if self.footfall > FOOTFALL_SPIKE_THRESHOLD and not f["footfall_spike"]:
            f["footfall_spike"] = True
            self._push_alert("low", "Footfall rising rapidly toward peak capacity",
                              "Prepare additional staff on the floor")
        elif self.footfall < 45:
            f["footfall_spike"] = False

    def _log_metrics(self):
        conn = get_db()
        conn.execute(
            """INSERT INTO metrics_log (ts, footfall, active_shoppers, avg_dwell, queue_length, shelf_a, shelf_b)
               VALUES (?,?,?,?,?,?,?)""",
            (datetime.now().isoformat(timespec="seconds"), self.footfall, len(self.tracks),
             self.avg_dwell, self.queue_length, self.shelf_a, self.shelf_b),
        )
        conn.commit()
        conn.close()

    def snapshot(self) -> SnapshotMetrics:
        status = ("CRITICAL" if self.queue_length > QUEUE_CRITICAL_THRESHOLD else
                   "HIGH" if self.queue_length > QUEUE_ALERT_THRESHOLD else
                   "MODERATE" if self.queue_length > 4 else "LOW")
        store_status = "Attention Needed" if any(a.severity == "high" for a in self.alerts[:3]) else "Operating Normally"
        return SnapshotMetrics(
            footfall=self.footfall, active_shoppers=len(self.tracks), avg_dwell=round(self.avg_dwell, 1),
            queue_length=self.queue_length, queue_status=status,
            shelf_a=round(self.shelf_a, 1), shelf_b=round(self.shelf_b, 1),
            store_status=store_status, ts=datetime.now().isoformat(timespec="seconds"),
        )


engine = DetectionEngine()

# --------------------------------------------------------------------------
# REST endpoints
# --------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "demo_mode": DEMO_MODE, "time": datetime.now().isoformat()}


@app.post("/api/demo/start")
def start_demo(req: ScenarioRequest):
    global engine
    engine = DetectionEngine()
    engine.set_scenario(req.scenario)
    return {"started": True, "scenario": req.scenario}


@app.post("/api/demo/scenario")
def set_scenario(req: ScenarioRequest):
    engine.set_scenario(req.scenario)
    return {"scenario": req.scenario}


@app.get("/api/metrics/snapshot", response_model=SnapshotMetrics)
def metrics_snapshot():
    engine.step()
    return engine.snapshot()


@app.get("/api/tracks")
def get_tracks():
    return [{"track_id": tid, "entry_time": t["entry"], "dwell_sec": round(time.time() - t["entry"], 1)}
            for tid, t in engine.tracks.items()]


@app.get("/api/alerts", response_model=list[Alert])
def get_alerts(limit: int = 20):
    return engine.alerts[:limit]


@app.get("/api/shelf")
def get_shelf():
    return {
        "shelf_a": {"occupancy": round(engine.shelf_a, 1),
                     "status": "Potential Stock-Out" if engine.shelf_a < SHELF_A_LOW_THRESHOLD else "OK"},
        "shelf_b": {"occupancy": round(engine.shelf_b, 1),
                     "status": "Potential Stock-Out" if engine.shelf_b < SHELF_B_LOW_THRESHOLD else "OK"},
    }


@app.get("/api/queue")
def get_queue():
    return {"queue_length": engine.queue_length,
            "status": engine.snapshot().queue_status,
            "avg_wait_sec": engine.queue_length * 38 + 20}


# --------------------------------------------------------------------------
# WebSocket — live push for dashboard (optional; frontend also polls REST)
# --------------------------------------------------------------------------
@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            engine.step()
            await websocket.send_json(engine.snapshot().model_dump())
            await websocket.send_json({"alerts": [a.model_dump() for a in engine.alerts[:5]]})
            await __import__("asyncio").sleep(1.6)
    except WebSocketDisconnect:
        pass
