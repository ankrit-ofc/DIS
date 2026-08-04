-- ============================================================================
-- Reconciliation: cancelled orders whose effects were never reversed
-- ============================================================================
--
-- READ-ONLY. Every statement here is a SELECT. Nothing in this file repairs
-- anything — run it, read the numbers, then decide. Repair statements are
-- deliberately NOT included so this file cannot be pasted into a prompt by
-- accident and mutate production.
--
-- WHY THIS EXISTS
-- Placing an order has three side effects (see POST /orders in
-- src/routes/orders.ts): Product.stockQty is decremented, a Ledger DEBIT is
-- written, and Profile.creditUsed is incremented.
--
-- Before the admin-cancel fix (src/lib/orderReversal.ts, 2026-07-28) the two
-- admin status routes just flipped Order.status to CANCELLED without undoing
-- any of it. Those orders are still sitting in production with:
--   * stock never returned      → inventory understated, we under-sell
--   * creditUsed never released → the shop's credit line is consumed by an
--                                 order that no longer exists, so a real
--                                 customer gets "Credit limit exceeded" and
--                                 cannot order. This is the customer-facing one.
--
-- HOW A REVERSAL IS DETECTED
-- reverseOrderEffects writes two markers, both keyed on the order number:
--   stock  → StockMovement.reason = CONCAT('Cancel ', orderNumber)
--   credit → Ledger.note          = CONCAT('Cancel ', orderNumber)  (type CREDIT)
-- Status alone is NOT a usable signal: orders cancelled by the old path are
-- CANCELLED but unreversed, which is exactly the population we're looking for.
-- StockMovement has no orderId column, so the reason string is the only join.
--
-- IMPORTANT ASYMMETRY
-- reverseCredit is `paymentStatus !== 'PAID'` (orders.ts:551, :730). A settled
-- order legitimately has NO ledger reversal — the payment webhook already wrote
-- its own CREDIT and decremented creditUsed, and reversing again would drive
-- creditUsed negative. So query 3 excludes PAID. Stock, by contrast, is
-- returned for every cancellation regardless of payment, so query 1 does not
-- filter on paymentStatus.
--
-- Table names are PascalCase and backtick-quoted. Production MySQL on Railway
-- is case-sensitive; dev XAMPP on Windows is not. `Order` MUST be quoted — it
-- is a reserved word.
--
-- Usage:
--   mysql -h <host> -P <port> -u <user> -p <db> < reconcile-unreversed-cancellations.sql
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. HOW MANY, AND WHICH SHOPS
--    Cancelled orders with no stock reversal. One row per affected order.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  o.orderNumber,
  o.createdAt                                   AS orderedAt,
  o.updatedAt                                   AS cancelledAt,
  p.id                                          AS buyerId,
  p.storeName,
  p.phone,
  o.total,
  o.paymentStatus,
  CASE WHEN o.paymentStatus = 'PAID'
       THEN 'stock only (credit settled by payment)'
       ELSE 'stock + credit'
  END                                           AS owedReversal
FROM `Order` o
JOIN `Profile` p ON p.id = o.buyerId
WHERE o.status = 'CANCELLED'
  AND NOT EXISTS (
    SELECT 1 FROM `StockMovement` sm
    WHERE sm.reason = CONCAT('Cancel ', o.orderNumber)
  )
ORDER BY o.updatedAt DESC;


-- Headline count, for the report.
SELECT
  COUNT(*)                                      AS unreversedOrders,
  COUNT(DISTINCT o.buyerId)                     AS shopsAffected,
  ROUND(SUM(o.total), 2)                        AS totalOrderValue,
  MIN(o.updatedAt)                              AS oldest,
  MAX(o.updatedAt)                              AS newest
FROM `Order` o
WHERE o.status = 'CANCELLED'
  AND NOT EXISTS (
    SELECT 1 FROM `StockMovement` sm
    WHERE sm.reason = CONCAT('Cancel ', o.orderNumber)
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 2. HOW MUCH STOCK IS UNDERSTATED, per product
--    piecesOwed = pieces that should have gone back but never did.
--    Mirrors piecesOf() in orderReversal.ts: the at-order piecesPerCarton
--    snapshot wins, falling back to the product's current value for rows
--    predating the carton-fields migration, then to 1. PIECE rows are 1:1.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  pr.id                                         AS productId,
  pr.name                                       AS productName,
  pr.sellUnit,
  pr.stockQty                                   AS currentStockPieces,
  SUM(
    oi.qty * CASE
      WHEN oi.unit = 'CARTON'
        THEN COALESCE(oi.piecesPerCarton, pr.piecesPerCarton, 1)
      ELSE 1
    END
  )                                             AS piecesOwed,
  pr.stockQty + SUM(
    oi.qty * CASE
      WHEN oi.unit = 'CARTON'
        THEN COALESCE(oi.piecesPerCarton, pr.piecesPerCarton, 1)
      ELSE 1
    END
  )                                             AS stockAfterRepair,
  COUNT(DISTINCT o.id)                          AS fromOrders
FROM `Order` o
JOIN `OrderItem` oi ON oi.orderId   = o.id
JOIN `Product`   pr ON pr.id        = oi.productId
WHERE o.status = 'CANCELLED'
  AND NOT EXISTS (
    SELECT 1 FROM `StockMovement` sm
    WHERE sm.reason = CONCAT('Cancel ', o.orderNumber)
  )
GROUP BY pr.id, pr.name, pr.sellUnit, pr.stockQty, pr.piecesPerCarton
ORDER BY piecesOwed DESC;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. WHICH BUYERS HAVE INFLATED creditUsed
--    Excludes PAID — those have no ledger reversal by design (see header).
--    creditUsedShouldBe is what creditUsed would read after repair.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  p.id                                          AS buyerId,
  p.storeName,
  p.phone,
  p.creditLimit,
  p.creditUsed                                  AS creditUsedNow,
  ROUND(SUM(o.total), 2)                        AS creditOverstatedBy,
  ROUND(p.creditUsed - SUM(o.total), 2)         AS creditUsedShouldBe,
  COUNT(*)                                      AS unreversedOrders,
  GROUP_CONCAT(o.orderNumber ORDER BY o.updatedAt DESC SEPARATOR ', ') AS orders
FROM `Order` o
JOIN `Profile` p ON p.id = o.buyerId
WHERE o.status = 'CANCELLED'
  AND o.paymentStatus <> 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM `Ledger` l
    WHERE l.orderId = o.id
      AND l.type    = 'CREDIT'
      AND l.note    = CONCAT('Cancel ', o.orderNumber)
  )
GROUP BY p.id, p.storeName, p.phone, p.creditLimit, p.creditUsed
ORDER BY creditOverstatedBy DESC;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. ⚠ SHOPS BEING WRONGLY BLOCKED RIGHT NOW — act on this one first
--    creditLimit = 0 means "no limit set", so it is excluded.
--    POST /orders rejects when creditUsed + orderTotal > creditLimit
--    (orders.ts:227-233), so a shop at >=90% of limit on phantom credit is
--    effectively unable to order.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  x.storeName,
  x.phone,
  x.creditLimit,
  x.creditUsedNow,
  x.creditOverstatedBy,
  x.creditUsedShouldBe,
  ROUND(100.0 * x.creditUsedNow      / x.creditLimit, 1) AS pctOfLimitNow,
  ROUND(100.0 * x.creditUsedShouldBe / x.creditLimit, 1) AS pctOfLimitAfterRepair,
  ROUND(x.creditLimit - x.creditUsedNow, 2)              AS headroomNow,
  ROUND(x.creditLimit - x.creditUsedShouldBe, 2)         AS headroomAfterRepair,
  CASE
    WHEN x.creditUsedNow >= x.creditLimit THEN 'BLOCKED — cannot order at all'
    WHEN x.creditUsedNow >= x.creditLimit * 0.9 THEN 'NEARLY BLOCKED (>=90%)'
    ELSE 'degraded headroom'
  END                                                    AS impact
FROM (
  SELECT
    p.id, p.storeName, p.phone, p.creditLimit,
    p.creditUsed                          AS creditUsedNow,
    SUM(o.total)                          AS creditOverstatedBy,
    p.creditUsed - SUM(o.total)           AS creditUsedShouldBe
  FROM `Order` o
  JOIN `Profile` p ON p.id = o.buyerId
  WHERE o.status = 'CANCELLED'
    AND o.paymentStatus <> 'PAID'
    AND p.creditLimit > 0
    AND NOT EXISTS (
      SELECT 1 FROM `Ledger` l
      WHERE l.orderId = o.id
        AND l.type    = 'CREDIT'
        AND l.note    = CONCAT('Cancel ', o.orderNumber)
    )
  GROUP BY p.id, p.storeName, p.phone, p.creditLimit, p.creditUsed
) x
-- Only shops the phantom credit actually pushes into trouble: without the
-- inflation they would have headroom, with it they do not.
WHERE x.creditUsedNow      >= x.creditLimit * 0.9
  AND x.creditUsedShouldBe <  x.creditLimit * 0.9
ORDER BY pctOfLimitNow DESC;
