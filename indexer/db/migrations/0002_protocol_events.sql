-- Migration 0002: Add protocol_events audit log table for RBAC and Pausable tracking

CREATE TABLE IF NOT EXISTS protocol_events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type      TEXT NOT NULL,   -- 'RoleGranted' | 'RoleRevoked' | 'Paused' | 'Unpaused'
  contract_address TEXT NOT NULL,
  role            TEXT,            -- null for Paused/Unpaused events
  account         TEXT,            -- the address the role/pause action applied to
  triggered_by    TEXT NOT NULL,   -- msg.sender of the transaction
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protocol_events_type ON protocol_events(event_type);
CREATE INDEX IF NOT EXISTS idx_protocol_events_account ON protocol_events(account);
