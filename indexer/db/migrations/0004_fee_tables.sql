-- Migration 0004: Protocol Fee Revenue Database Tables

CREATE TABLE IF NOT EXISTS fee_events (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_address      TEXT NOT NULL,
  trader_address      TEXT NOT NULL,
  fee_amount          NUMERIC NOT NULL,
  insurance_share     NUMERIC NOT NULL,
  treasury_share      NUMERIC NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_events_market ON fee_events(market_address);
CREATE INDEX IF NOT EXISTS idx_fee_events_trader ON fee_events(trader_address);
