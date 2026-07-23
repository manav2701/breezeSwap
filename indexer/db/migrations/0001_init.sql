-- Migration 0001: Initial schema for BreezeSwap indexer

CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  contract_address TEXT NOT NULL UNIQUE,
  chain_id BIGINT NOT NULL,
  region_id TEXT NOT NULL,
  weather_variable TEXT NOT NULL,
  threshold_low BIGINT NOT NULL,
  threshold_high BIGINT NOT NULL,
  expiry_timestamp BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  final_oracle_value BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL,
  holder_address TEXT NOT NULL,
  side TEXT NOT NULL,
  collateral_asset TEXT NOT NULL,
  collateral_amount NUMERIC NOT NULL,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed BOOLEAN NOT NULL DEFAULT FALSE,
  redeemed_amount NUMERIC,
  redeemed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  oracle_value BIGINT NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tx_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_readings (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL,
  variable TEXT NOT NULL,
  value BIGINT NOT NULL,
  reading_timestamp BIGINT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_positions_holder ON positions(holder_address);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_weather_region_time ON weather_readings(region_id, reading_timestamp);
