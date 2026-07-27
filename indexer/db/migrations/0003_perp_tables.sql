-- Migration 0003: Perpetual Weather Markets Database Tables

CREATE TABLE IF NOT EXISTS perp_markets (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_address      TEXT NOT NULL UNIQUE,
  chain_id              INTEGER NOT NULL DEFAULT 114,
  region_id             TEXT NOT NULL,
  region_name           TEXT,
  collateral_token      TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_number          BIGINT NOT NULL DEFAULT 0,
  tx_hash               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS perp_positions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_address        TEXT NOT NULL REFERENCES perp_markets(contract_address),
  position_id           TEXT NOT NULL,
  trader_address        TEXT NOT NULL,
  is_long               BOOLEAN NOT NULL,
  collateral            NUMERIC NOT NULL,
  leverage              INTEGER NOT NULL,
  virtual_size          NUMERIC NOT NULL,
  entry_mark_price      NUMERIC NOT NULL,
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  open_tx_hash          TEXT NOT NULL,
  is_open               BOOLEAN NOT NULL DEFAULT TRUE,
  closed_at             TIMESTAMPTZ,
  close_tx_hash         TEXT,
  realized_pnl          NUMERIC,
  was_liquidated        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS funding_history (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_address        TEXT NOT NULL REFERENCES perp_markets(contract_address),
  funding_rate          NUMERIC NOT NULL,
  cumulative_index      NUMERIC NOT NULL,
  mark_price            NUMERIC NOT NULL,
  oracle_price          NUMERIC NOT NULL,
  settled_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_number          BIGINT NOT NULL DEFAULT 0,
  tx_hash               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mark_price_history (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_address        TEXT NOT NULL,
  mark_price            NUMERIC NOT NULL,
  snapshotted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perp_positions_trader ON perp_positions(trader_address);
CREATE INDEX IF NOT EXISTS idx_perp_positions_market ON perp_positions(market_address);
CREATE INDEX IF NOT EXISTS idx_funding_history_market ON funding_history(market_address);
CREATE INDEX IF NOT EXISTS idx_mark_price_history_market ON mark_price_history(market_address, snapshotted_at);
