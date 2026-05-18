"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

type MonthLine = {
  id: number;
  kind: "income" | "expense";
  name: string;
  amount: number;
};

type MonthFormValue = {
  id?: number;
  year: number;
  month: number;
  income: number;
  expense: number;
  note: string;
  lines: MonthLine[];
};

const monthChinese = (m: number) =>
  ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][m - 1] + "月";

const monthLabel = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function parseNumber(raw: string) {
  const digits = raw.replace(/[^0-9.-]/g, "");
  if (!digits) return 0;
  const value = Number(digits);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function EditableBreakdownPanel({
  kind,
  total,
  lines,
  onTotalChange,
  onLineChange,
  onLineDelete,
  onLineAdd,
}: {
  kind: "income" | "expense";
  total: number;
  lines: MonthLine[];
  onTotalChange: (value: number) => void;
  onLineChange: (next: MonthLine) => void;
  onLineDelete: (id: number) => void;
  onLineAdd: () => void;
}) {
  const nameRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const prevLengthRef = useRef(lines.length);

  useEffect(() => {
    if (lines.length > prevLengthRef.current) {
      const lastLine = lines[lines.length - 1];
      if (lastLine) nameRefs.current.get(lastLine.id)?.focus();
    }
    prevLengthRef.current = lines.length;
  }, [lines]);

  const sum = lines.reduce((acc, line) => acc + line.amount, 0);
  const uncategorized = Math.max(0, total - sum);
  const over = sum > total;
  const tint = kind === "income" ? "var(--accent)" : "var(--neg)";

  return (
    <section className="bd-panel">
      <header className="bd-head">
        <div className="bd-head-l">
          <span className="bar" style={{ background: tint }}></span>
          <div>
            <div className="bd-title">{kind === "income" ? "收入" : "支出"}</div>
            <div className="bd-sub muted">{lines.length} 項分類{uncategorized > 0 ? " · 含未分類" : ""}</div>
          </div>
        </div>

        <label className="bd-total">
          <span>總額</span>
          <div className="bd-total-input">
            <span>$</span>
            <input
              value={Math.round(total).toLocaleString("en-US")}
              onChange={(event) => onTotalChange(parseNumber(event.target.value))}
              inputMode="numeric"
            />
          </div>
        </label>
      </header>

      {over ? (
        <div className="bd-warn">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 8v5M12 17h.01M3 19h18L12 4z" />
          </svg>
          分類加總 {fmt(sum)} 超過{kind === "income" ? "收入" : "支出"}總額 {fmt(total)}
        </div>
      ) : null}

      <div className="bd-list">
        {lines.map((line) => (
          <div key={line.id} className="cat-edit-row">
            <div className="cat-edit-name">
              <span className="cat-dot" style={{ background: tint }}></span>
              <input
                className="cat-input"
                value={line.name}
                placeholder="分類名稱"
                ref={(el) => {
                  if (el) nameRefs.current.set(line.id, el);
                  else nameRefs.current.delete(line.id);
                }}
                onChange={(event) => onLineChange({ ...line, name: event.target.value })}
              />
            </div>
            <div className="cat-edit-amt">
              <span className="cat-edit-cur">$</span>
              <input
                className="cat-input num right"
                value={Math.round(line.amount).toLocaleString("en-US")}
                inputMode="numeric"
                onChange={(event) => onLineChange({ ...line, amount: parseNumber(event.target.value) })}
                onKeyDown={(event) => {
                  if (event.key === "Tab" && !event.shiftKey && line === lines[lines.length - 1]) {
                    event.preventDefault();
                    onLineAdd();
                  }
                }}
              />
            </div>
            <div className="cat-edit-act">
              <button className="icon-btn ghost" type="button" aria-label="刪除分類" onClick={() => onLineDelete(line.id)}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M6 7h12M9 7V5h6v2M8 7l1 13h6l1-13M11 11v6M13 11v6" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {uncategorized > 0 ? (
          <div className="cat-edit-row uncat">
            <div className="cat-edit-name">
              <span className="cat-dot" style={{ background: "color-mix(in oklab, var(--warn) 60%, transparent)" }}></span>
              <span>未分類</span>
              <span className="cat-flag">總額 − 已分類</span>
            </div>
            <div className="cat-edit-amt num muted">{fmt(uncategorized)}</div>
            <div className="cat-edit-act"></div>
          </div>
        ) : null}
      </div>

      <button className="bd-add" type="button" onClick={onLineAdd}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        新增分類
      </button>

      <div className="bd-foot">
        <span className="muted">小計</span>
        <strong className="num">{fmt(sum)}</strong>
        <span className="muted">未分類</span>
        <strong className="num">{fmt(uncategorized)}</strong>
        <span className="muted">總額</span>
        <strong className="num">{fmt(total)}</strong>
      </div>
    </section>
  );
}

export function MonthForm({
  mode,
  initialValue,
}: {
  mode: "create" | "edit";
  initialValue: MonthFormValue;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MonthFormValue>(initialValue);

  const surplus = form.income - form.expense;
  const rate = form.income ? (surplus / form.income) * 100 : 0;
  const incomeLines = form.lines.filter((line) => line.kind === "income");
  const expenseLines = form.lines.filter((line) => line.kind === "expense");

  const canDelete = mode === "edit";
  const title = mode === "edit" ? `編輯 ${form.year} 年 ${monthChinese(form.month)}` : `新增 ${form.year} 年 ${monthChinese(form.month)}`;
  const subtitle = mode === "edit" ? monthLabel(form.year, form.month) : "建立新月份";

  function patchLine(kind: "income" | "expense", next: MonthLine) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => (line.id === next.id && line.kind === kind ? next : line)),
    }));
  }

  function addLine(kind: "income" | "expense") {
    setForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          id: Math.max(0, ...prev.lines.map((line) => line.id)) + 1,
          kind,
          name: "",
          amount: 0,
        },
      ],
    }));
  }

  function deleteLine(id: number) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((line) => line.id !== id),
    }));
  }

  const payload = useMemo(
    () => ({
      year: form.year,
      month: form.month,
      totalIncome: form.income,
      totalExpense: form.expense,
      note: form.note.trim(),
      lines: form.lines
        .map((line) => ({
          kind: line.kind,
          name: line.name.trim(),
          amount: line.amount,
        }))
        .filter((line) => line.name.length > 0),
    }),
    [form],
  );

  async function save() {
    setError(null);
    const response = await fetch("/api/months", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setError("儲存失敗，請檢查欄位後再試。");
      return;
    }

    startTransition(() => {
      router.push("/months");
      router.refresh();
    });
  }

  async function remove() {
    if (!canDelete) return;
    if (!window.confirm(`確定要刪除 ${monthLabel(form.year, form.month)}？`)) return;

    setError(null);
    const response = await fetch(`/api/months/${form.year}/${form.month}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError("刪除失敗，請稍後再試。");
      return;
    }

    startTransition(() => {
      router.push("/months");
      router.refresh();
    });
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">每月收支 · {mode === "edit" ? "Edit Month" : "New Month"}</div>
          <h1 className="page-title">{title}</h1>
          <div className="topbar-sub muted">{subtitle}</div>
        </div>
        <div className="topbar-actions">
          <Link className="btn btn-ghost" href="/months">返回月份列表</Link>
        </div>
      </header>

      <section className="editor-card">
        <header className="editor-head">
          <div>
            <div className="crumb">月份資料</div>
            <h2 className="editor-title">
              {form.year} 年 {monthChinese(form.month)}
              <span className="editor-title-sub"> · {monthLabel(form.year, form.month)}</span>
            </h2>
          </div>

          <div className="editor-stats">
            <div className={`editor-stat ${surplus >= 0 ? "pos" : "neg"}`}>
              <div className="editor-stat-label">結餘</div>
              <div className="editor-stat-val num">{fmt(surplus)}</div>
            </div>
            <div className="editor-stat">
              <div className="editor-stat-label">儲蓄率</div>
              <div className="editor-stat-val num">{rate.toFixed(1)}%</div>
            </div>
            <div className="editor-stat">
              <div className="editor-stat-label">日均支出</div>
              <div className="editor-stat-val num">{fmt(form.expense / 30)}</div>
            </div>
          </div>

          <div className="editor-actions">
            {canDelete ? (
              <button className="btn btn-danger" type="button" onClick={remove} disabled={isPending}>刪除</button>
            ) : null}
            <button className="btn btn-primary" type="button" onClick={save} disabled={isPending}>
              {isPending ? "處理中…" : "儲存"}
            </button>
          </div>
        </header>

        <div className="editor-note" style={{ marginTop: 0, marginBottom: 16 }}>
          <div className="editor-grid">
            <label>
              <span className="note-label">年份</span>
              <input
                value={form.year}
                type="number"
                min={2000}
                max={2100}
                onChange={(event) => setForm((prev) => ({ ...prev, year: parseNumber(event.target.value) || prev.year }))}
                readOnly={mode === "edit"}
              />
            </label>
            <label>
              <span className="note-label">月份</span>
              <select
                value={form.month}
                onChange={(event) => setForm((prev) => ({ ...prev, month: Number(event.target.value) }))}
                disabled={mode === "edit"}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>{String(month).padStart(2, "0")}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error ? <div className="bd-warn" style={{ marginBottom: 16 }}>{error}</div> : null}

        <div className="editor-grid">
          <EditableBreakdownPanel
            kind="income"
            total={form.income}
            lines={incomeLines}
            onTotalChange={(income) => setForm((prev) => ({ ...prev, income }))}
            onLineChange={(next) => patchLine("income", next)}
            onLineDelete={deleteLine}
            onLineAdd={() => addLine("income")}
          />
          <EditableBreakdownPanel
            kind="expense"
            total={form.expense}
            lines={expenseLines}
            onTotalChange={(expense) => setForm((prev) => ({ ...prev, expense }))}
            onLineChange={(next) => patchLine("expense", next)}
            onLineDelete={deleteLine}
            onLineAdd={() => addLine("expense")}
          />
        </div>

        <div className="editor-note">
          <label>
            <span className="note-label">備註</span>
            <textarea
              className="note-input"
              rows={3}
              placeholder="例如：旅遊支出較高、獎金入帳"
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            />
          </label>
        </div>
      </section>
    </>
  );
}
