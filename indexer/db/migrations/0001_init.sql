-- Migration 0001: Complete schema for BreezeSwap indexer

CREATE TABLE IF NOT EXISTS markets (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_address    TEXT NOT NULL UNIQUE,
  chain_id            INTEGER NOT NULL DEFAULT 114,
  region_id           TEXT NOT NULL,
  region_name         TEXT,
  weather_variable    TEXT NOT NULL,
  payoff_type         TEXT NOT NULL,
  threshold_low       NUMERIC NOT NULL,
  threshold_high      NUMERIC,
  expiry_timestamp    TIMESTAMPTZ NOT NULL,
  collateral_token    TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'OPEN',
  final_oracle_value  NUMERIC,
  long_payout_ratio   NUMERIC,
  short_payout_ratio  NUMERIC,
  settled_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_number        BIGINT NOT NULL DEFAULT 0,
  tx_hash             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_address      TEXT NOT NULL REFERENCES markets(contract_address),
  token_id            TEXT NOT NULL,
  holder_address      TEXT NOT NULL,
  side                TEXT NOT NULL,
  collateral_asset    TEXT NOT NULL,
  collateral_amount   NUMERIC NOT NULL,
  minted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_number        BIGINT NOT NULL DEFAULT 0,
  tx_hash             TEXT NOT NULL UNIQUE,
  redeemed            BOOLEAN NOT NULL DEFAULT FALSE,
  redeemed_amount     NUMERIC,
  redeemed_at         TIMESTAMPTZ,
  redeem_tx_hash      TEXT
);

CREATE TABLE IF NOT EXISTS settlements (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_address      TEXT NOT NULL REFERENCES markets(contract_address),
  oracle_value        NUMERIC NOT NULL,
  long_payout_ratio   NUMERIC NOT NULL,
  short_payout_ratio  NUMERIC NOT NULL,
  settled_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_number        BIGINT NOT NULL DEFAULT 0,
  tx_hash             TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS weather_readings (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id           TEXT NOT NULL,
  region_name         TEXT,
  variable            TEXT NOT NULL DEFAULT 'RAINFALL',
  value               NUMERIC NOT NULL,
  reading_timestamp   TIMESTAMPTZ NOT NULL,
  indexed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_number        BIGINT NOT NULL DEFAULT 0,
  tx_hash             TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS indexer_state (
  id                  TEXT PRIMARY KEY,
  last_block          BIGINT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial indexer_state row
INSERT INTO indexer_state (id, last_block) VALUES ('coston2_main', 0) ON CONFLICT (id) DO NOTHING;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_positions_holder ON positions(holder_address);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_address);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_weather_region ON weather_readings(region_id, reading_timestamp);
