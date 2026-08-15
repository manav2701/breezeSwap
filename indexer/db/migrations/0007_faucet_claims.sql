-- Migration 0007: record which wallets have taken the demo collateral drip.
--
-- The demo collateral token has no mint function, its whole supply was minted at
-- deployment, so the faucet transfers from a funded wallet rather than minting. That makes
-- a claim record load bearing: without one, a single address could drain the float by
-- calling the endpoint repeatedly.
--
-- The address is the primary key, which is the constraint doing the real work. Two requests
-- racing for the same wallet cannot both insert, so the second fails on the key rather than
-- on an application check that has already passed.

CREATE TABLE IF NOT EXISTS faucet_claims (
  wallet_address  TEXT PRIMARY KEY,
  amount          NUMERIC NOT NULL,
  tx_hash         TEXT,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS faucet_claims_claimed_at_idx ON faucet_claims (claimed_at DESC);
