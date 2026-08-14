-- Migration 0006: stop perpetual positions being recorded twice.
--
-- `perp_positions` had no uniqueness at all, and the watcher inserted rather than upserted,
-- so the same on-chain event recorded a second row every time it was seen twice. That is
-- not a rare case: any second indexer instance sees the same events, and so does a backfill
-- that overlaps a range already processed. The result was a trade history where every trade
-- appeared twice with an identical transaction hash.
--
-- The classic `positions` table never had this problem because `tx_hash` is UNIQUE there.
-- This gives the perp table the equivalent guarantee.

-- Collapse existing duplicates first, keeping the earliest row per position.
DELETE FROM perp_positions a
USING perp_positions b
WHERE a.market_address = b.market_address
  AND a.position_id = b.position_id
  AND a.ctid > b.ctid;

-- A position id is only unique within its market, so the constraint has to be the pair.
ALTER TABLE perp_positions
  DROP CONSTRAINT IF EXISTS perp_positions_market_position_key;

ALTER TABLE perp_positions
  ADD CONSTRAINT perp_positions_market_position_key
  UNIQUE (market_address, position_id);
