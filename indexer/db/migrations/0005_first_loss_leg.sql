-- Migration 0005: Fees split three ways once waterfall tier 1 gained its own reserve.
--
-- `FeeCollected` previously carried (feeAmount, insuranceShare, treasuryShare).
-- Tier 1 of the loss waterfall used to draw the SAME balance the perp market draws
-- for liquidation bad debt, which let the vault starve liquidation. Separating them
-- required a separately funded fee leg, so the event gained `firstLossShare` and
-- this table needs somewhere to put it.
--
-- Defaulted rather than backfilled: rows written before the split genuinely had no
-- first-loss leg, and inventing one would misstate history.

ALTER TABLE fee_events
  ADD COLUMN IF NOT EXISTS first_loss_share NUMERIC NOT NULL DEFAULT 0;
