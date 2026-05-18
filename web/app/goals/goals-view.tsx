"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type GoalView = {
  id: number;
  tier: string;
  label: string;
  currentAmount: number;
  targetAmount: number;
  expectedAnnualReturn: number;
  monthsRemaining: number;
  requiredMonthly: number;
  priority: number;
  targetDate: string | null;
};

type Allocation = Record<"短期" | "中期" | "長期", number>;

const TIER_META: Record<string, { range: string; color: string; weight: number }> = {
  短期: { range: "< 1 年", color: "var(--pos)", weight: 0.50 },
  中期: { range: "1–5 年", color: "var(--warn)", weight: 0.30 },
  長期: { range: "5+ 年", color: "var(--info)", weight: 0.20 },
};

const NOW = new Date();

function addMonthsDate(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

const fmt = (n: number) => "NT$" + Math.round(Math.abs(n)).toLocaleString("zh-TW");
const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return "NT$" + (abs / 1_000_000).toFixed(2) + "M";
  if (abs >= 10_000) return "NT$" + (abs / 1000).toFixed(0) + "K";
  if (abs >= 1_000) return "NT$" + (abs / 1000).toFixed(1) + "K";
  return fmt(n);
};

const etaLabel = (months: number) => {
  if (months <= 0) return "已達標";
  const d = addMonthsDate(NOW, months);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (months < 12) return `${months} 個月後 · ${y}/${String(m).padStart(2, "0")}`;
  return `${Math.floor(months / 12)} 年${months % 12 ? ` ${months % 12} 個月` : ""}後 · ${y}/${String(m).padStart(2, "0")}`;
};

// ===== Allocator =============================================================
function Allocator({
  surplus,
  allocation,
  onChange,
}: {
  surplus: number;
  allocation: Allocation;
  onChange: (next: Allocation) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const a = allocation["短期"];
  const b = a + allocation["中期"];

  const onDrag = (which: "a" | "b") => (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = trackRef.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const rounded = Math.round(pct);
      if (which === "a") {
        if (rounded < b - 5) {
          onChange({ ...allocation, 短期: rounded, 中期: 100 - rounded - allocation["長期"] });
        }
      } else {
        if (rounded > a + 5 && rounded < 95) {
          onChange({ ...allocation, 中期: rounded - a, 長期: 100 - rounded });
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
            <span className="amount">{Math.round(surplus).toLocaleString("zh-TW")}</span>
          </div>
          <div className="card-sub muted" style={{ marginTop: 6 }}>
            依目標層級比例分配至短、中、長期目標。
          </div>
        </div>

        <div className="alloc-right">
          <div className="alloc-head">
            <span className="card-title">配置比例</span>
            <button className="link-btn" type="button" onClick={() => onChange({ 短期: 50, 中期: 30, 長期: 20 })}>
              恢復預設 (50/30/20)
            </button>
          </div>

          <div className="alloc-track" ref={trackRef}>
            <div className="alloc-seg seg-pos" style={{ left: 0, width: `${a}%` }}></div>
            <div className="alloc-seg seg-warn" style={{ left: `${a}%`, width: `${allocation["中期"]}%` }}></div>
            <div className="alloc-seg seg-info" style={{ left: `${b}%`, width: `${allocation["長期"]}%` }}></div>
            <button className="alloc-handle" style={{ left: `${a}%` }} onPointerDown={onDrag("a")} aria-label="調整 短期/中期 分界" />
            <button className="alloc-handle" style={{ left: `${b}%` }} onPointerDown={onDrag("b")} aria-label="調整 中期/長期 分界" />
          </div>

          <div className="alloc-rows">
            {(["短期", "中期", "長期"] as const).map((tier) => (
              <div key={tier} className="alloc-row">
                <span className="alloc-dot" style={{ background: TIER_META[tier].color }}></span>
                <div className="alloc-row-l">
                  <strong>{tier}</strong>
                  <span className="muted"> · {TIER_META[tier].range}</span>
                </div>
                <div className="alloc-row-pct num">{allocation[tier]}%</div>
                <div className="alloc-row-amt num">{fmt((surplus * allocation[tier]) / 100)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== ProjectionTimeline ====================================================
function ProjectionTimeline({ goals }: { goals: GoalView[] }) {
  const maxMonths = Math.max(...goals.map((g) => g.monthsRemaining), 12);

  const yearOffsets = useMemo(() => {
    const candidates = [0, 1, 2, 3, 5, 8, 12, 20, 35, 50];
    return candidates.filter((y) => y * 12 <= maxMonths + 6);
  }, [maxMonths]);

  const xFor = (months: number) => Math.sqrt(Math.max(0, months) / maxMonths);

  const TIER_BAND_CENTER: Record<string, number> = { 短期: 0.16, 中期: 0.50, 長期: 0.82 };

  const placedGoals = useMemo(() => {
    const out: Array<GoalView & { _x: number; _y: number }> = [];
    for (const tier of ["短期", "中期", "長期"]) {
      const list = goals.filter((g) => g.tier === tier).sort((a, b) => a.monthsRemaining - b.monthsRemaining);
      list.forEach((g, i) => {
        const stagger = i % 3 === 0 ? 0 : i % 3 === 1 ? -0.06 : 0.07;
        out.push({ ...g, _x: xFor(g.monthsRemaining), _y: TIER_BAND_CENTER[tier] + stagger });
      });
    }
    return out;
  }, [goals, maxMonths]);

  return (
    <section className="card proj-card">
      <div className="card-head">
        <div>
          <div className="card-title">完成預測</div>
          <div className="card-sub muted">依目前每月需求推算完成時間 · 平方根時間軸（近期較寬、遠期壓縮）</div>
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
              <span key={y} className={`proj-tick${y === 0 ? " proj-tick-now" : ""}`} style={{ left: `${x * 100}%` }}>
                {y === 0 ? "今天" : `+${y}年`}
                <em>{dateY}</em>
              </span>
            );
          })}
        </div>
        <div className="proj-canvas">
          <div className="proj-band" style={{ top: `${TIER_BAND_CENTER["短期"] * 100 - 6}%` }}>短期</div>
          <div className="proj-band proj-band-2" style={{ top: `${TIER_BAND_CENTER["中期"] * 100 - 6}%` }}>中期</div>
          <div className="proj-band proj-band-3" style={{ top: `${TIER_BAND_CENTER["長期"] * 100 - 6}%` }}>長期</div>
          <div className="proj-now" style={{ left: 0 }}></div>
          {placedGoals.map((g) => {
            const meta = TIER_META[g.tier];
            return (
              <div key={g.id} className="proj-pin" style={{ left: `${g._x * 100}%`, top: `${g._y * 100}%`, color: meta.color }}>
                <div className="proj-pin-dot"></div>
                <div className="proj-pin-card">
                  <div className="proj-pin-name">{g.label}</div>
                  <div className="proj-pin-eta">{etaLabel(g.monthsRemaining)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ===== GoalCard ==============================================================
function GoalCard({
  goal,
  expanded,
  onExpand,
  onMonthlyChange,
  onEdit,
}: {
  goal: GoalView;
  expanded: boolean;
  onExpand: (id: number) => void;
  onMonthlyChange: (id: number, monthly: number) => void;
  onEdit: (goal: GoalView) => void;
}) {
  const meta = TIER_META[goal.tier] ?? TIER_META["長期"];
  const pct = goal.targetAmount ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const remaining = goal.targetAmount - goal.currentAmount;
  const monthly = goal.requiredMonthly;
  const months = goal.monthsRemaining;

  const trajectory = useMemo(() => {
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= 12; i++) {
      const past = Math.max(0, goal.currentAmount - (12 - i) * monthly * 0.85);
      pts.push({ x: i / (12 + months), y: past });
    }
    for (let i = 1; i <= Math.min(months, 300); i++) {
      pts.push({ x: (12 + i) / (12 + Math.min(months, 300)), y: Math.min(goal.targetAmount, goal.currentAmount + i * monthly) });
    }
    return pts;
  }, [goal.currentAmount, goal.targetAmount, monthly, months]);

  const max = goal.targetAmount * 1.05 || 1;
  const pathPast = trajectory.slice(0, 13).map((p, i) =>
    `${i === 0 ? "M" : "L"}${p.x * 100} ${100 - (p.y / max) * 100}`
  ).join(" ");
  const pathFuture = trajectory.slice(12).map((p, i) =>
    `${i === 0 ? "M" : "L"}${p.x * 100} ${100 - (p.y / max) * 100}`
  ).join(" ");

  return (
    <article className={`goal-card${expanded ? " expanded" : ""}`}>
      <header className="gc-head">
        <div className="gc-head-l">
          <span className="goal-tier" data-tier={goal.tier}>{goal.tier}</span>
        </div>
        <button className="icon-btn ghost" type="button" aria-label="更多" onClick={() => onExpand(goal.id)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </header>

      <h3 className="gc-label">{goal.label}</h3>
      <p className="gc-note muted">年化 {(goal.expectedAnnualReturn * 100).toFixed(1)}% · PMT 驅動</p>

      <div className="gc-fig">
        <span className="gc-current num">{fmtCompact(goal.currentAmount)}</span>
        <span className="gc-of muted num">/ {fmtCompact(goal.targetAmount)}</span>
        <span className="gc-pct num">{pct.toFixed(1)}%</span>
      </div>

      <div className="gc-track">
        <div
          className="gc-fill"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: `linear-gradient(90deg, color-mix(in oklab, ${meta.color} 50%, transparent), ${meta.color})`,
          }}
        ></div>
        <div className="gc-tick" style={{ left: `${Math.min(100, pct)}%`, background: meta.color }}></div>
      </div>

      <div className="gc-trajectory">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="traj-svg">
          <defs>
            <linearGradient id={`grad-${goal.id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={meta.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={meta.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" x2="100" y1={100 - (goal.targetAmount / max) * 100} y2={100 - (goal.targetAmount / max) * 100}
            stroke="currentColor" opacity="0.2" strokeWidth="0.4" strokeDasharray="1 1" />
          {trajectory[12] && (
            <line x1={trajectory[12].x * 100} x2={trajectory[12].x * 100} y1="0" y2="60"
              stroke="var(--border-strong)" strokeWidth="0.3" strokeDasharray="1 1" />
          )}
          {pathPast && (
            <path d={`${pathPast} L ${(trajectory[12]?.x ?? 0) * 100} 60 L 0 60 Z`} fill={`url(#grad-${goal.id})`} />
          )}
          {pathPast && <path d={pathPast} fill="none" stroke={meta.color} strokeWidth="1.4" />}
          {pathFuture && <path d={pathFuture} fill="none" stroke={meta.color} strokeWidth="1.2" strokeDasharray="1.5 1.5" opacity="0.7" />}
          {trajectory[12] && (
            <circle cx={trajectory[12].x * 100} cy={100 - (goal.currentAmount / max) * 100} r="1.6" fill={meta.color} />
          )}
        </svg>
      </div>

      <footer className="gc-foot">
        <div className="gc-foot-row">
          <span className="muted">每月需投入</span>
          <strong className="num pos">{fmt(monthly)}</strong>
        </div>
        <div className="gc-foot-row">
          <span className="muted">差額</span>
          <strong className="num">{fmt(remaining)}</strong>
        </div>
        <div className="gc-foot-row">
          <span className="muted">預計完成</span>
          <strong>{etaLabel(months)}</strong>
        </div>
      </footer>

      {expanded && (
        <div className="gc-expand">
          <label className="gc-slider-row">
            <span className="muted">月配置</span>
            <input
              type="range"
              min="500"
              max={Math.max(30000, monthly * 3)}
              step="500"
              value={monthly}
              onChange={(e) => onMonthlyChange(goal.id, parseInt(e.target.value, 10))}
            />
            <strong className="num">{fmt(monthly)}</strong>
          </label>
          <div className="gc-actions">
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => onEdit(goal)}>編輯目標</button>
            <button className="btn btn-ghost btn-sm" type="button">標記完成</button>
          </div>
        </div>
      )}
    </article>
  );
}

// ===== AddGoalModal ==========================================================
function AddGoalModal({
  surplus,
  existingMonthly,
  editGoal,
  onClose,
  onSave,
}: {
  surplus: number;
  existingMonthly: number;
  editGoal: GoalView | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [tier, setTier] = useState<"短期" | "中期" | "長期">(
    (editGoal?.tier as "短期" | "中期" | "長期") ?? "中期"
  );
  const [label, setLabel] = useState(editGoal?.label ?? "");
  const [target, setTarget] = useState(editGoal?.targetAmount ?? 150000);
  const [current, setCurrent] = useState(editGoal?.currentAmount ?? 0);
  const [mode, setMode] = useState<"monthly" | "eta">("monthly");
  const [monthly, setMonthly] = useState(editGoal?.requiredMonthly ?? 5000);
  const [etaMonths, setEtaMonths] = useState(editGoal?.monthsRemaining ?? 12);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const remaining = Math.max(0, target - current);
  const computedEta = monthly > 0 ? Math.ceil(remaining / monthly) : 999;
  const computedMonthly = etaMonths > 0 ? Math.ceil(remaining / etaMonths) : 0;
  const effectiveMonthly = mode === "monthly" ? monthly : computedMonthly;
  const effectiveEta = mode === "monthly" ? computedEta : etaMonths;
  const existingWithoutEdit = editGoal ? existingMonthly - editGoal.requiredMonthly : existingMonthly;
  const totalAfter = existingWithoutEdit + effectiveMonthly;
  const surplusUsedPct = surplus > 0 ? Math.round((totalAfter / surplus) * 100) : 0;
  const surplusOk = surplusUsedPct <= 100;

  const suggested = useMemo(
    () => Math.round(surplus * TIER_META[tier].weight * 0.4),
    [tier, surplus]
  );

  const tierMeta = TIER_META[tier];
  const placeholders: Record<string, string> = {
    短期: "緊急預備金 / 旅遊基金",
    中期: "京都旅遊 / 新筆電 / 補習費",
    長期: "退休投資 / 房屋頭期 / 大學基金",
  };
  const targetSuggest: Record<string, number[]> = {
    短期: [50000, 100000, 300000],
    中期: [80000, 150000, 500000],
    長期: [1000000, 3000000, 5000000],
  };

  async function handleSave() {
    if (!label.trim() || target <= 0) return;
    setError(null);
    const targetDate = addMonthsDate(NOW, effectiveEta).toISOString().slice(0, 10);
    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editGoal?.id,
        tier,
        label: label.trim(),
        targetAmount: target,
        currentAmount: current,
        expectedAnnualReturn: editGoal?.expectedAnnualReturn ?? 0.05,
        priority: editGoal?.priority ?? 0,
        targetDate,
      }),
    });
    if (!response.ok) {
      setError("目標儲存失敗，請檢查欄位。");
      return;
    }
    startTransition(() => {
      router.refresh();
      onSave();
    });
  }

  async function handleDelete() {
    if (!editGoal?.id) return;
    if (!window.confirm("確定要刪除這個目標？")) return;
    const response = await fetch(`/api/goals/${editGoal.id}`, { method: "DELETE" });
    if (!response.ok) { setError("刪除失敗，請稍後再試。"); return; }
    startTransition(() => { router.refresh(); onSave(); });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="crumb">理財目標</div>
            <h2 className="modal-title">{editGoal ? "編輯目標" : "新增理財目標"}</h2>
            <div className="modal-sub muted">系統依層級權重推算月配置與完成時間。</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="modal-body">
          {/* tier picker */}
          <div className="ff-group">
            <label className="ff-label">目標類型</label>
            <div className="tier-picker">
              {(["短期", "中期", "長期"] as const).map((t) => {
                const meta = TIER_META[t];
                return (
                  <button
                    key={t}
                    type="button"
                    className={`tier-card${tier === t ? " active" : ""}`}
                    style={tier === t ? {
                      borderColor: `color-mix(in oklab, ${meta.color} 45%, var(--border))`,
                      background: `color-mix(in oklab, ${meta.color} 6%, var(--bg-elev))`,
                    } : {}}
                    onClick={() => setTier(t)}
                  >
                    <div className="tier-card-head">
                      <span className="tier-card-name" style={{ color: meta.color }}>{t}</span>
                      {tier === t && (
                        <span className="tier-card-check" style={{ background: meta.color }}>
                          <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="tier-card-range muted">{meta.range}</div>
                    <div className="tier-card-weight">
                      <span>分配權重</span>
                      <strong className="num">{Math.round(meta.weight * 100)}%</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* label */}
          <div className="ff-group">
            <label className="ff-label">目標名稱</label>
            <input
              className="ff-input"
              value={label}
              placeholder={placeholders[tier]}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* amount + current */}
          <div className="ff-row-2">
            <div className="ff-group">
              <label className="ff-label">目標金額 (NT$)</label>
              <div className="ff-input-money">
                <span>$</span>
                <input
                  className="num"
                  value={target.toLocaleString("zh-TW")}
                  onChange={(e) => setTarget(parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10))}
                />
              </div>
              <div className="ff-chips">
                {(targetSuggest[tier] ?? []).map((v) => (
                  <button key={v} type="button" className="ff-chip" onClick={() => setTarget(v)}>
                    {fmtCompact(v)}
                  </button>
                ))}
              </div>
            </div>
            <div className="ff-group">
              <label className="ff-label">已累積 (NT$) <span className="muted ff-label-sub">選填</span></label>
              <div className="ff-input-money">
                <span>$</span>
                <input
                  className="num"
                  value={current.toLocaleString("zh-TW")}
                  onChange={(e) => setCurrent(parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10))}
                />
              </div>
              <div className="ff-chips">
                <button type="button" className="ff-chip" onClick={() => setCurrent(0)}>從零開始</button>
                <button type="button" className="ff-chip" onClick={() => setCurrent(Math.round(target * 0.25))}>已存 25%</button>
                <button type="button" className="ff-chip" onClick={() => setCurrent(Math.round(target * 0.5))}>已存 50%</button>
              </div>
            </div>
          </div>

          {/* mode toggle */}
          <div className="ff-group">
            <label className="ff-label">計算方式</label>
            <div className="mode-toggle">
              <button type="button" className={mode === "monthly" ? "active" : ""} onClick={() => setMode("monthly")}>
                <strong>設定月配置</strong>
                <span className="muted">每月固定投入</span>
              </button>
              <button type="button" className={mode === "eta" ? "active" : ""} onClick={() => setMode("eta")}>
                <strong>設定完成期限</strong>
                <span className="muted">推算所需月配置</span>
              </button>
            </div>
          </div>

          {/* slider */}
          {mode === "monthly" ? (
            <div className="ff-group">
              <div className="ff-slider-head">
                <label className="ff-label">每月配置</label>
                <button className="ff-suggest" type="button" onClick={() => setMonthly(suggested)}>
                  建議 {fmt(suggested)} ↓
                </button>
              </div>
              <div className="ff-slider">
                <button className="ff-step" type="button" onClick={() => setMonthly(Math.max(500, monthly - 500))}>−</button>
                <div className="ff-input-money ff-slider-input">
                  <span>$</span>
                  <input
                    className="num"
                    value={monthly.toLocaleString("zh-TW")}
                    onChange={(e) => setMonthly(parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10))}
                  />
                  <span className="ff-unit">/ 月</span>
                </div>
                <button className="ff-step" type="button" onClick={() => setMonthly(monthly + 500)}>+</button>
              </div>
              <input type="range" className="ff-range" min="500" max="50000" step="500"
                value={monthly} onChange={(e) => setMonthly(parseInt(e.target.value, 10))} />
              <div className="ff-range-lbl muted"><span>$500</span><span>$50K / 月</span></div>
            </div>
          ) : (
            <div className="ff-group">
              <div className="ff-slider-head">
                <label className="ff-label">完成期限</label>
                <span className="muted ff-label-sub">需投入 {fmt(computedMonthly)} / 月</span>
              </div>
              <div className="ff-slider">
                <button className="ff-step" type="button" onClick={() => setEtaMonths(Math.max(1, etaMonths - 1))}>−</button>
                <div className="ff-input-money ff-slider-input">
                  <input
                    className="num"
                    value={etaMonths}
                    onChange={(e) => setEtaMonths(parseInt(e.target.value || "0", 10))}
                  />
                  <span className="ff-unit">個月</span>
                </div>
                <button className="ff-step" type="button" onClick={() => setEtaMonths(etaMonths + 1)}>+</button>
              </div>
              <input type="range" className="ff-range" min="1" max="120" step="1"
                value={etaMonths} onChange={(e) => setEtaMonths(parseInt(e.target.value, 10))} />
              <div className="ff-range-lbl muted"><span>1 個月</span><span>10 年</span></div>
            </div>
          )}

          {/* preview card */}
          <div className="preview-card" style={{ borderColor: `color-mix(in oklab, ${tierMeta.color} 30%, var(--border))` }}>
            <div className="preview-row">
              <div className="preview-col">
                <div className="preview-lbl">預計完成</div>
                <div className="preview-val">{etaLabel(effectiveEta)}</div>
              </div>
              <div className="preview-col">
                <div className="preview-lbl">月配置</div>
                <div className="preview-val num">{fmt(effectiveMonthly)}</div>
              </div>
              <div className="preview-col">
                <div className="preview-lbl">占月結餘</div>
                <div className={`preview-val num${surplusOk ? "" : " neg"}`}>{surplusUsedPct}%</div>
              </div>
            </div>
            <div className="preview-track">
              <div className="preview-fill"
                style={{ width: `${Math.min(100, surplusUsedPct)}%`, background: surplusOk ? tierMeta.color : "var(--neg)" }} />
            </div>
            <div className="preview-note">
              {surplusOk ? (
                <span className="muted">含本目標後合計占用月結餘 {surplusUsedPct}% · 仍在合理範圍</span>
              ) : (
                <span className="neg">⚠ 合計月配置超過本月結餘，建議降低投入或調整其他目標</span>
              )}
            </div>
          </div>

          {error && <p style={{ color: "var(--neg)", fontSize: 13, margin: 0 }}>{error}</p>}
        </div>

        <footer className="modal-foot">
          {editGoal && (
            <button className="btn btn-ghost" type="button" style={{ color: "var(--neg)" }} onClick={handleDelete} disabled={isPending}>
              刪除
            </button>
          )}
          <div className="modal-foot-right">
            <button className="btn btn-ghost" type="button" onClick={onClose}>取消</button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!label.trim() || target <= 0 || isPending}
              onClick={handleSave}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
              {editGoal ? "儲存變更" : "建立目標"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ===== ScenarioModal =========================================================
function ScenarioModal({
  goals,
  surplus,
  income,
  expense,
  onClose,
}: {
  goals: GoalView[];
  surplus: number;
  income: number;
  expense: number;
  onClose: () => void;
}) {
  const [incomeDelta, setIncomeDelta] = useState(0);
  const [expenseDelta, setExpenseDelta] = useState(0);
  const [allocBoost, setAllocBoost] = useState<"none" | "short" | "mid" | "long">("none");
  const [preset, setPreset] = useState<string | null>(null);

  const PRESETS = [
    { id: "raise", label: "加薪 +15%", income: 15, expense: 0, tip: "若年度績效調薪 15%" },
    { id: "thrift", label: "節儉一年", income: 0, expense: -10, tip: "全家配合節省外食 / 訂閱" },
    { id: "secondkid", label: "新生兒 +20%", income: 0, expense: 20, tip: "育嬰、奶粉與保險" },
    { id: "boomReturn", label: "投報率提升", income: 5, expense: 0, tip: "高利定存 + 股息再投入" },
    { id: "layoff", label: "失業半年", income: -50, expense: -5, tip: "緩衝期啟用緊急預備金" },
  ];

  const baseIncome = income > 0 ? income : (surplus > 0 ? surplus / 0.27 : 100000);
  const baseExpense = expense > 0 ? expense : baseIncome - surplus;
  const newIncome = baseIncome * (1 + incomeDelta / 100);
  const newExpense = baseExpense * (1 + expenseDelta / 100);
  const newSurplus = Math.max(0, newIncome - newExpense);
  const surplusDelta = newSurplus - surplus;
  const surplusPctDelta = surplus > 0 ? ((newSurplus - surplus) / surplus) * 100 : 0;

  const ratio = surplus > 0 ? newSurplus / surplus : 1;
  const scenarioGoals = useMemo(() => {
    return goals.map((g) => {
      let boost = 1;
      if (allocBoost === "short" && g.tier === "短期") boost = 1.4;
      if (allocBoost === "mid" && g.tier === "中期") boost = 1.4;
      if (allocBoost === "long" && g.tier === "長期") boost = 1.4;
      const newMonthly = Math.max(0, Math.round(g.requiredMonthly * ratio * boost));
      const remaining = g.targetAmount - g.currentAmount;
      const newEta = newMonthly > 0 ? Math.ceil(remaining / newMonthly) : 999;
      return { ...g, simMonthly: newMonthly, simEta: newEta, etaDelta: newEta - g.monthsRemaining };
    });
  }, [goals, ratio, allocBoost]);

  const projectionPoints = useMemo(() => {
    const months = 60;
    const out: Array<{ i: number; cur: number; sim: number }> = [];
    const totalCurrent = goals.reduce((a, g) => a + g.currentAmount, 0);
    let cur = totalCurrent;
    let sim = totalCurrent;
    for (let i = 0; i <= months; i++) {
      out.push({ i, cur, sim });
      cur += surplus * 0.85;
      sim += newSurplus * 0.85;
    }
    return out;
  }, [goals, surplus, newSurplus]);

  const projMax = Math.max(...projectionPoints.map((p) => Math.max(p.cur, p.sim)), 1);
  const linePath = (key: "cur" | "sim") =>
    projectionPoints.map((p, i) =>
      `${i === 0 ? "M" : "L"}${(p.i / 60) * 100} ${100 - (p[key] / projMax) * 100}`
    ).join(" ");

  const applyPreset = (p: typeof PRESETS[0]) => {
    setPreset(p.id);
    setIncomeDelta(p.income);
    setExpenseDelta(p.expense);
  };

  const reset = () => { setIncomeDelta(0); setExpenseDelta(0); setAllocBoost("none"); setPreset(null); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="crumb">情境模擬 · What-if Sandbox</div>
            <h2 className="modal-title">情境模擬</h2>
            <div className="modal-sub muted">調整收入、支出或配置，預覽對所有目標完成時間的影響。</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="sim-presets">
          {PRESETS.map((p) => (
            <button key={p.id} className={`sim-preset${preset === p.id ? " active" : ""}`} onClick={() => applyPreset(p)}>
              <strong>{p.label}</strong>
              <span className="muted">{p.tip}</span>
            </button>
          ))}
          <button className="sim-preset sim-preset-custom" onClick={reset}>
            <strong>自訂 / 重設</strong>
            <span className="muted">手動調整下方參數</span>
          </button>
        </div>

        <div className="sim-grid">
          <div className="sim-controls">
            <div className="sim-section">
              <div className="sim-section-head">
                <span className="ff-label">收入變化</span>
                <strong className={`num${incomeDelta > 0 ? " pos" : incomeDelta < 0 ? " neg" : ""}`}>
                  {incomeDelta > 0 ? "+" : ""}{incomeDelta}%
                </strong>
              </div>
              <input type="range" className="ff-range sim-range" min="-50" max="50" step="1"
                value={incomeDelta}
                onChange={(e) => { setIncomeDelta(parseInt(e.target.value, 10)); setPreset(null); }} />
              <div className="ff-range-lbl muted"><span>−50%</span><span>0</span><span>+50%</span></div>
            </div>

            <div className="sim-section">
              <div className="sim-section-head">
                <span className="ff-label">支出變化</span>
                <strong className={`num${expenseDelta < 0 ? " pos" : expenseDelta > 0 ? " neg" : ""}`}>
                  {expenseDelta > 0 ? "+" : ""}{expenseDelta}%
                </strong>
              </div>
              <input type="range" className="ff-range sim-range" min="-50" max="50" step="1"
                value={expenseDelta}
                onChange={(e) => { setExpenseDelta(parseInt(e.target.value, 10)); setPreset(null); }} />
              <div className="ff-range-lbl muted"><span>−50%</span><span>0</span><span>+50%</span></div>
            </div>

            <div className="sim-section">
              <span className="ff-label">優先層級加碼 <span className="muted ff-label-sub">將該層級月配置提升 40%</span></span>
              <div className="boost-grid">
                {([
                  { id: "none", label: "持平", color: "var(--muted)" },
                  { id: "short", label: "短期 +", color: "var(--pos)" },
                  { id: "mid", label: "中期 +", color: "var(--warn)" },
                  { id: "long", label: "長期 +", color: "var(--info)" },
                ] as const).map((b) => (
                  <button
                    key={b.id}
                    className={`boost-btn${allocBoost === b.id ? " active" : ""}`}
                    style={allocBoost === b.id ? { borderColor: b.color, color: b.color, background: `color-mix(in oklab, ${b.color} 10%, var(--bg-elev))` } : {}}
                    onClick={() => setAllocBoost(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sim-stat-row">
              <div className="sim-stat-lbl muted">本月結餘</div>
              <div className="sim-stat-val">
                <span className="muted">{fmtCompact(surplus)}</span>
                <span className="arrow">→</span>
                <span className={surplusDelta >= 0 ? "pos" : "neg"}>{fmtCompact(newSurplus)}</span>
              </div>
              <div className={`sim-stat-delta${surplusDelta >= 0 ? " pos" : " neg"}`}>
                {surplusDelta >= 0 ? "+" : ""}{fmt(surplusDelta)} · {surplusPctDelta >= 0 ? "+" : ""}{surplusPctDelta.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="sim-outcome">
            <div className="sim-section">
              <div className="sim-section-head">
                <span className="ff-label">5 年家庭淨資產推估</span>
                <span className="muted ff-label-sub">假設結餘 85% 進入儲蓄</span>
              </div>
              <div className="sim-chart-wrap">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="sim-chart">
                  <defs>
                    <linearGradient id="simGradSim" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map((t) => (
                    <line key={t} x1="0" x2="100" y1={t * 100} y2={t * 100} stroke="var(--border)" strokeWidth="0.3" strokeDasharray="0.6 0.8" />
                  ))}
                  <path d={`${linePath("sim")} L 100 100 L 0 100 Z`} fill="url(#simGradSim)" />
                  <path d={linePath("cur")} fill="none" stroke="var(--muted)" strokeWidth="0.9" strokeDasharray="1 1" />
                  <path d={linePath("sim")} fill="none" stroke="var(--accent)" strokeWidth="1.4" />
                </svg>
                <div className="sim-chart-axis">
                  {[0, 1, 2, 3, 4, 5].map((y) => <span key={y}>+{y}年</span>)}
                </div>
              </div>
              <div className="sim-chart-legend">
                <span><span className="dash dash-cur"></span>目前路徑 · 5 年後 {fmtCompact(projectionPoints.at(-1)!.cur)}</span>
                <span><span className="dash dash-sim"></span>模擬路徑 · 5 年後 {fmtCompact(projectionPoints.at(-1)!.sim)}</span>
              </div>
            </div>

            <div className="sim-section sim-section-tight">
              <div className="sim-section-head">
                <span className="ff-label">目標完成時間影響</span>
                <span className="muted ff-label-sub">{scenarioGoals.length} 個目標</span>
              </div>
              <div className="sim-goals">
                {scenarioGoals.map((g) => {
                  const meta = TIER_META[g.tier];
                  const better = g.etaDelta < 0;
                  const worse = g.etaDelta > 0;
                  return (
                    <div key={g.id} className="sim-goal-row">
                      <span className="sim-tier" style={{ background: meta.color }}></span>
                      <span className="sim-goal-name">{g.label}</span>
                      <span className="sim-goal-monthly num muted">
                        {fmt(g.requiredMonthly)} <span className="arrow">→</span> {fmt(g.simMonthly)}
                      </span>
                      <span className="sim-goal-eta num">
                        {g.monthsRemaining}mo <span className="arrow">→</span> {g.simEta}mo
                      </span>
                      <span className={`sim-goal-delta num${better ? " pos" : worse ? " neg" : " muted"}`}>
                        {g.etaDelta === 0 ? "—" : (g.etaDelta > 0 ? `+${g.etaDelta}` : g.etaDelta) + " mo"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <footer className="modal-foot">
          <button className="btn btn-ghost" onClick={reset}>重設為現況</button>
          <div className="modal-foot-right">
            <button className="btn btn-ghost" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
              套用情境
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ===== GoalsView (main export) ===============================================
export function GoalsView({
  goals: initialGoals,
  surplus,
  income,
  expense,
}: {
  goals: GoalView[];
  surplus: number;
  income: number;
  expense: number;
}) {
  const [allocation, setAllocation] = useState<Allocation>({ 短期: 50, 中期: 30, 長期: 20 });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [localMonthly, setLocalMonthly] = useState<Record<number, number>>({});
  const [dialog, setDialog] = useState<"new" | "scenario" | null>(null);
  const [editGoal, setEditGoal] = useState<GoalView | null>(null);

  const goals = useMemo(
    () => initialGoals.map((g) => ({
      ...g,
      requiredMonthly: localMonthly[g.id] ?? g.requiredMonthly,
      monthsRemaining: localMonthly[g.id]
        ? Math.max(1, Math.ceil((g.targetAmount - g.currentAmount) / localMonthly[g.id]))
        : g.monthsRemaining,
    })),
    [initialGoals, localMonthly],
  );

  const grouped = useMemo(
    () => ({
      短期: goals.filter((g) => g.tier === "短期"),
      中期: goals.filter((g) => g.tier === "中期"),
      長期: goals.filter((g) => g.tier === "長期"),
    }),
    [goals],
  );

  const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalMonthly = goals.reduce((s, g) => s + g.requiredMonthly, 0);
  const existingMonthly = goals.reduce((s, g) => s + g.requiredMonthly, 0);

  function openAdd() { setEditGoal(null); setDialog("new"); }
  function openEdit(goal: GoalView) { setEditGoal(goal); setDialog("new"); }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">理財目標 · Goals</div>
          <h1 className="page-title">理財目標</h1>
          <div className="topbar-sub muted">依結餘自動分配至短中長期，動態推算完成時間。</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" type="button" onClick={() => setDialog("scenario")}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
            </svg>
            情境模擬
          </button>
          <button className="btn btn-primary" type="button" onClick={openAdd}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新增目標
          </button>
        </div>
      </header>

      <div className="kpi-strip kpi-4">
        <div className="kpi-tile">
          <div className="kpi-label">啟用中目標</div>
          <div className="kpi-val">{goals.length}</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">已累積</div>
          <div className="kpi-val">{fmtCompact(totalCurrent)}</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">目標總額</div>
          <div className="kpi-val muted-val">{fmtCompact(totalTarget)}</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">月投入合計</div>
          <div className="kpi-val pos">{fmtCompact(totalMonthly)}</div>
        </div>
      </div>

      <Allocator surplus={surplus} allocation={allocation} onChange={setAllocation} />

      {goals.length > 0 && <ProjectionTimeline goals={goals} />}

      <section className="goals-list-section">
        {(["短期", "中期", "長期"] as const).map((tier) => (
          <div key={tier} className="tier-block">
            <header className="tier-head">
              <div className="tier-head-l">
                <span
                  className="tier-badge"
                  style={{
                    background: `color-mix(in oklab, ${TIER_META[tier].color} 14%, var(--bg-elev))`,
                    color: TIER_META[tier].color,
                    borderColor: `color-mix(in oklab, ${TIER_META[tier].color} 30%, var(--border))`,
                  }}
                >
                  {tier}
                </span>
                <div>
                  <div className="tier-title">{tier}目標 <span className="muted">· {TIER_META[tier].range}</span></div>
                  <div className="tier-sub muted">
                    {grouped[tier].length} 個目標 ·
                    已累積 {fmtCompact(grouped[tier].reduce((s, g) => s + g.currentAmount, 0))} / 目標 {fmtCompact(grouped[tier].reduce((s, g) => s + g.targetAmount, 0))} ·
                    月投入 {fmt(grouped[tier].reduce((s, g) => s + g.requiredMonthly, 0))}
                  </div>
                </div>
              </div>
              <button className="link-btn" type="button" onClick={openAdd}>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                新增 {tier}目標
              </button>
            </header>

            <div className="tier-grid">
              {grouped[tier].map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  expanded={expandedId === goal.id}
                  onExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                  onMonthlyChange={(id, val) => setLocalMonthly((prev) => ({ ...prev, [id]: val }))}
                  onEdit={openEdit}
                />
              ))}
              {grouped[tier].length === 0 && (
                <button className="month-tile empty" type="button" onClick={openAdd} style={{ minHeight: 80 }}>
                  <span className="mt-empty">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    新增 {tier}目標
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      <footer className="page-foot muted">理財目標 · 依每月結餘動態配置儲蓄計畫</footer>

      {dialog === "new" && (
        <AddGoalModal
          surplus={surplus}
          existingMonthly={existingMonthly}
          editGoal={editGoal}
          onClose={() => { setDialog(null); setEditGoal(null); }}
          onSave={() => { setDialog(null); setEditGoal(null); }}
        />
      )}
      {dialog === "scenario" && (
        <ScenarioModal
          goals={goals}
          surplus={surplus}
          income={income}
          expense={expense}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
