# Financial formulas

All financial logic lives in **`src/lib/finance/`** and nowhere else. Pages,
Server Actions, exports, the AI context and the import preview all call this
module; none re-implement a formula. Every formula below is covered by unit
tests (`src/lib/finance/*.test.ts`).

## Units and precision

- Coin amounts entered by users (prices, costs, balances) are **whole coins**.
- Tax rates have at most four decimal places (stored as `numeric(5,4)`, e.g. `0.0500`).
- Internally amounts are held in fixed-point **units of 1/10,000 coin** and tax
  rates in **basis points**, so every intermediate value — gross, tax, net,
  profit — is an exact integer. Nothing is rounded until it is displayed, and
  the sign of a profit (win / loss / break-even) is decided exactly.
  Example: 3 × 1,234,567 at 5% tax = 185,185.05 exactly (naive floating point
  gives 185,185.05000000002).
- **Display rounding** is half-away-from-zero to whole coins (`roundCoins`, and
  `Intl.NumberFormat`'s default). A value that rounds to 0 is shown as `0`, never `−0`.
- The EA in-game client may round the tax on an individual sale slightly
  differently; the app computes the exact 5%, so a single sale can differ from
  the game by at most 1 coin.

## The EA transaction tax (default 5%, configurable in Settings)

| Quantity | Formula |
|---|---|
| Tax | `Sale Price × Quantity × Tax Rate` |
| Net proceeds | `Sale Price × Quantity − Tax` = `Sale Price × Quantity × (1 − Tax Rate)` |
| Acquisition cost | `Purchase Price × Quantity` |
| Net profit | `Net Proceeds − Acquisition Cost` |
| ROI | `Net Profit ÷ Acquisition Cost × 100` — **null** (shown as —) when the cost is 0, e.g. pack pulls |
| Break-even sale price | smallest whole price `P` with `P × (1 − Tax Rate) ≥ Purchase Price` = `⌈Purchase Price ÷ (1 − Tax Rate)⌉` |

Worked example (tested): buy at 10,000, sell at 12,000, 5% tax →
tax 600, net 11,400, profit 1,400, ROI 14%. Break-even for a 10,000 card is 10,527.

Each sale stores the tax rate in force when it was recorded, so changing the
setting never rewrites history. Unrealized estimates use the current rate.

## Purchases ("lots"), sales and holdings

- Every purchase is a **lot**: player, quantity, unit cost, time. Sales are
  recorded against a lot; a lot can be sold in several parts.
- Lot status: **open** (nothing sold), **partly sold**, **closed** (all sold).
- Selling from a holding that spans several lots allocates **FIFO** — oldest
  purchase first; ties on purchase time are broken by when the purchase was
  recorded. Selling from the trade journal uses that specific lot.
- The database refuses (with a row lock, so also under concurrency) any sale
  that would oversell a lot or predate its purchase.

Per player (holding):

| Quantity | Formula |
|---|---|
| Quantity held | `Σ remaining copies of open lots` |
| Total cost | `Σ (lot unit cost × remaining copies)` |
| Average cost | `Total Cost ÷ Quantity held` (may be fractional) |
| Market value | `Latest Observed Price × Quantity` (gross) |
| Liquidation value | `Market Value × (1 − Tax Rate)` |
| Unrealized P&L | `Liquidation Value − Total Cost` |
| Unrealized ROI | `Unrealized P&L ÷ Total Cost × 100` |
| Break-even price | `⌈Total Cost ÷ (Quantity × (1 − Tax Rate))⌉` |

Holdings with no recorded price have no market value or unrealized P&L; they
are flagged and carried **at cost** in portfolio value.

Realized P&L per sale uses the cost of the lot it came from:
`Sale Net Proceeds − Lot Unit Cost × Quantity Sold`.

## Portfolio (the coin ledger) — no double counting

| Metric | Formula |
|---|---|
| Available coins | `Starting Balance + Σ Adjustments − Σ every purchase cost + Σ every sale's net proceeds` |
| Invested | `Σ cost of copies still held` |
| Realized P&L | `Σ (net proceeds − cost of copies sold)` over all sales |
| Unrealized P&L | `Σ` holding unrealized P&L (priced holdings only) |
| Total P&L | `Realized + Unrealized` |
| Holdings estimated value | `Σ liquidation value (priced) + Σ cost (unpriced)` |
| Portfolio value | `Available Coins + Holdings Estimated Value` |
| Realized ROI | `Realized P&L ÷ cost of copies sold × 100` |
| Unrealized ROI | `Unrealized P&L ÷ cost of priced holdings × 100` |
| Total ROI | `Total P&L ÷ (cost of copies sold + cost of priced holdings) × 100` |
| Capital utilization | `Invested ÷ (Available + Invested) × 100` (null when there is no capital) |

A purchase moves coins from *available* to *invested*; a sale moves its net
proceeds back to *available* and removes the sold copies' cost from
*invested*. Realized profit is therefore already inside available coins and is
never added to portfolio value a second time. The tests assert the invariant
`Portfolio Value = Starting Balance + Adjustments + Total P&L` (with all
holdings priced).

*Adjustments* record coins earned or spent outside trading (rewards, packs).
**Sync with game** records the difference between the tracked available
balance and the balance the user reads in game as one adjustment. If purchases
exceed the coins on record, the dashboard warns that the balance is negative.

## Analytics

A **realized trade** is one sale matched to the lot it came from.

| Metric | Definition |
|---|---|
| Win rate | `sales with net profit > 0 ÷ all sales × 100`; break-even sales are not wins |
| Average profit per sale | `Σ net profit ÷ number of sales` |
| Average holding time | quantity-weighted: `Σ (hours held × copies) ÷ Σ copies` |
| Daily / weekly / monthly P&L | realized profit bucketed by **sale time in the user's time zone**; weeks start Monday; empty periods are zero |
| Cumulative realized P&L | running total by day; profit realized before the chart range is carried in |
| Best / worst players | realized profit per player in the period |
| Portfolio value over time | end-of-day reconstruction: available coins from the ledger up to that day, plus each open lot valued at the last price observed on or before that day (after tax), or at cost if not yet priced |

## Prices and alerts

- **Latest price**: the most recent observation (ties: most recently recorded).
- **Period change (24h / 7d / 30d)**: latest observation vs the latest
  observation at least that long *before the latest observation* (not before
  "now"), so sporadic recording still yields meaningful figures; the age of the
  latest observation is always shown separately. No baseline → not shown.
- **Trend**: least-squares slope of recorded prices over 30 days, as % of the
  mean per day, with R²; needs ≥ 3 observations spanning ≥ 1 day; |slope| < 0.5%/day is "flat".
- **Volatility**: population standard deviation ÷ mean × 100.
- **Alerts**: *price at or below* target, *price at or above* target, or a
  *percentage move* (any / up / down) versus the previous observation or a
  24h / 7d / 30d lookback. Alerts are **edge-triggered**: one notification when
  the condition becomes true, re-armed once it becomes false again.
