// 理財目標 — allocation engine + projection timeline + goals grouped by tier
const { useState, useMemo, useRef, useEffect } = React;

const SURPLUS = 35800; // this-month surplus (mock; pulled from latest MonthlySummary)
const NOW = new Date(2026, 4, 18); // May 18, 2026

// add months to a date
const addMonths = (d, n) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};
const yyyymm = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const etaLabel = (months) => {
  if (months <= 0) return "已達標";
  const d = addMonths(NOW, months);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (months < 12) return `${months} 個月後 · ${y}/${String(m).padStart(2,"0")}`;
  return `${Math.floor(months/12)} 年 ${months%12 ? months%12 + " 個月" : ""} 後 · ${y}/${String(m).padStart(2,"0")}`;
};

// ===== allocation engine =================================================
function Allocator({ allocation, onChange }) {
  // allocation: { "短期": 50, "中期": 30, "長期": 20 } as %
  const tiers = ["短期", "中期", "長期"];
  const total = tiers.reduce((a,t) => a + allocation[t], 0);

  // drag handler for splitter handles
  const trackRef = useRef(null);

  // compute pixel positions
  const a = allocation["短期"];
  const b = a + allocation["中期"];

  const onDrag = (which) => (e) => {
    e.preventDefault();
    const rect = trackRef.current.getBoundingClientRect();
    const move = (ev) => {
      const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const rounded = Math.round(pct);
      if (which === "a") {
        if (rounded < b - 5) {
          onChange({ ...allocation, "短期": rounded, "中期": 100 - rounded - allocation["長期"] });
        }
      } else {
        if (rounded > a + 5 && rounded < 95) {
          onChange({ ...allocation, "中期": rounded - a, "長期": 100 - rounded });
        }
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <section className="card alloc-card">
      <div className="alloc-grid">
        <div className="alloc-left">
          <div className="card-sub muted">本月可配置結餘</div>
          <div className="alloc-figure">
            <span className="currency">NT$</span>
            <span className="amount">{SURPLUS.toLocaleString("en-US")}</span>
          </div>
          <div className="card-sub muted" style={{marginTop: 6}}>
            來自 2026/05 結餘 · 自動依比例分配至各層級目標
          </div>
        </div>
        <div className="alloc-right">
          <div className="alloc-head">
            <span className="card-title">配置比例</span>
            <button className="link-btn">恢復預設 (50/30/20)</button>
          </div>

          <div className="alloc-track" ref={trackRef}>
            <div className="alloc-seg seg-pos"  style={{ left: 0,         width: `${a}%` }}></div>
            <div className="alloc-seg seg-warn" style={{ left: `${a}%`,   width: `${allocation["中期"]}%` }}></div>
            <div className="alloc-seg seg-info" style={{ left: `${b}%`,   width: `${allocation["長期"]}%` }}></div>
            <button className="alloc-handle" style={{ left: `${a}%` }} onPointerDown={onDrag("a")} aria-label="調整 短期/中期 分界"/>
            <button className="alloc-handle" style={{ left: `${b}%` }} onPointerDown={onDrag("b")} aria-label="調整 中期/長期 分界"/>
          </div>

          <div className="alloc-rows">
            {tiers.map(t => {
              const pct = allocation[t];
              const amt = Math.round(SURPLUS * pct / 100);
              const meta = TIER_META[t];
              return (
                <div key={t} className="alloc-row">
                  <span className="alloc-dot" style={{ background: meta.color }}></span>
                  <div className="alloc-row-l">
                    <strong>{t}</strong>
                    <span className="muted"> · {meta.range}</span>
                  </div>
                  <div className="alloc-row-pct num">{pct}%</div>
                  <div className="alloc-row-amt num">{fmt(amt)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== timeline / projection =============================================
function ProjectionTimeline({ goals }) {
  // Long-term goals (退休 / 大學基金 etc.) can be 15+ years out, which makes a
  // linear axis useless for the short-term cluster. Use a sqrt scale so the
  // first few years take up most of the canvas and out-years compress.
  const maxMonths = Math.max(...goals.map(g => g.etaMonths), 12);

  // Pick a handful of human-readable year ticks that fit the actual range.
  const yearOffsets = useMemo(() => {
    const candidates = [0, 1, 2, 3, 5, 8, 12, 20, 35, 50];
    return candidates.filter(y => y * 12 <= maxMonths + 6);
  }, [maxMonths]);

  // sqrt scale: x = sqrt(months / max)
  const xFor = (months) => Math.sqrt(Math.max(0, months) / maxMonths);

  // assign y offsets within each tier band so pin cards don't stack
  const TIER_BAND_CENTER = { "短期": 0.16, "中期": 0.50, "長期": 0.82 };
  const placedGoals = useMemo(() => {
    const out = [];
    for (const tier of ["短期", "中期", "長期"]) {
      const list = goals.filter(g => g.tier === tier).sort((a,b) => a.etaMonths - b.etaMonths);
      list.forEach((g, i) => {
        // stagger up/down from band center
        const stagger = (i % 3 === 0) ? 0 : (i % 3 === 1 ? -0.06 : 0.07);
        out.push({ ...g, _x: xFor(g.etaMonths), _y: TIER_BAND_CENTER[tier] + stagger });
      });
    }
    return out;
  }, [goals, maxMonths]);

  return (
    <section className="card proj-card">
      <div className="card-head">
        <div>
          <div className="card-title">完成預測</div>
          <div className="card-sub muted">依目前配置與每月投入推算完成時間 · 平方根時間軸 (近期較寬、遠期壓縮)</div>
        </div>
        <div className="legend">
          <span><span className="legend-dot" style={{ background: "var(--pos)" }}></span>短期</span>
          <span><span className="legend-dot" style={{ background: "var(--warn)" }}></span>中期</span>
          <span><span className="legend-dot" style={{ background: "var(--info)" }}></span>長期</span>
        </div>
      </div>

      <div className="proj-wrap">
        <div className="proj-axis">
          {yearOffsets.map((y) => {
            const x = xFor(y * 12);
            const dateY = NOW.getFullYear() + y;
            return (
              <span key={y} className={"proj-tick " + (y === 0 ? "proj-tick-now" : "")} style={{ left: `${x*100}%` }}>
                {y === 0 ? "今天" : `+${y}年`}
                <em>{dateY}</em>
              </span>
            );
          })}
        </div>
        <div className="proj-canvas">
          <div className="proj-band" style={{ top: `${TIER_BAND_CENTER["短期"]*100 - 6}%` }}>短期</div>
          <div className="proj-band proj-band-2" style={{ top: `${TIER_BAND_CENTER["中期"]*100 - 6}%` }}>中期</div>
          <div className="proj-band proj-band-3" style={{ top: `${TIER_BAND_CENTER["長期"]*100 - 6}%` }}>長期</div>
          {/* now line */}
          <div className="proj-now" style={{ left: 0 }}></div>
          {placedGoals.map(g => {
            const meta = TIER_META[g.tier];
            return (
              <div key={g.id} className="proj-pin" style={{ left: `${g._x*100}%`, top: `${g._y*100}%`, color: meta.color }}>
                <div className="proj-pin-dot"></div>
                <div className="proj-pin-card">
                  <div className="proj-pin-name">{g.label}</div>
                  <div className="proj-pin-eta">{etaLabel(g.etaMonths)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ===== goal card =========================================================
function GoalCard({ goal, expanded, onExpand, onContribChange }) {
  const meta = TIER_META[goal.tier];
  const pct = (goal.current / goal.target) * 100;
  const remaining = goal.target - goal.current;
  const eta = etaLabel(goal.etaMonths);

  // trajectory: 12 historical-ish points + projected to target
  const trajectory = useMemo(() => {
    const pts = [];
    const months = goal.etaMonths;
    for (let i = 0; i <= 12; i++) {
      const past = Math.max(0, goal.current - (12-i) * goal.monthly * 0.85); // mock past
      pts.push({ x: i / (12 + months), y: past });
    }
    for (let i = 1; i <= months; i++) {
      pts.push({ x: (12 + i) / (12 + months), y: Math.min(goal.target, goal.current + i * goal.monthly) });
    }
    return pts;
  }, [goal]);

  const max = goal.target * 1.05;
  const pathPast = trajectory.slice(0, 13).map((p,i) =>
    `${i === 0 ? "M" : "L"}${p.x*100} ${100 - (p.y/max)*100}`).join(" ");
  const pathFuture = trajectory.slice(12).map((p,i) =>
    `${i === 0 ? "M" : "L"}${p.x*100} ${100 - (p.y/max)*100}`).join(" ");

  return (
    <article className={"goal-card " + (expanded ? "expanded " : "") + (goal.pinned ? "pinned" : "")}>
      <header className="gc-head">
        <div className="gc-head-l">
          <span className="goal-tier" data-tier={goal.tier}>{goal.tier}</span>
          {goal.pinned && (
            <span className="gc-pin" title="已釘選">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/></svg>
            </span>
          )}
        </div>
        <button className="icon-btn ghost" aria-label="更多" onClick={() => onExpand(goal.id)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
        </button>
      </header>

      <h3 className="gc-label">{goal.label}</h3>
      <p className="gc-note muted">{goal.note}</p>

      <div className="gc-fig">
        <span className="gc-current num">{fmtCompact(goal.current)}</span>
        <span className="gc-of muted num">/ {fmtCompact(goal.target)}</span>
        <span className="gc-pct num">{pct.toFixed(1)}%</span>
      </div>

      <div className="gc-track">
        <div className="gc-fill" style={{ width: `${Math.min(100,pct)}%`, background: `linear-gradient(90deg, color-mix(in oklab, ${meta.color} 50%, transparent), ${meta.color})` }}></div>
        <div className="gc-tick" style={{ left: `${Math.min(100,pct)}%`, background: meta.color }}></div>
      </div>

      <div className="gc-trajectory">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="traj-svg">
          <defs>
            <linearGradient id={`grad-${goal.id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"  stopColor={meta.color} stopOpacity="0.25"/>
              <stop offset="100%" stopColor={meta.color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {/* target line */}
          <line x1="0" x2="100" y1={100 - (goal.target/max)*100} y2={100 - (goal.target/max)*100}
                stroke="currentColor" opacity="0.2" strokeWidth="0.4" strokeDasharray="1 1"/>
          {/* current marker */}
          <line x1={trajectory[12].x*100} x2={trajectory[12].x*100} y1="0" y2="60"
                stroke="var(--border-strong)" strokeWidth="0.3" strokeDasharray="1 1"/>
          {/* area */}
          <path d={`${pathPast} L ${trajectory[12].x*100} 60 L 0 60 Z`} fill={`url(#grad-${goal.id})`}/>
          {/* past line */}
          <path d={pathPast}   fill="none" stroke={meta.color} strokeWidth="1.4"/>
          {/* future line */}
          <path d={pathFuture} fill="none" stroke={meta.color} strokeWidth="1.2" strokeDasharray="1.5 1.5" opacity="0.7"/>
          {/* current dot */}
          <circle cx={trajectory[12].x*100} cy={100 - (goal.current/max)*100} r="1.6" fill={meta.color}/>
        </svg>
      </div>

      <footer className="gc-foot">
        <div className="gc-foot-row">
          <span className="muted">本月投入</span>
          <strong className="num pos">+{fmt(goal.monthly)}</strong>
        </div>
        <div className="gc-foot-row">
          <span className="muted">差額</span>
          <strong className="num">{fmt(remaining)}</strong>
        </div>
        <div className="gc-foot-row">
          <span className="muted">預計完成</span>
          <strong>{eta}</strong>
        </div>
      </footer>

      {expanded && (
        <div className="gc-expand">
          <label className="gc-slider-row">
            <span className="muted">月配置</span>
            <input type="range" min="500" max={Math.max(30000, goal.monthly * 3)} step="500"
              value={goal.monthly}
              onChange={(e) => onContribChange(goal.id, parseInt(e.target.value, 10))}/>
            <strong className="num">{fmt(goal.monthly)}</strong>
          </label>
          <div className="gc-actions">
            <button className="btn btn-ghost btn-sm">編輯目標</button>
            <button className="btn btn-ghost btn-sm">暫停</button>
            <button className="btn btn-ghost btn-sm">標記完成</button>
          </div>
        </div>
      )}
    </article>
  );
}

// ===== goals grouped by tier =============================================
function GoalsList({ goals, expandedId, onExpand, onContribChange }) {
  const tiers = ["短期", "中期", "長期"];
  return (
    <section className="goals-list-section">
      {tiers.map(tier => {
        const list = goals.filter(g => g.tier === tier);
        const meta = TIER_META[tier];
        const total = list.reduce((a,g) => a + g.target, 0);
        const current = list.reduce((a,g) => a + g.current, 0);
        const monthly = list.reduce((a,g) => a + g.monthly, 0);
        return (
          <div key={tier} className="tier-block">
            <header className="tier-head">
              <div className="tier-head-l">
                <span className="tier-badge" style={{ background: `color-mix(in oklab, ${meta.color} 14%, var(--bg-elev))`, color: meta.color, borderColor: `color-mix(in oklab, ${meta.color} 30%, var(--border))` }}>
                  {tier}
                </span>
                <div>
                  <div className="tier-title">{tier}目標 <span className="muted">· {meta.range}</span></div>
                  <div className="tier-sub muted">
                    {list.length} 個目標 · 已累積 {fmtCompact(current)} / 目標 {fmtCompact(total)} · 月投入 {fmt(monthly)}
                  </div>
                </div>
              </div>
              <button className="link-btn">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                新增 {tier}目標
              </button>
            </header>
            <div className="tier-grid">
              {list.map(g => (
                <GoalCard key={g.id} goal={g}
                  expanded={expandedId === g.id}
                  onExpand={onExpand}
                  onContribChange={onContribChange}/>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ===== page ==============================================================
function GoalsPage() {
  const [allocation, setAllocation] = useState({ "短期": 50, "中期": 30, "長期": 20 });
  const [goals, setGoals] = useState(GOALS);
  const [expandedId, setExpandedId] = useState(null);

  // when allocation changes, redistribute each tier's monthly across goals
  // for the prototype, just rescale proportionally
  const tieredGoals = useMemo(() => {
    return goals.map(g => {
      const monthly = g.monthly; // keep as-set; user can fine-tune per goal
      const remaining = g.target - g.current;
      const etaMonths = monthly > 0 ? Math.ceil(remaining / monthly) : 999;
      return { ...g, etaMonths };
    });
  }, [goals]);

  const onContribChange = (id, value) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, monthly: value } : g));
  };

  const totalMonthly = goals.reduce((a,g) => a + g.monthly, 0);
  const totalCurrent = goals.reduce((a,g) => a + g.current, 0);
  const totalTarget = goals.reduce((a,g) => a + g.target, 0);

  return (
    <div className="app">
      <Sidebar active="goals"/>
      <main className="main">
        <header className="topbar">
          <div>
            <div className="crumb">理財目標 · Financial Goals</div>
            <h1 className="page-title">理財目標</h1>
            <div className="topbar-sub muted">依結餘自動分配至短中長期，動態推算完成時間</div>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-ghost">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/></svg>
              情境模擬
            </button>
            <button className="btn btn-primary">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              新增目標
            </button>
          </div>
        </header>

        {/* top summary stats */}
        <div className="kpi-strip kpi-4">
          <div className="kpi-tile"><div className="kpi-label">啟用中目標</div><div className="kpi-val">{goals.length}</div></div>
          <div className="kpi-tile"><div className="kpi-label">已累積</div><div className="kpi-val">{fmtCompact(totalCurrent)}</div></div>
          <div className="kpi-tile"><div className="kpi-label">目標總額</div><div className="kpi-val muted-val">{fmtCompact(totalTarget)}</div></div>
          <div className="kpi-tile"><div className="kpi-label">月投入合計</div><div className="kpi-val pos">{fmt(totalMonthly)}</div></div>
        </div>

        <Allocator allocation={allocation} onChange={setAllocation}/>
        <ProjectionTimeline goals={tieredGoals}/>
        <GoalsList goals={tieredGoals} expandedId={expandedId}
          onExpand={(id) => setExpandedId(prev => prev === id ? null : id)}
          onContribChange={onContribChange}/>

        <footer className="page-foot muted">理財目標 · 依每月結餘動態配置儲蓄計畫</footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<GoalsPage/>);
