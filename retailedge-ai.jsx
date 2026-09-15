import React, { useState, useEffect, useRef, useCallback, useContext, createContext } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  LayoutDashboard, Video, Users, ListOrdered, PackageSearch, Cpu,
  Network, ShieldCheck, Play, Pause, Square, AlertTriangle, Info,
  CheckCircle2, Activity, Gauge, Clock, TrendingUp, Wifi, WifiOff,
  Eye, EyeOff, Radio, Database, Camera, Zap, ChevronRight, Circle,
  Sun, Moon, FileText, Download, MapPin,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Theme tokens — dark (default) + light, provided via context so     */
/* every existing component keeps working unchanged aside from        */
/* reading its colors from context instead of one hardcoded object.   */
/* ------------------------------------------------------------------ */
const DARK = {
  bg: "#080b11",
  panel: "#0e131c",
  panel2: "#121927",
  border: "#1b2433",
  borderLight: "#243044",
  cyan: "#22d3ee",
  blue: "#4f8cff",
  purple: "#a78bfa",
  green: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
  text: "#e7ecf5",
  sub: "#8b96ab",
  faint: "#586277",
};

const LIGHT = {
  bg: "#f4f6fb",
  panel: "#ffffff",
  panel2: "#eef1f7",
  border: "#e2e6ef",
  borderLight: "#d4dae6",
  cyan: "#0e93a8",
  blue: "#2f6fed",
  purple: "#7c5cf0",
  green: "#0f9d63",
  amber: "#c8790a",
  red: "#dc3545",
  text: "#101625",
  sub: "#5b6473",
  faint: "#8994a6",
};

const THEMES = { dark: DARK, light: LIGHT };
const ThemeContext = createContext(DARK);

// The simulated CCTV canvas is intentionally kept as a fixed "dark monitor"
// regardless of app theme (like a video player stays dark in a light-mode
// site) — this is why ZONES/VisionCanvas reference DARK directly below,
// not the active theme.
const ZONES = {
  entrance: { label: "Entrance", x: 30, y: 260, w: 150, h: 150, color: DARK.faint },
  shelfA: { label: "Shelf Zone A", x: 30, y: 30, w: 220, h: 110, color: DARK.purple },
  shelfB: { label: "Shelf Zone B", x: 290, y: 30, w: 220, h: 110, color: DARK.purple },
  aisle: { label: "Main Aisle", x: 200, y: 150, w: 340, h: 100, color: DARK.faint },
  queue: { label: "Queue Zone", x: 560, y: 260, w: 210, h: 150, color: DARK.amber },
  checkout: { label: "Checkout", x: 560, y: 30, w: 210, h: 110, color: DARK.blue },
};

const SCENARIOS = {
  normal: {
    label: "Normal Store",
    desc: "Steady footfall, healthy queues, stocked shelves",
    footfallTarget: 34,
    spawnRate: 0.35,
    queueDrift: 0.02,
    shelfDrainRate: 0.03,
  },
  peak: {
    label: "Peak Footfall",
    desc: "High shopper volume, rising congestion",
    footfallTarget: 78,
    spawnRate: 0.7,
    queueDrift: 0.05,
    shelfDrainRate: 0.06,
  },
  crisis: {
    label: "Long Queue + Low Shelf Stock",
    desc: "Checkout bottleneck and Shelf Zone A depleting",
    footfallTarget: 58,
    spawnRate: 0.55,
    queueDrift: 0.16,
    shelfDrainRate: 0.16,
  },
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "vision", label: "Live Vision", icon: Video },
  { id: "shopper", label: "Shopper Analytics", icon: Users },
  { id: "queue", label: "Queue Analytics", icon: ListOrdered },
  { id: "shelf", label: "Shelf Analytics", icon: PackageSearch },
  { id: "decision", label: "Decision Engine", icon: Cpu },
  { id: "cameras", label: "Cameras", icon: Camera },
  { id: "health", label: "System Health", icon: Activity },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "architecture", label: "System Architecture", icon: Network },
];

let trackSeq = 1;
let alertSeq = 1;
const now = () => new Date();
const fmtTime = (d) => d.toLocaleTimeString("en-IN", { hour12: false });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const insideZone = (x, y, z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;

// Defensive numeric guard — used anywhere a derived/computed value (division,
// average, trend slope) could momentarily be NaN/undefined (e.g. empty
// history arrays) so charts/cards never receive an invalid value.
const safeNum = (v, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

// Small seeded PRNG (mulberry32) so a given scenario reproduces the same
// believable trend shape run to run, instead of pure chaotic randomness,
// while still allowing natural-looking variation tick to tick.
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED_FOR_SCENARIO = { normal: 1001, peak: 2002, crisis: 3003 };

function zoneOf(x, y) {
  for (const [key, z] of Object.entries(ZONES)) {
    if (insideZone(x, y, z)) return key;
  }
  return "aisle";
}

function newTrack() {
  const id = `T-${String(trackSeq++).padStart(3, "0")}`;
  return {
    id,
    x: rand(40, 140),
    y: rand(280, 380),
    tx: rand(200, 700),
    ty: rand(60, 380),
    entry: now(),
    speed: rand(6, 14),
  };
}

/* ------------------------------------------------------------------ */
/* Error boundary — an error inside one page must never blank the      */
/* whole dashboard; sidebar/topbar/nav stay usable and the person can   */
/* just switch pages or restart the demo.                              */
/* ------------------------------------------------------------------ */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("RetailEdge AI — page-level error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      const C = this.props.C || DARK;
      return (
        <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-8 text-center">
          <AlertTriangle size={22} style={{ color: C.red }} className="mx-auto mb-2" />
          <p style={{ color: C.text }} className="text-[13.5px] font-medium">This section hit an error and couldn't render.</p>
          <p style={{ color: C.faint }} className="text-[12px] mt-1">The rest of the dashboard is unaffected — try another page from the sidebar, or Stop/Start the demo again.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */
function Badge({ children, tone = "sub" }) {
  const C = useContext(ThemeContext);
  const map = {
    sub: { color: C.sub, bg: "rgba(139,150,171,0.1)", border: C.border },
    green: { color: C.green, bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)" },
    cyan: { color: C.cyan, bg: "rgba(34,211,238,0.12)", border: "rgba(34,211,238,0.3)" },
    blue: { color: C.blue, bg: "rgba(79,140,255,0.12)", border: "rgba(79,140,255,0.3)" },
    amber: { color: C.amber, bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" },
    red: { color: C.red, bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
    purple: { color: C.purple, bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)" },
  };
  const s = map[tone] || map.sub;
  return (
    <span
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide"
    >
      {children}
    </span>
  );
}

function Panel({ title, icon: Icon, right, children, className = "" }) {
  const C = useContext(ThemeContext);
  return (
    <div
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
      className={`rounded-xl overflow-hidden ${className}`}
    >
      {title && (
        <div
          style={{ borderBottom: `1px solid ${C.border}` }}
          className="flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            {Icon && <Icon size={15} style={{ color: C.cyan }} />}
            <h3 style={{ color: C.text }} className="text-[13px] font-semibold">
              {title}
            </h3>
          </div>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function KPI({ label, value, unit, icon: Icon, trend, tone = "cyan" }) {
  const C = useContext(ThemeContext);
  const toneColor = { cyan: C.cyan, blue: C.blue, purple: C.purple, amber: C.amber, red: C.red, green: C.green }[tone] || C.cyan;
  const displayValue = typeof value === "number" ? safeNum(value, 0) : (value ?? "—");
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-4 relative overflow-hidden">
      <div
        style={{ background: toneColor }}
        className="absolute top-0 left-0 h-full w-[3px] opacity-70"
      />
      <div className="flex items-start justify-between">
        <span style={{ color: C.sub }} className="text-[11px] font-medium">{label}</span>
        {Icon && <Icon size={14} style={{ color: toneColor }} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span style={{ color: C.text }} className="text-2xl font-semibold tabular-nums">{displayValue}</span>
        {unit && <span style={{ color: C.faint }} className="text-xs">{unit}</span>}
      </div>
      {trend && (
        <div style={{ color: trend.startsWith("-") ? C.red : C.green }} className="mt-1 text-[11px] font-medium">
          {trend}
        </div>
      )}
    </div>
  );
}

function AlertRow({ a }) {
  const C = useContext(ThemeContext);
  const tone = { high: "red", medium: "amber", low: "cyan", info: "sub" }[a.severity] || "sub";
  const Icon = a.severity === "high" ? AlertTriangle : a.severity === "medium" ? AlertTriangle : Info;
  const iconColor = { red: C.red, amber: C.amber, cyan: C.cyan, sub: C.sub }[tone] || C.sub;
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }} className="flex gap-3 py-3 px-1 last:border-0">
      <Icon size={16} style={{ color: iconColor }} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span style={{ color: C.text }} className="text-[13px] font-medium">{a.reason}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {a.status === "resolved" && <Badge tone="green">resolved</Badge>}
            <Badge tone={tone}>{a.severity}</Badge>
          </div>
        </div>
        <p style={{ color: C.sub }} className="mt-0.5 text-[12px]">{a.recommendation}</p>
        <span style={{ color: C.faint }} className="text-[11px] font-mono">{fmtTime(a.time)}{a.type ? ` · ${a.type}` : ""}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Simulated CCTV / Edge AI vision panel (SVG)                         */
/* Fixed "dark monitor" styling on purpose — always uses DARK tokens   */
/* directly regardless of the active app theme, like a video canvas.  */
/* ------------------------------------------------------------------ */
function VisionCanvas({ tracks, running, queueLen, shelfA, shelfB, showLabels = true }) {
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  const sA = safeNum(shelfA, 0);
  const sB = safeNum(shelfB, 0);
  const qLen = safeNum(queueLen, 0);
  return (
    <div className="relative rounded-lg overflow-hidden" style={{ background: "#05070c", border: `1px solid ${DARK.border}` }}>
      <div
        style={{ borderBottom: `1px solid ${DARK.border}`, background: "rgba(5,7,12,0.6)" }}
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={running ? "green" : "sub"}>
            <Circle size={7} fill="currentColor" className="animate-pulse" /> {running ? "EDGE AI ACTIVE" : "STANDBY"}
          </Badge>
          <Badge tone="cyan"><Cpu size={11} /> LOCAL INFERENCE</Badge>
        </div>
        <Badge tone="purple"><ShieldCheck size={11} /> Faces are not identified or stored</Badge>
      </div>
      <svg viewBox="0 0 800 450" className="w-full h-auto block">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#12192a" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="800" height="450" fill="url(#grid)" />

        {Object.entries(ZONES).map(([key, z]) => (
          <g key={key}>
            <rect
              x={z.x} y={z.y} width={z.w} height={z.h}
              fill={z.color} fillOpacity="0.05"
              stroke={z.color} strokeOpacity="0.55" strokeDasharray="5 4" strokeWidth="1.5"
              rx="6"
            />
            <text x={z.x + 8} y={z.y + 18} fill={z.color} fontSize="11" fontFamily="monospace" opacity="0.85">
              {z.label.toUpperCase()}
            </text>
          </g>
        ))}

        {/* shelf occupancy fill bars */}
        <rect x={ZONES.shelfA.x + 8} y={ZONES.shelfA.y + 30} width={ZONES.shelfA.w - 16} height="14" fill="#1b2433" rx="3" />
        <rect x={ZONES.shelfA.x + 8} y={ZONES.shelfA.y + 30} width={((ZONES.shelfA.w - 16) * sA) / 100} height="14" fill={sA < 30 ? DARK.red : DARK.green} rx="3" />
        <rect x={ZONES.shelfB.x + 8} y={ZONES.shelfB.y + 30} width={ZONES.shelfB.w - 16} height="14" fill="#1b2433" rx="3" />
        <rect x={ZONES.shelfB.x + 8} y={ZONES.shelfB.y + 30} width={((ZONES.shelfB.w - 16) * sB) / 100} height="14" fill={sB < 30 ? DARK.red : DARK.green} rx="3" />

        {/* queue counter */}
        <text x={ZONES.queue.x + 8} y={ZONES.queue.y + 40} fill={DARK.amber} fontSize="26" fontFamily="monospace" fontWeight="700">
          {qLen}
        </text>

        {safeTracks.map((t) => (
          <g key={t.id} style={{ transition: "transform 0.4s linear" }} transform={`translate(${safeNum(t.x, 400)}, ${safeNum(t.y, 225)})`}>
            <rect x="-16" y="-16" width="32" height="32" fill="none" stroke={DARK.cyan} strokeWidth="1.5" rx="4" opacity="0.9" />
            <circle cx="0" cy="0" r="3" fill={DARK.cyan} />
            {showLabels && (
              <text x="-16" y="-20" fill={DARK.cyan} fontSize="10" fontFamily="monospace">{t.id}</text>
            )}
          </g>
        ))}

        {!running && (
          <text x="400" y="230" textAnchor="middle" fill={DARK.faint} fontSize="14" fontFamily="monospace">
            AWAITING FEED — CLICK START DEMO
          </text>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chart helpers                                                       */
/* ------------------------------------------------------------------ */
const getAxisStyle = (C) => ({ fontSize: 11, fill: C.sub, fontFamily: "monospace" });
const getTooltipStyle = (C) => ({ background: C.panel2, border: `1px solid ${C.borderLight}`, borderRadius: 8, fontSize: 12, color: C.text });
function ChartFrame({ children, height = 200 }) {
  return <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>;
}

// Lightweight trend-based forecast — explicitly NOT a production ML model.
// Uses the slope between the first and second half of recent footfall
// history to project a near-future value.
function computeForecast(footfallHist) {
  if (!Array.isArray(footfallHist) || footfallHist.length < 4) return null;
  const recent = footfallHist.slice(-8);
  const n = recent.length;
  const mid = Math.ceil(n / 2);
  const firstHalf = recent.slice(0, mid);
  const secondHalf = recent.slice(mid);
  const avg = (arr) => (arr.length ? arr.reduce((s, d) => s + safeNum(d.footfall), 0) / arr.length : 0);
  const avgFirst = avg(firstHalf);
  const avgSecond = avg(secondHalf.length ? secondHalf : firstHalf);
  const slope = avgSecond - avgFirst;
  const current = safeNum(recent[recent.length - 1]?.footfall, 0);
  const projected = clamp(Math.round(current + slope * 1.5), 0, 130);
  return { current, projected, rising: projected > current + 3, falling: projected < current - 3 };
}

/* ------------------------------------------------------------------ */
/* Main App                                                             */
/* ------------------------------------------------------------------ */
export default function RetailEdgeAI() {
  const [themeMode, setThemeMode] = useState("dark");
  const C = THEMES[themeMode];

  const [page, setPage] = useState("dashboard");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [scenario, setScenario] = useState("normal");
  const [cloudSync, setCloudSync] = useState(false);

  const [tracks, setTracks] = useState([]);
  const [footfall, setFootfall] = useState(0);
  const [totalFootfall, setTotalFootfall] = useState(0);
  const [entryCount, setEntryCount] = useState(0);
  const [exitCount, setExitCount] = useState(0);
  const [queueLen, setQueueLen] = useState(2);
  const [avgDwell, setAvgDwell] = useState(45);
  const [shelfA, setShelfA] = useState(86);
  const [shelfB, setShelfB] = useState(91);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [cpuUsage, setCpuUsage] = useState(6);
  const [gpuUsage, setGpuUsage] = useState(3);
  const [memUsage, setMemUsage] = useState(22);

  const [footfallHist, setFootfallHist] = useState([]);
  const [queueHist, setQueueHist] = useState([]);
  const [dwellDist, setDwellDist] = useState([
    { bucket: "0-1m", count: 8 }, { bucket: "1-3m", count: 14 },
    { bucket: "3-5m", count: 9 }, { bucket: "5-10m", count: 4 }, { bucket: "10m+", count: 1 },
  ]);
  const [zoneOcc, setZoneOcc] = useState([
    { zone: "Entrance", count: 2 }, { zone: "Shelf A", count: 3 }, { zone: "Shelf B", count: 2 },
    { zone: "Aisle", count: 4 }, { zone: "Queue", count: 2 }, { zone: "Checkout", count: 1 },
  ]);

  const [alerts, setAlerts] = useState([]);

  // ---- Refs: authoritative simulation state, decoupled from render/effect deps ----
  // Interval callbacks read/write these directly so the interval never needs to be
  // recreated when a value it produced (tracks/footfall/queueLen/...) changes.
  const flags = useRef({ queueHigh: false, congestion: false, shelfALow: false, shelfBLow: false, footfallSpike: false });
  const rngRef = useRef(makeRng(SEED_FOR_SCENARIO.normal));

  const sim = useRef({
    tracks: [], footfall: 0, totalFootfall: 0, entryCount: 0, exitCount: 0, queueLen: 2, avgDwell: 45,
    shelfA: 86, shelfB: 91, cpuUsage: 6, gpuUsage: 3, memUsage: 22, tickCount: 0,
  });

  const pushAlert = useCallback((severity, type, reason, recommendation) => {
    setAlerts((prev) => [{ id: alertSeq++, severity, type, reason, recommendation, status: "active", time: now() }, ...prev].slice(0, 40));
  }, []);

  const resolveAlertsByType = useCallback((type) => {
    setAlerts((prev) => prev.map((a) => (a.type === type && a.status === "active" ? { ...a, status: "resolved", resolvedAt: now() } : a)));
  }, []);

  // Single evaluation point for the rule-based decision engine — called once per
  // analytics tick with the fresh values just computed that tick (never stale state).
  // Each condition only fires ONE alert per threshold crossing (hysteresis via
  // `flags`), and marks it resolved exactly once when the condition clears —
  // no per-tick alert spam.
  const evaluateRules = useCallback((queueLenVal, shelfAVal, shelfBVal, footfallVal) => {
    const f = flags.current;
    try {
      if (queueLenVal > 8 && !f.queueHigh) {
        f.queueHigh = true;
        pushAlert("high", "queue", `Queue length exceeded threshold (${queueLenVal} shoppers)`, "Open an additional checkout counter");
      } else if (queueLenVal <= 5 && f.queueHigh) {
        f.queueHigh = false;
        resolveAlertsByType("queue");
      }

      if (queueLenVal > 14 && !f.congestion) {
        f.congestion = true;
        pushAlert("high", "congestion", "High congestion detected near Checkout / Queue Zone", "Deploy staff to manage overflow and open backup counters");
      } else if (queueLenVal <= 10 && f.congestion) {
        f.congestion = false;
        resolveAlertsByType("congestion");
      }

      if (shelfAVal < 30 && !f.shelfALow) {
        f.shelfALow = true;
        pushAlert("medium", "shelfA", "Potential stock-out detected in Shelf Zone A", "Restock required — Shelf Zone A");
      } else if (shelfAVal > 55 && f.shelfALow) {
        f.shelfALow = false;
        resolveAlertsByType("shelfA");
      }

      if (shelfBVal < 25 && !f.shelfBLow) {
        f.shelfBLow = true;
        pushAlert("medium", "shelfB", "Potential stock-out detected in Shelf Zone B", "Restock required — Shelf Zone B");
      } else if (shelfBVal > 50 && f.shelfBLow) {
        f.shelfBLow = false;
        resolveAlertsByType("shelfB");
      }

      if (footfallVal > 65 && !f.footfallSpike) {
        f.footfallSpike = true;
        pushAlert("low", "footfall", "Footfall rising rapidly toward peak capacity", "Prepare additional staff on the floor");
      } else if (footfallVal < 45 && f.footfallSpike) {
        f.footfallSpike = false;
        resolveAlertsByType("footfall");
      }
    } catch (err) {
      // Defensive: a rule-evaluation error must never take down the tick loop.
      // eslint-disable-next-line no-console
      console.error("RetailEdge AI — decision engine error:", err);
    }
  }, [pushAlert, resolveAlertsByType]);

  const resetAll = useCallback((forScenario) => {
    const seedScenario = forScenario || "normal";
    trackSeq = 1; alertSeq = 1;
    rngRef.current = makeRng(SEED_FOR_SCENARIO[seedScenario] || 42);
    sim.current = {
      tracks: [], footfall: 0, totalFootfall: 0, entryCount: 0, exitCount: 0, queueLen: 2, avgDwell: 45,
      shelfA: 86, shelfB: 91, cpuUsage: 6, gpuUsage: 3, memUsage: 22, tickCount: 0,
    };
    flags.current = { queueHigh: false, congestion: false, shelfALow: false, shelfBLow: false, footfallSpike: false };
    setTracks([]); setFootfall(0); setTotalFootfall(0); setEntryCount(0); setExitCount(0); setQueueLen(2); setAvgDwell(45);
    setShelfA(86); setShelfB(91); setFootfallHist([]); setQueueHist([]); setAlerts([]);
    setFps(0); setLatency(0); setCpuUsage(6); setGpuUsage(3); setMemUsage(22);
  }, []);

  const startDemo = (s) => {
    setScenario(s);
    resetAll(s);
    setRunning(true);
    setPaused(false);
  };
  const stopDemo = () => {
    setRunning(false);
    setPaused(false);
    sim.current.tracks = [];
    setTracks([]);
    setCpuUsage(6); setGpuUsage(3); setMemUsage(22);
  };

  // Switching scenario while stopped should give a clean baseline immediately,
  // instead of leaving stale numbers from a previous run on screen.
  const changeScenario = (s) => {
    setScenario(s);
    if (!running) resetAll(s);
  };

  // Movement tick (200–250ms) — smooth position updates + FPS/latency telemetry.
  // Depends only on [running, paused]: it is never torn down/recreated mid-run.
  useEffect(() => {
    if (!running || paused) return;
    const iv = setInterval(() => {
      try {
        const next = sim.current.tracks.map((t) => {
          let x = t.x + (t.tx - t.x) * 0.06;
          let y = t.y + (t.ty - t.y) * 0.06;
          if (Math.abs(t.tx - t.x) < 4 && Math.abs(t.ty - t.y) < 4) {
            return { ...t, x, y, tx: clamp(rand(t.tx - 120, t.tx + 120), 20, 780), ty: clamp(rand(t.ty - 100, t.ty + 100), 20, 430) };
          }
          return { ...t, x, y };
        });
        sim.current.tracks = next;
        setTracks(next);
        setFps(clamp(Math.round(rand(24, 31)), 0, 99));
        setLatency(Math.round(rand(18, 42)));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("RetailEdge AI — movement tick error:", err);
      }
    }, 220);
    return () => clearInterval(iv);
  }, [running, paused]);

  // Analytics tick — ONE stable interval, recreated ONLY when running, paused,
  // or scenario changes. Previous metric values and current tracks are read
  // from the `sim` ref (not component state), so footfall/queueLen/tracks
  // changing every tick never causes this interval to be torn down and rebuilt.
  //
  // Values are correlated rather than independently randomized:
  //   - queue length is pulled toward a target driven by current footfall
  //   - dwell time is pulled toward a target driven by shopper density + queue
  //   - shelf drain accelerates with footfall; restocking is an occasional bump
  // All core quantities use a seeded RNG so a given scenario is repeatable.
  useEffect(() => {
    if (!running || paused) return;
    const cfg = SCENARIOS[scenario];
    const iv = setInterval(() => {
      try {
        const s = sim.current;
        s.tickCount += 1;
        const rnd = () => rngRef.current();
        const srand = (a, b) => a + rnd() * (b - a);

        // --- spawn / despawn shoppers ---
        let tracksArr = [...s.tracks];
        if (tracksArr.length < 16 && rnd() < cfg.spawnRate) {
          tracksArr.push(newTrack());
          s.totalFootfall += 1;
          s.entryCount += 1;
        }
        const before = tracksArr.length;
        tracksArr = tracksArr.filter((t) => {
          const age = (now() - t.entry) / 1000;
          const leaves = age > srand(18, 40) && rnd() < 0.35;
          return !leaves;
        });
        s.exitCount += before - tracksArr.length;
        s.tracks = tracksArr;

        // --- footfall: gradual pull toward scenario target ---
        s.footfall = clamp(Math.round(s.footfall + (cfg.footfallTarget - s.footfall) * 0.15 + srand(-2, 2)), 0, 120);

        // --- queue: correlated with footfall (checkout traffic), not pure noise ---
        const queueTarget = clamp(2 + (s.footfall / 100) * 10 + cfg.queueDrift * 40, 0, 22);
        s.queueLen = clamp(Math.round(s.queueLen + (queueTarget - s.queueLen) * 0.25 + srand(-1, 1)), 0, 22);

        // --- shelves: drain accelerates with footfall; restocking is an occasional bump ---
        const drainFactorA = cfg.shelfDrainRate * (0.6 + s.footfall / 100);
        const drainFactorB = cfg.shelfDrainRate * 0.4 * (0.6 + s.footfall / 100);
        s.shelfA = clamp(+(s.shelfA - drainFactorA * srand(3, 6) + (rnd() < 0.07 ? srand(5, 10) : 0)).toFixed(0), 4, 100);
        s.shelfB = clamp(+(s.shelfB - drainFactorB * srand(3, 6) + (rnd() < 0.09 ? srand(4, 8) : 0)).toFixed(0), 4, 100);

        // --- dwell time: correlated with shopper density + queue pressure ---
        const dwellTarget = clamp(30 + tracksArr.length * 8 + s.queueLen * 6, 20, 420);
        s.avgDwell = clamp(Math.round(s.avgDwell + (dwellTarget - s.avgDwell) * 0.2 + srand(-3, 3)), 20, 420);

        // --- simulated edge-device telemetry: scales with inference load (track count) ---
        const cpuTarget = clamp(22 + tracksArr.length * 3.2, 5, 96);
        const gpuTarget = clamp(14 + tracksArr.length * 2.4, 3, 92);
        const memTarget = clamp(28 + tracksArr.length * 1.6, 15, 88);
        s.cpuUsage = clamp(Math.round(s.cpuUsage + (cpuTarget - s.cpuUsage) * 0.3 + srand(-2, 2)), 0, 100);
        s.gpuUsage = clamp(Math.round(s.gpuUsage + (gpuTarget - s.gpuUsage) * 0.3 + srand(-2, 2)), 0, 100);
        s.memUsage = clamp(Math.round(s.memUsage + (memTarget - s.memUsage) * 0.2 + srand(-1, 1)), 0, 100);

        // --- zone occupancy from the SAME fresh tracks array used this tick ---
        const counts = { Entrance: 0, "Shelf A": 0, "Shelf B": 0, Aisle: 0, Queue: 0, Checkout: 0 };
        const zoneMap = { entrance: "Entrance", shelfA: "Shelf A", shelfB: "Shelf B", aisle: "Aisle", queue: "Queue", checkout: "Checkout" };
        tracksArr.forEach((tr) => { counts[zoneMap[zoneOf(tr.x, tr.y)]] += 1; });

        // --- flush every derived value to React state in one consistent pass ---
        setTracks(tracksArr);
        setTotalFootfall(s.totalFootfall);
        setEntryCount(s.entryCount);
        setExitCount(s.exitCount);
        setFootfall(s.footfall);
        setQueueLen(s.queueLen);
        setShelfA(s.shelfA);
        setShelfB(s.shelfB);
        setAvgDwell(s.avgDwell);
        setCpuUsage(s.cpuUsage);
        setGpuUsage(s.gpuUsage);
        setMemUsage(s.memUsage);
        setZoneOcc(Object.entries(counts).map(([zone, count]) => ({ zone, count })));

        const tLabel = fmtTime(now());
        setFootfallHist((h) => [...h.slice(-19), { t: tLabel, footfall: s.footfall }]);
        setQueueHist((h) => [...h.slice(-19), { t: tLabel, queue: s.queueLen }]);

        // --- decision engine runs on the exact values just produced this tick ---
        evaluateRules(s.queueLen, s.shelfA, s.shelfB, s.footfall);
      } catch (err) {
        // A single bad tick must not stop future ticks or crash the app.
        // eslint-disable-next-line no-console
        console.error("RetailEdge AI — analytics tick error:", err);
      }
    }, 1600);
    return () => clearInterval(iv);
  }, [running, paused, scenario, evaluateRules]);

  const queueStatus =
    queueLen > 14 ? "CRITICAL" : queueLen > 8 ? "HIGH" : queueLen > 4 ? "MODERATE" : "LOW";
  const queueTone = { CRITICAL: "red", HIGH: "red", MODERATE: "amber", LOW: "green" }[queueStatus];
  const storeStatus = alerts.some((a) => a.severity === "high" && a.status === "active" && (now() - a.time) / 1000 < 30)
    ? "Attention Needed" : "Operating Normally";

  const recommendations = [];
  if (queueLen > 8) recommendations.push({ trigger: `Queue length ${queueLen} > 8`, action: "Open an additional checkout counter", severity: "high" });
  if (footfall > 65) recommendations.push({ trigger: `Footfall ${footfall} rising rapidly`, action: "Prepare additional staff", severity: "medium" });
  if (shelfA < 30) recommendations.push({ trigger: `Shelf Zone A occupancy ${shelfA}%`, action: "Restocking recommended — Zone A", severity: "medium" });
  if (shelfB < 25) recommendations.push({ trigger: `Shelf Zone B occupancy ${shelfB}%`, action: "Restocking recommended — Zone B", severity: "medium" });
  if (queueLen > 14) recommendations.push({ trigger: `Congestion score critical`, action: "High congestion detected in Queue Zone", severity: "high" });
  if (recommendations.length === 0) recommendations.push({ trigger: "All metrics within nominal range", action: "No action required — continue monitoring", severity: "low" });

  const forecast = computeForecast(footfallHist);
  const maxQueueSession = queueHist.reduce((m, d) => Math.max(m, safeNum(d.queue)), queueLen);
  const peakFootfallPoint = footfallHist.reduce((m, d) => (safeNum(d.footfall) > m.footfall ? { footfall: safeNum(d.footfall), t: d.t } : m), { footfall: 0, t: "—" });

  /* ---------------------------------------------------------------- */
  return (
    <ThemeContext.Provider value={C}>
    <div style={{ background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }} className="min-h-screen w-full flex">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .animate-pulse { animation: pulse 1.6s ease-in-out infinite; }
        * { scrollbar-width: thin; scrollbar-color: ${C.borderLight} ${C.panel}; }
      `}</style>

      {/* Sidebar */}
      <aside style={{ borderRight: `1px solid ${C.border}`, background: C.panel }} className="w-[220px] shrink-0 hidden md:flex flex-col">
        <div className="px-5 py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <div style={{ background: "linear-gradient(135deg,#22d3ee,#4f8cff)" }} className="w-7 h-7 rounded-md flex items-center justify-center">
              <Eye size={15} color="#04121a" />
            </div>
            <span className="font-semibold text-[15px]" style={{ letterSpacing: "-0.01em" }}>RetailEdge AI</span>
          </div>
          <p style={{ color: C.faint }} className="mt-1.5 text-[11px] leading-snug">
            Privacy-preserving Edge AI for real-time retail intelligence
          </p>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                style={{
                  color: active ? C.text : C.sub,
                  background: active ? C.panel2 : "transparent",
                  borderLeft: active ? `2px solid ${C.cyan}` : "2px solid transparent",
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors hover:text-white"
              >
                <Icon size={15} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 space-y-2" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between text-[11px]" style={{ color: C.sub }}>
            <span>Theme</span>
            <button
              onClick={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}
              style={{ background: C.panel2, border: `1px solid ${C.borderLight}`, color: C.text }}
              className="flex items-center gap-1 px-2 py-1 rounded-full font-medium"
            >
              {themeMode === "dark" ? <Moon size={11} /> : <Sun size={11} />} {themeMode === "dark" ? "Dark" : "Light"}
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px]" style={{ color: C.sub }}>
            <span>Cloud Sync</span>
            <button
              onClick={() => setCloudSync((v) => !v)}
              style={{ background: cloudSync ? "rgba(52,211,153,0.15)" : C.panel2, border: `1px solid ${cloudSync ? C.green : C.border}`, color: cloudSync ? C.green : C.faint }}
              className="flex items-center gap-1 px-2 py-1 rounded-full font-medium"
            >
              {cloudSync ? <Wifi size={11} /> : <WifiOff size={11} />} {cloudSync ? "ON" : "OFF"}
            </button>
          </div>
          <p style={{ color: C.faint }} className="text-[10.5px] leading-snug">
            {cloudSync ? "Only anonymized aggregate metrics are synced." : "All analytics remain on-device."}
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }} className="px-4 md:px-6 py-3.5 flex flex-wrap items-center gap-3 justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-[15px] font-semibold">{NAV.find((n) => n.id === page)?.label}</h1>
            <p style={{ color: C.faint }} className="text-[11.5px]">Store: MG Road Outlet · 4 Cameras Online</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={storeStatus === "Operating Normally" ? "green" : "amber"}>
              <Circle size={7} fill="currentColor" /> {storeStatus}
            </Badge>
            {!running ? (
              <div className="flex items-center gap-1.5">
                {Object.entries(SCENARIOS).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => startDemo(key)}
                    style={{ background: C.panel2, border: `1px solid ${C.borderLight}`, color: C.text }}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-md hover:border-cyan-400/50 transition-colors flex items-center gap-1.5"
                  >
                    <Play size={12} style={{ color: C.cyan }} /> {s.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Badge tone="cyan">{SCENARIOS[scenario].label}</Badge>
                <button onClick={() => setPaused((p) => !p)} style={{ background: C.panel2, border: `1px solid ${C.borderLight}` }} className="p-1.5 rounded-md">
                  {paused ? <Play size={13} style={{ color: C.green }} /> : <Pause size={13} style={{ color: C.amber }} />}
                </button>
                <button onClick={stopDemo} style={{ background: C.panel2, border: `1px solid ${C.borderLight}` }} className="p-1.5 rounded-md">
                  <Square size={13} style={{ color: C.red }} />
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          <ErrorBoundary key={page} C={C}>
            {page === "dashboard" && (
              <DashboardPage
                running={running} tracks={tracks} footfall={footfall} avgDwell={avgDwell}
                queueLen={queueLen} shelfA={shelfA} shelfB={shelfB} storeStatus={storeStatus}
                footfallHist={footfallHist} queueHist={queueHist} zoneOcc={zoneOcc}
                alerts={alerts} queueStatus={queueStatus} queueTone={queueTone}
              />
            )}
            {page === "vision" && (
              <VisionPage
                running={running} paused={paused} tracks={tracks} queueLen={queueLen}
                shelfA={shelfA} shelfB={shelfB} fps={fps} latency={latency}
                onStart={() => startDemo(scenario)} onPause={() => setPaused((p) => !p)} onStop={stopDemo}
                scenario={scenario} setScenario={changeScenario}
              />
            )}
            {page === "shopper" && (
              <ShopperPage
                footfall={footfall} totalFootfall={totalFootfall} entryCount={entryCount} exitCount={exitCount}
                avgDwell={avgDwell} footfallHist={footfallHist} dwellDist={dwellDist} zoneOcc={zoneOcc} tracks={tracks}
                peakFootfallPoint={peakFootfallPoint}
              />
            )}
            {page === "queue" && (
              <QueuePage queueLen={queueLen} queueHist={queueHist} queueStatus={queueStatus} queueTone={queueTone} running={running} maxQueueSession={maxQueueSession} />
            )}
            {page === "shelf" && <ShelfPage shelfA={shelfA} shelfB={shelfB} />}
            {page === "decision" && <DecisionPage recommendations={recommendations} alerts={alerts} forecast={forecast} />}
            {page === "cameras" && <CamerasPage running={running} />}
            {page === "health" && <HealthPage running={running} cpuUsage={cpuUsage} gpuUsage={gpuUsage} memUsage={memUsage} fps={fps} latency={latency} tracks={tracks} />}
            {page === "reports" && (
              <ReportsPage
                totalFootfall={totalFootfall} avgDwell={avgDwell} maxQueueSession={maxQueueSession}
                peakFootfallPoint={peakFootfallPoint} alerts={alerts} recommendations={recommendations}
                footfallHist={footfallHist} queueHist={queueHist}
              />
            )}
            {page === "architecture" && <ArchitecturePage running={running} />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
    </ThemeContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Pages                                                                */
/* ------------------------------------------------------------------ */
function DashboardPage({ running, tracks, footfall, avgDwell, queueLen, shelfA, shelfB, storeStatus, footfallHist, queueHist, zoneOcc, alerts, queueStatus, queueTone }) {
  const C = useContext(ThemeContext);
  const axisStyle = getAxisStyle(C);
  const tooltipStyle = getTooltipStyle(C);
  const stockAlerts = (shelfA < 30 ? 1 : 0) + (shelfB < 25 ? 1 : 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Current Footfall" value={footfall} unit="/hr" icon={Users} tone="cyan" />
        <KPI label="Active Shoppers" value={tracks.length} icon={Activity} tone="blue" />
        <KPI label="Avg Dwell Time" value={avgDwell} unit="sec" icon={Clock} tone="purple" />
        <KPI label="Queue Length" value={queueLen} unit="people" icon={ListOrdered} tone={queueTone} />
        <KPI label="Stock Alerts" value={stockAlerts} icon={PackageSearch} tone={stockAlerts ? "red" : "green"} />
        <KPI label="Store Status" value={storeStatus === "Operating Normally" ? "OK" : "Alert"} icon={Gauge} tone={storeStatus === "Operating Normally" ? "green" : "amber"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="Live Camera Feed — Multi-Camera" icon={Camera} className="lg:col-span-2" right={<Badge tone={running ? "green" : "sub"}>{running ? "Streaming" : "Idle"}</Badge>}>
          <VisionCanvas tracks={tracks} running={running} queueLen={queueLen} shelfA={shelfA} shelfB={shelfB} />
        </Panel>
        <Panel title="Alert Center" icon={AlertTriangle} right={<Badge tone="sub">{alerts.length}</Badge>}>
          <div className="max-h-[340px] overflow-y-auto">
            {alerts.length === 0 ? (
              <p style={{ color: C.faint }} className="text-[12.5px] py-6 text-center">No alerts yet. Start a demo scenario to see the decision engine in action.</p>
            ) : (
              alerts.slice(0, 8).map((a) => <AlertRow key={a.id} a={a} />)
            )}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="Footfall Over Time" icon={TrendingUp}>
          <ChartFrame height={180}>
            <AreaChart data={footfallHist}>
              <defs>
                <linearGradient id="ff" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.cyan} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="t" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={26} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="footfall" stroke={C.cyan} fill="url(#ff)" strokeWidth={2} />
            </AreaChart>
          </ChartFrame>
        </Panel>
        <Panel title="Queue Length Over Time" icon={ListOrdered}>
          <ChartFrame height={180}>
            <LineChart data={queueHist}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="t" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={26} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="queue" stroke={C.amber} strokeWidth={2} dot={false} />
            </LineChart>
          </ChartFrame>
        </Panel>
        <Panel title="Zone Occupancy" icon={Users}>
          <ChartFrame height={180}>
            <BarChart data={zoneOcc}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="zone" tick={{ ...axisStyle, fontSize: 9.5 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={22} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={C.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartFrame>
        </Panel>
      </div>
    </div>
  );
}

function VisionPage({ running, paused, tracks, queueLen, shelfA, shelfB, fps, latency, onStart, onPause, onStop, scenario, setScenario }) {
  const C = useContext(ThemeContext);
  const [cameraSource, setCameraSource] = useState("demo"); // "demo" | "rtsp" — UI concept only, no browser webcam ever used
  const [rtspUrl, setRtspUrl] = useState("");
  const isDemo = cameraSource === "demo";

  const statusLabel = isDemo ? (running ? (paused ? "Processing (paused)" : "Processing") : "Connected") : "Offline";
  const statusTone = isDemo ? (running && !paused ? "green" : "cyan") : "sub";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Panel title="Edge AI Vision — Camera Input" icon={Video} className="lg:col-span-2">
        <div className="flex items-center gap-1.5 mb-3">
          <button
            onClick={() => setCameraSource("demo")}
            style={{ background: isDemo ? "rgba(34,211,238,0.12)" : C.panel2, border: `1px solid ${isDemo ? C.cyan : C.borderLight}`, color: isDemo ? C.cyan : C.sub }}
            className="text-[11.5px] font-medium px-3 py-1.5 rounded-md flex items-center gap-1.5"
          >
            <Video size={12} /> DEMO VIDEO
          </button>
          <button
            onClick={() => setCameraSource("rtsp")}
            style={{ background: !isDemo ? "rgba(79,140,255,0.12)" : C.panel2, border: `1px solid ${!isDemo ? C.blue : C.borderLight}`, color: !isDemo ? C.blue : C.sub }}
            className="text-[11.5px] font-medium px-3 py-1.5 rounded-md flex items-center gap-1.5"
          >
            <Radio size={12} /> RTSP CAMERA
          </button>
        </div>

        {isDemo ? (
          <>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <select value={scenario} onChange={(e) => setScenario(e.target.value)} disabled={running}
                style={{ background: C.panel2, border: `1px solid ${C.borderLight}`, color: C.text }}
                className="text-[12px] rounded-md px-2.5 py-1.5 disabled:opacity-50">
                {Object.entries(SCENARIOS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
              <button onClick={onStart} disabled={running} style={{ background: "rgba(34,211,238,0.12)", border: `1px solid ${C.cyan}`, color: C.cyan }} className="text-[12px] font-medium px-3 py-1.5 rounded-md disabled:opacity-40 flex items-center gap-1.5">
                <Play size={12} /> Start Analysis
              </button>
              <button onClick={onPause} disabled={!running} style={{ background: C.panel2, border: `1px solid ${C.borderLight}`, color: C.amber }} className="text-[12px] font-medium px-3 py-1.5 rounded-md disabled:opacity-40 flex items-center gap-1.5">
                <Pause size={12} /> {paused ? "Resume" : "Pause"}
              </button>
              <button onClick={onStop} disabled={!running} style={{ background: C.panel2, border: `1px solid ${C.borderLight}`, color: C.red }} className="text-[12px] font-medium px-3 py-1.5 rounded-md disabled:opacity-40 flex items-center gap-1.5">
                <Square size={12} /> Stop
              </button>
              <span className="ml-auto"><Badge tone="purple"><ShieldCheck size={11} /> Faces are not identified or stored</Badge></span>
            </div>
            <VisionCanvas tracks={tracks} running={running} queueLen={queueLen} shelfA={shelfA} shelfB={shelfB} />
            <p style={{ color: C.faint }} className="text-[11px] mt-2">
              Sample retail camera stream (DEMO MODE simulated detections). Architecture is inference-ready for a live YOLO + ByteTrack pipeline — see System Architecture.
            </p>
          </>
        ) : (
          <>
            <div style={{ background: C.panel2, border: `1px solid ${C.borderLight}` }} className="rounded-lg p-5">
              <div className="flex items-start gap-2 mb-4">
                <Radio size={16} style={{ color: C.blue }} className="mt-0.5" />
                <div>
                  <p style={{ color: C.text }} className="text-[13px] font-medium">RTSP Camera Source — Deployment Configuration</p>
                  <p style={{ color: C.faint }} className="text-[11.5px] mt-1 leading-relaxed">
                    In deployment, the edge/backend service opens this RTSP stream directly with OpenCV — the
                    browser never requests camera access. This panel configures the source only; it does not
                    connect to a real camera in this hosted demo.
                  </p>
                </div>
              </div>
              <label style={{ color: C.sub }} className="text-[11px] font-medium block mb-1.5">RTSP stream URL</label>
              <input
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                placeholder="rtsp://camera-ip:554/stream"
                style={{ background: C.panel, border: `1px solid ${C.borderLight}`, color: C.text }}
                className="w-full rounded-md px-3 py-2 text-[12.5px] font-mono mb-3"
              />
              <button
                disabled
                style={{ background: C.panel, border: `1px solid ${C.borderLight}`, color: C.faint }}
                className="text-[12px] font-medium px-3 py-1.5 rounded-md cursor-not-allowed flex items-center gap-1.5"
              >
                <Radio size={12} /> Connect (backend-managed — disabled in browser demo)
              </button>
            </div>
            <div className="mt-3">
              <VisionCanvas tracks={[]} running={false} queueLen={0} shelfA={0} shelfB={0} />
            </div>
            <p style={{ color: C.faint }} className="text-[11px] mt-2">
              Switch back to DEMO VIDEO to continue the live simulated walkthrough.
            </p>
          </>
        )}
      </Panel>

      <div className="space-y-5">
        <Panel title="Camera Source" icon={Camera}>
          <div className="space-y-2 text-[12.5px]">
            <div className="flex items-center justify-between"><span style={{ color: C.sub }}>Camera</span><span style={{ color: C.text }} className="font-mono text-[12px]">Selected Demo Stream</span></div>
            <div className="flex items-center justify-between"><span style={{ color: C.sub }}>Source</span><Badge tone={isDemo ? "cyan" : "blue"}>{isDemo ? "Demo Video" : "RTSP Camera"}</Badge></div>
            <div className="flex items-center justify-between"><span style={{ color: C.sub }}>Status</span><Badge tone={statusTone}><Circle size={7} fill="currentColor" /> {statusLabel}</Badge></div>
            <div className="flex items-center justify-between"><span style={{ color: C.sub }}>Stream</span><span style={{ color: C.text }} className="font-mono text-[12px]">{isDemo ? "1920×1080 · 25 FPS" : "—"}</span></div>
            <div className="flex items-center justify-between"><span style={{ color: C.sub }}>Inference</span><span style={{ color: C.text }} className="font-mono text-[12px]">Local Edge AI</span></div>
          </div>
        </Panel>

        <Panel title="Technical Status" icon={Cpu}>
          <div className="space-y-2 text-[12.5px]">
            {[
              ["Camera", isDemo ? "Connected" : "Offline", isDemo ? "green" : "sub"], ["Video Stream", isDemo && running ? "Active" : "Idle", isDemo && running ? "green" : "sub"],
              ["AI Model", "YOLOv8n", "cyan"], ["Inference", "Local", "cyan"],
              ["Tracking", isDemo && running ? "Active (ByteTrack)" : "Idle", isDemo && running ? "green" : "sub"], ["Database", "SQLite", "sub"],
            ].map(([k, v, tone]) => (
              <div key={k} className="flex items-center justify-between">
                <span style={{ color: C.sub }}>{k}</span>
                <Badge tone={tone}>{v}</Badge>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}` }} className="pt-2 grid grid-cols-2 gap-2 mt-2">
              <div><p style={{ color: C.faint }} className="text-[10.5px]">FPS</p><p className="font-mono text-[15px]">{isDemo && running ? fps : "—"}</p></div>
              <div><p style={{ color: C.faint }} className="text-[10.5px]">Latency</p><p className="font-mono text-[15px]">{isDemo && running ? `${latency}ms` : "—"}</p></div>
              <div><p style={{ color: C.faint }} className="text-[10.5px]">Detected Objects</p><p className="font-mono text-[15px]">{isDemo ? tracks.length : 0}</p></div>
              <div><p style={{ color: C.faint }} className="text-[10.5px]">Active Tracks</p><p className="font-mono text-[15px]">{isDemo ? tracks.length : 0}</p></div>
            </div>
          </div>
        </Panel>

        <Panel title="Tracked Shoppers" icon={Users} right={<Badge tone="sub">{isDemo ? tracks.length : 0}</Badge>}>
          <div className="max-h-[220px] overflow-y-auto space-y-1.5">
            {(!isDemo || tracks.length === 0) && <p style={{ color: C.faint }} className="text-[12px] text-center py-4">No active tracks</p>}
            {isDemo && tracks.map((t) => {
              const dwell = Math.round((now() - t.entry) / 1000);
              const zone = ZONES[zoneOf(t.x, t.y)]?.label || "Aisle";
              return (
                <div key={t.id} style={{ background: C.panel2, border: `1px solid ${C.border}` }} className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] font-mono">
                  <span style={{ color: C.cyan }}>{t.id}</span>
                  <span style={{ color: C.sub }}>{zone}</span>
                  <span style={{ color: C.faint }}>{dwell}s</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ShopperPage({ footfall, totalFootfall, entryCount, exitCount, avgDwell, footfallHist, dwellDist, zoneOcc, tracks, peakFootfallPoint }) {
  const C = useContext(ThemeContext);
  const axisStyle = getAxisStyle(C);
  const tooltipStyle = getTooltipStyle(C);
  const trendPct = footfallHist.length > 5
    ? Math.round(safeNum(((footfallHist.at(-1).footfall - footfallHist[0].footfall) / Math.max(1, footfallHist[0].footfall)) * 100, 0))
    : 0;
  const maxZoneCount = Math.max(1, ...zoneOcc.map((z) => safeNum(z.count)));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Current Visitors" value={tracks.length} icon={Activity} tone="blue" />
        <KPI label="Total Footfall (session)" value={totalFootfall} icon={Users} tone="cyan" />
        <KPI label="Entry Count" value={entryCount} icon={TrendingUp} tone="green" />
        <KPI label="Exit Count" value={exitCount} icon={TrendingUp} tone="amber" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Avg Dwell Time" value={avgDwell} unit="sec" icon={Clock} tone="purple" />
        <KPI label="Peak Traffic Point" value={peakFootfallPoint.t} icon={TrendingUp} tone="amber" />
        <KPI label="Visitors / hr (current)" value={footfall} icon={Users} tone="cyan" />
        <KPI label="Zones Tracked" value={zoneOcc.length} icon={MapPin} tone="blue" />
      </div>
      {footfallHist.length > 4 && (
        <div style={{ background: "rgba(34,211,238,0.06)", border: `1px solid rgba(34,211,238,0.25)` }} className="rounded-lg px-4 py-2.5 text-[12.5px] flex items-center gap-2">
          <TrendingUp size={14} style={{ color: C.cyan }} />
          <span>Traffic is {Math.abs(trendPct)}% {trendPct >= 0 ? "higher" : "lower"} than the start of this session.</span>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Footfall vs Time" icon={TrendingUp}>
          <ChartFrame height={220}>
            <AreaChart data={footfallHist}>
              <defs><linearGradient id="ff2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.cyan} stopOpacity={0.4} /><stop offset="100%" stopColor={C.cyan} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="t" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={26} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="footfall" stroke={C.cyan} fill="url(#ff2)" strokeWidth={2} />
            </AreaChart>
          </ChartFrame>
        </Panel>
        <Panel title="Dwell Time Distribution" icon={Clock}>
          <ChartFrame height={220}>
            <BarChart data={dwellDist}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={22} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={C.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartFrame>
        </Panel>
      </div>
      <Panel title="Zone-wise Shopper Count" icon={Users}>
        <ChartFrame height={200}>
          <BarChart data={zoneOcc} layout="vertical">
            <CartesianGrid stroke={C.border} horizontal={false} />
            <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="zone" tick={axisStyle} axisLine={false} tickLine={false} width={80} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill={C.purple} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartFrame>
      </Panel>
      <Panel title="Zone Heatmap" icon={MapPin} right={<span style={{ color: C.faint }} className="text-[10.5px]">based on anonymous track density</span>}>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {zoneOcc.map((z) => {
            const intensity = safeNum(z.count) / maxZoneCount;
            return (
              <div
                key={z.zone}
                style={{
                  background: `rgba(34,211,238,${0.08 + intensity * 0.35})`,
                  border: `1px solid ${intensity > 0.6 ? C.cyan : C.border}`,
                }}
                className="rounded-lg p-3 flex flex-col items-center justify-center text-center"
              >
                <span style={{ color: C.text }} className="text-lg font-semibold tabular-nums">{z.count}</span>
                <span style={{ color: C.faint }} className="text-[10px] mt-0.5">{z.zone}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function QueuePage({ queueLen, queueHist, queueStatus, queueTone, running, maxQueueSession }) {
  const C = useContext(ThemeContext);
  const axisStyle = getAxisStyle(C);
  const tooltipStyle = getTooltipStyle(C);
  const avgWait = safeNum(Math.round(queueLen * 38 + 20), 20);
  const waitMin = Math.floor(avgWait / 60);
  const waitSec = avgWait % 60;
  const trend = queueHist.length > 3 ? (safeNum(queueHist.at(-1).queue) - safeNum(queueHist.at(-3).queue)) : 0;
  const checkoutUtilization = clamp(Math.round((queueLen / 16) * 100), 0, 100);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Current Queue Length" value={queueLen} unit="people" icon={ListOrdered} tone={queueTone} />
        <KPI label="Est. Waiting Time" value={`${waitMin}:${String(waitSec).padStart(2, "0")}`} icon={Clock} tone="blue" />
        <KPI label="Peak Queue (session)" value={maxQueueSession} unit="people" icon={TrendingUp} tone="purple" />
        <KPI label="Checkout Utilization" value={checkoutUtilization} unit="%" icon={Gauge} tone={checkoutUtilization > 75 ? "red" : "green"} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-4 flex items-center justify-between">
          <div>
            <span style={{ color: C.sub }} className="text-[11px] block mb-1.5">Queue Status</span>
            <Badge tone={queueTone}>{queueStatus}</Badge>
          </div>
          <div className="text-right">
            <span style={{ color: C.sub }} className="text-[11px] block mb-1">Trend</span>
            <span style={{ color: trend > 0 ? C.red : trend < 0 ? C.green : C.faint }} className="text-[12.5px] font-medium">
              {trend > 0 ? `▲ Increasing` : trend < 0 ? `▼ Decreasing` : "— Stable"}
            </span>
          </div>
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
          <span style={{ color: C.sub }} className="text-[11px] block mb-1.5">Recommendation</span>
          <span style={{ color: C.text }} className="text-[13px] font-medium">
            {queueLen > 14 ? "Deploy staff / open backup counter" : queueLen > 8 ? "Open additional checkout counter" : "No action required"}
          </span>
        </div>
      </div>
      <Panel title="Queue Length Over Time" icon={ListOrdered}>
        <ChartFrame height={240}>
          <AreaChart data={queueHist}>
            <defs><linearGradient id="q1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.amber} stopOpacity={0.35} /><stop offset="100%" stopColor={C.amber} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke={C.border} vertical={false} />
            <XAxis dataKey="t" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={26} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="queue" stroke={C.amber} fill="url(#q1)" strokeWidth={2} />
          </AreaChart>
        </ChartFrame>
      </Panel>
      <Panel title="Queue Decision Rules" icon={Cpu}>
        <div className="space-y-2 text-[12.5px]">
          <div className="flex items-center gap-2"><ChevronRight size={13} style={{ color: C.faint }} /><span style={{ color: C.sub }}>IF queue length &gt; 8 → </span><span>"Long Queue" alert triggered</span></div>
          <div className="flex items-center gap-2"><ChevronRight size={13} style={{ color: C.faint }} /><span style={{ color: C.sub }}>IF sustained high queue → </span><span>Recommend opening an additional checkout counter</span></div>
          <div className="flex items-center gap-2"><ChevronRight size={13} style={{ color: C.faint }} /><span style={{ color: C.sub }}>IF queue length &gt; 14 → </span><span>Critical congestion escalation — deploy staff / backup counter</span></div>
        </div>
      </Panel>
    </div>
  );
}

function ShelfPage({ shelfA, shelfB }) {
  const C = useContext(ThemeContext);
  const shelves = [
    { name: "Shelf Zone A", val: safeNum(shelfA, 0), sku: "Packaged Snacks · Aisle 2" },
    { name: "Shelf Zone B", val: safeNum(shelfB, 0), sku: "Beverages · Aisle 3" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {shelves.map((s) => (
          <Panel key={s.name} title={s.name} icon={PackageSearch} right={<Badge tone={s.val < 30 ? "red" : s.val < 55 ? "amber" : "green"}>{s.val < 30 ? "Potential Stock-Out" : s.val < 55 ? "Low" : "Well Stocked"}</Badge>}>
            <p style={{ color: C.faint }} className="text-[11.5px] mb-3">{s.sku}</p>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-3xl font-semibold tabular-nums">{s.val}%</span>
              <span style={{ color: C.sub }} className="text-[11.5px] mb-1">shelf occupancy</span>
            </div>
            <div style={{ background: C.panel2 }} className="h-2.5 rounded-full overflow-hidden">
              <div style={{ width: `${s.val}%`, background: s.val < 30 ? C.red : s.val < 55 ? C.amber : C.green, transition: "width 0.6s ease" }} className="h-full rounded-full" />
            </div>
            {s.val < 30 && (
              <div style={{ background: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.3)` }} className="mt-3 rounded-lg px-3 py-2 text-[12px] flex items-center gap-2">
                <AlertTriangle size={13} style={{ color: C.red }} /> Restock required — {s.name}
              </div>
            )}
          </Panel>
        ))}
      </div>
      <Panel title="Method" icon={Info}>
        <p style={{ color: C.sub }} className="text-[12.5px] leading-relaxed">
          Shelf status is derived from ROI-based occupancy analysis (region shrinkage vs. a calibrated baseline), not SKU-level product classification.
          Results are reported as <span style={{ color: C.text }}>"Potential Stock-Out"</span> rather than exact inventory counts — the MVP does not claim
          precise SKU-level detection.
        </p>
      </Panel>
    </div>
  );
}

function DecisionPage({ recommendations, alerts, forecast }) {
  const C = useContext(ThemeContext);
  const activeAlerts = alerts.filter((a) => a.status === "active");
  return (
    <div className="space-y-5">
      <Panel title="Analytics & Decision Engine" icon={Cpu}>
        <p style={{ color: C.sub }} className="text-[12.5px] mb-4 leading-relaxed">
          Fuses shopper, shelf and queue analytics through a rule-based engine to produce alerts, predictions and recommendations — each with a stated reason.
        </p>
        <div className="space-y-2.5">
          {recommendations.map((r, i) => (
            <div key={i} style={{ background: C.panel2, border: `1px solid ${C.border}` }} className="rounded-lg px-3.5 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium" style={{ color: C.text }}>{r.action}</p>
                <p style={{ color: C.faint }} className="text-[11.5px] mt-0.5">Reason: {r.trigger}</p>
              </div>
              <Badge tone={r.severity === "high" ? "red" : r.severity === "medium" ? "amber" : "green"}>{r.severity}</Badge>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Crowd Forecast" icon={TrendingUp} right={<Badge tone="purple">Forecast / Prediction</Badge>}>
        {forecast ? (
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span style={{ color: C.sub }} className="text-[11px] block">Current</span>
              <span style={{ color: C.text }} className="text-2xl font-semibold tabular-nums">{forecast.current}</span>
              <span style={{ color: C.faint }} className="text-xs ml-1">visitors/hr</span>
            </div>
            <ChevronRight size={18} style={{ color: C.faint }} />
            <div>
              <span style={{ color: C.sub }} className="text-[11px] block">Projected (near-term)</span>
              <span style={{ color: forecast.rising ? C.amber : C.text }} className="text-2xl font-semibold tabular-nums">{forecast.projected}</span>
              <span style={{ color: C.faint }} className="text-xs ml-1">visitors/hr</span>
            </div>
            <div className="ml-auto">
              <span style={{ color: C.sub }} className="text-[11px] block mb-1">Recommendation</span>
              <span style={{ color: C.text }} className="text-[12.5px] font-medium">
                {forecast.rising ? "Prepare additional staff" : forecast.falling ? "No proactive action needed" : "Continue monitoring"}
              </span>
            </div>
          </div>
        ) : (
          <p style={{ color: C.faint }} className="text-[12px]">Not enough session history yet to estimate a trend — keep the demo running for a few ticks.</p>
        )}
        <p style={{ color: C.faint }} className="text-[10.5px] mt-3">
          Lightweight trend-based estimate from recent simulated footfall history — not a production ML forecasting model.
        </p>
      </Panel>

      <Panel title="Full Alert Log" icon={AlertTriangle} right={<Badge tone="sub">{activeAlerts.length} active · {alerts.length} total</Badge>}>
        <div className="max-h-[400px] overflow-y-auto">
          {alerts.length === 0 ? (
            <p style={{ color: C.faint }} className="text-[12.5px] py-6 text-center">No alerts generated yet.</p>
          ) : alerts.map((a) => <AlertRow key={a.id} a={a} />)}
        </div>
      </Panel>
    </div>
  );
}

function ArchitecturePage({ running }) {
  const C = useContext(ThemeContext);
  const stages = [
    { label: "CCTV / Smart Camera", icon: Camera },
    { label: "Video Pre-Processing", icon: Zap },
    { label: "Edge AI Inference (YOLO)", icon: Cpu },
  ];
  const branches = [
    { label: "Shopper Analytics", icon: Users },
    { label: "Shelf Analytics", icon: PackageSearch },
    { label: "Queue Analytics", icon: ListOrdered },
  ];
  const tail = [
    { label: "Analytics & Decision Engine", icon: Cpu },
    { label: "Alerts & Recommendations", icon: AlertTriangle },
    { label: "Local Retail Dashboard", icon: LayoutDashboard },
    { label: "Optional Cloud Sync", icon: Database },
  ];
  const Node = ({ s }) => (
    <div style={{ background: C.panel, border: `1px solid ${C.borderLight}` }} className="rounded-xl px-4 py-3 flex items-center gap-2.5 relative">
      <s.icon size={16} style={{ color: C.cyan }} />
      <span className="text-[12.5px] font-medium">{s.label}</span>
      {running && <span style={{ background: C.cyan }} className="absolute -right-1 -top-1 w-2 h-2 rounded-full animate-pulse" />}
    </div>
  );
  const Arrow = () => (
    <div className="flex justify-center py-1">
      <div style={{ width: 1, height: 20, background: C.borderLight }} className="relative">
        {running && <div style={{ background: C.cyan }} className="absolute w-1.5 h-1.5 rounded-full -left-[2.5px] animate-pulse" />}
      </div>
    </div>
  );
  return (
    <div className="space-y-5">
      <Panel title="System Architecture" icon={Network}>
        <div className="max-w-md mx-auto">
          {stages.map((s, i) => <React.Fragment key={s.label}><Node s={s} />{i < stages.length - 1 && <Arrow />}</React.Fragment>)}
          <Arrow />
          <div className="grid grid-cols-3 gap-2">
            {branches.map((b) => <Node key={b.label} s={b} />)}
          </div>
          <Arrow />
          {tail.map((s, i) => <React.Fragment key={s.label}><Node s={s} />{i < tail.length - 1 && <Arrow />}</React.Fragment>)}
        </div>
      </Panel>
      <Panel title="Deployment Architecture (target)" icon={Network} right={<span style={{ color: C.faint }} className="text-[10.5px]">multi-camera ready</span>}>
        <div style={{ color: C.sub }} className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap">
{`CCTV / IP Camera (CAM-01..N)
        ↓
RTSP Video Stream
        ↓
Edge Computer / Jetson
        ↓
OpenCV Video Processing
        ↓
YOLO Person/Object Detection
        ↓
ByteTrack / BoT-SORT Tracking
        ↓
Shopper + Queue + Shelf Analytics
        ↓
Analytics & Decision Engine
        ↓
Alerts + Recommendations
        ↓
RetailEdge Dashboard (this app)`}
        </div>
        <p style={{ color: C.faint }} className="text-[11px] mt-3">
          Multiple camera streams feed the same Edge AI + Analytics pipeline and are unified into one dashboard —
          this prototype demonstrates the multi-camera pipeline with simulated sources. A selected demo stream is shown in the Live Vision view.
        </p>
      </Panel>
      <Panel title="Privacy by Design" icon={ShieldCheck}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Inference", "ON-DEVICE / LOCAL", "cyan"], ["Cloud", "OPTIONAL", "blue"],
            ["Identity", "ANONYMOUS", "purple"], ["Facial Recognition", "DISABLED", "green"],
          ].map(([k, v, tone]) => (
            <div key={k} style={{ background: C.panel2, border: `1px solid ${C.border}` }} className="rounded-lg p-3">
              <p style={{ color: C.faint }} className="text-[10.5px]">{k}</p>
              <p className="mt-1"><Badge tone={tone}>{v}</Badge></p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CamerasPage({ running }) {
  const C = useContext(ThemeContext);
  const cameras = [
    { id: "CAM-01", label: "Entrance", live: false },
    { id: "CAM-02", label: "Checkout", live: false },
    { id: "CAM-03", label: "Aisle 1", live: false },
    { id: "CAM-04", label: "Shelf Area", live: false },
  ];
  return (
    <div className="space-y-5">
      <div style={{ background: "rgba(251,191,36,0.08)", border: `1px solid rgba(251,191,36,0.3)` }} className="rounded-lg px-4 py-2.5 text-[12.5px] flex items-center gap-2">
        <Info size={14} style={{ color: C.amber }} />
        <span style={{ color: C.text }}>DEMO MODE — camera sources below are simulated and RTSP-ready. The selected demo stream is shown on the Live Vision page.</span>
      </div>
      <Panel title="Camera Sources" icon={Camera}>
        <div className="space-y-2">
          {cameras.map((c) => (
            <div key={c.id} style={{ background: C.panel2, border: `1px solid ${C.border}` }} className="flex items-center justify-between px-3.5 py-3 rounded-lg">
              <div className="flex items-center gap-3">
                <Video size={15} style={{ color: c.live ? C.green : C.faint }} />
                <div>
                  <p style={{ color: C.text }} className="text-[13px] font-medium">{c.id} — {c.label}</p>
                  <p style={{ color: C.faint }} className="text-[11px]">Demo / simulated source · RTSP-ready</p>
                </div>
              </div>
              <Badge tone={c.live ? "green" : "sub"}>
                <Circle size={7} fill="currentColor" /> {c.live ? "Online · Simulating" : "Online (idle)"}
              </Badge>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Multi-Camera Architecture" icon={Network}>
        <div style={{ color: C.sub }} className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap">
{`Camera 1 ─┐
Camera 2 ─┼→ Edge AI → Unified Analytics → Dashboard
Camera 3 ─┘`}
        </div>
        <p style={{ color: C.faint }} className="text-[11px] mt-3">
          The prototype does not require multiple physical cameras — it demonstrates the pipeline with one
          simulated stream, in an architecture that already generalizes to N cameras feeding the same engine.
        </p>
      </Panel>
    </div>
  );
}

function HealthPage({ running, cpuUsage, gpuUsage, memUsage, fps, latency, tracks }) {
  const C = useContext(ThemeContext);
  const cpu = safeNum(cpuUsage, 0);
  const gpu = safeNum(gpuUsage, 0);
  const mem = safeNum(memUsage, 0);
  return (
    <div className="space-y-5">
      <div style={{ background: "rgba(79,140,255,0.08)", border: `1px solid rgba(79,140,255,0.3)` }} className="rounded-lg px-4 py-2.5 text-[12.5px] flex items-center gap-2">
        <Info size={14} style={{ color: C.blue }} />
        <span style={{ color: C.text }}>Demo telemetry — CPU/GPU/memory below are simulated and scale with active track count, not read from real hardware.</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="CPU Utilization" value={cpu} unit="%" icon={Cpu} tone={cpu > 80 ? "red" : "cyan"} />
        <KPI label="GPU Utilization" value={gpu} unit="%" icon={Zap} tone={gpu > 80 ? "red" : "purple"} />
        <KPI label="Memory Usage" value={mem} unit="%" icon={Database} tone={mem > 80 ? "red" : "blue"} />
        <KPI label="Active Camera Streams" value={running ? 1 : 0} icon={Video} tone={running ? "green" : "sub"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Inference FPS" value={running ? fps : 0} icon={Activity} tone="cyan" />
        <KPI label="Inference Latency" value={running ? latency : 0} unit="ms" icon={Clock} tone="blue" />
        <KPI label="Active Tracks" value={tracks.length} icon={Users} tone="purple" />
        <KPI label="Model Status" value={running ? "Loaded" : "Idle"} icon={CheckCircle2} tone={running ? "green" : "sub"} />
      </div>
      <Panel title="Edge Device Status" icon={Cpu}>
        <div className="space-y-2 text-[12.5px]">
          {[
            ["Model", "YOLOv8n · Loaded", "cyan"],
            ["Tracker", running ? "ByteTrack · Active" : "ByteTrack · Idle", running ? "green" : "sub"],
            ["Database", "SQLite · Connected", "sub"],
            ["Edge Compute", "Simulated (Jetson-class target)", "purple"],
          ].map(([k, v, tone]) => (
            <div key={k} className="flex items-center justify-between">
              <span style={{ color: C.sub }}>{k}</span>
              <Badge tone={tone}>{v}</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ReportsPage({ totalFootfall, avgDwell, maxQueueSession, peakFootfallPoint, alerts, recommendations, footfallHist, queueHist }) {
  const C = useContext(ThemeContext);
  const stockAlertCount = alerts.filter((a) => a.type === "shelfA" || a.type === "shelfB").length;
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length;

  const handleExportCSV = () => {
    try {
      const rows = [["time", "footfall_per_hr", "queue_length"]];
      const len = Math.max(footfallHist.length, queueHist.length);
      for (let i = 0; i < len; i++) {
        rows.push([footfallHist[i]?.t || queueHist[i]?.t || "", footfallHist[i]?.footfall ?? "", queueHist[i]?.queue ?? ""]);
      }
      const csv = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `retailedge-session-report-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("RetailEdge AI — CSV export failed:", err);
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Session Report" icon={FileText} right={
        <button onClick={handleExportCSV} style={{ background: "rgba(34,211,238,0.12)", border: `1px solid ${C.cyan}`, color: C.cyan }} className="text-[12px] font-medium px-3 py-1.5 rounded-md flex items-center gap-1.5">
          <Download size={12} /> Export CSV
        </button>
      }>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Session Visitors" value={totalFootfall} icon={Users} tone="cyan" />
          <KPI label="Peak Hour Point" value={peakFootfallPoint.t} icon={TrendingUp} tone="amber" />
          <KPI label="Avg Dwell Time" value={avgDwell} unit="sec" icon={Clock} tone="purple" />
          <KPI label="Max Queue (session)" value={maxQueueSession} unit="people" icon={ListOrdered} tone="blue" />
          <KPI label="Stock Alerts" value={stockAlertCount} icon={PackageSearch} tone={stockAlertCount ? "amber" : "green"} />
          <KPI label="Resolved Alerts" value={resolvedCount} icon={CheckCircle2} tone="green" />
        </div>
      </Panel>
      <Panel title="Operational Recommendations" icon={Cpu}>
        <div className="space-y-2">
          {recommendations.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span style={{ color: C.text }}>{r.action}</span>
              <Badge tone={r.severity === "high" ? "red" : r.severity === "medium" ? "amber" : "green"}>{r.severity}</Badge>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Alert History" icon={AlertTriangle} right={<Badge tone="sub">{alerts.length} total</Badge>}>
        <div className="max-h-[320px] overflow-y-auto">
          {alerts.length === 0 ? (
            <p style={{ color: C.faint }} className="text-[12.5px] py-6 text-center">No alerts recorded this session.</p>
          ) : alerts.map((a) => <AlertRow key={a.id} a={a} />)}
        </div>
      </Panel>
    </div>
  );
}