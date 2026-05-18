# Monthly Ledger (每月收支) — design notes

## Frame
Year-at-a-glance calendar grid (4×3 tiles, one per month) above an
inline editor for the selected month. Replaces the two-template flow
in the existing app (months_list.html → month_form.html) with a
single keep-the-context layout: clicking a tile updates the editor
below; no page navigation between view and edit.

## Top KPI strip
Year-scoped totals: 收入 / 支出 / 結餘 / 平均儲蓄率 / 已記錄月份.
Driven by the same MONTHS array as Home; recomputed on year change.

## Year picker
Pills (2024 / 2025 / 2026) — only years with data are enabled.
The "目前" indicator marks the current month (May 2026 in this mock).

## Month tiles
Each tile shows:
- 月 label + 中文月份 sub-label
- Big surplus figure (color: pos/neg based on sign)
- Mini income/expense compact figures
- A 2-bar mini chart (income up / expense down from baseline)
- "目前" pill on the current month
- Selected tile gets an accent border + raised background
- Tiles without data render as dashed empty cells with "+ 新增" CTA

## Detail panel
Two-column layout under the grid:
- Header bar: title, surplus pill, savings rate, daily-avg, action buttons
- LEFT column: 收入 categories — header w/ total, list of editable rows, add button
- RIGHT column: 支出 categories — same shape; auto-shows 未分類 row when
  the sum of category lines < total expense (matches MonthlySummary._breakdown logic in models.py)
- Bottom: 備註 textarea
- Sticky-ish action footer: Save / Duplicate-to-next-month / Delete (with confirm)

## Interactions
- Click tile → loads that month into editor
- Edit a category row inline (name + amount); add removes a placeholder
- Income/expense totals are derived from category sums but can be overridden
  (matches how MonthlySummary.total_income/expense are independent from
  the lines in your model)
- 未分類 amount auto-recalculates when the sum diverges from the total
