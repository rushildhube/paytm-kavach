/**
 * Database schema as numbered migrations. `PRAGMA user_version` holds the
 * number of the last migration applied.
 *
 * To change the schema, append a new migration (never edit an old one) and
 * it runs on the next start. A database newer than this code (user_version
 * above MIGRATIONS.length, e.g. after switching branches) is rebuilt from
 * the seed, which is fine because everything in it is demo data.
 *
 * Kept as TypeScript strings, not a .sql file read at runtime, so the Next
 * build does not need to locate a file next to the bundled code.
 */
export const MIGRATIONS: readonly string[] = [
  // 1: initial schema
  `
  CREATE TABLE merchants (
    id            TEXT PRIMARY KEY,
    shop_name     TEXT NOT NULL,
    owner_name    TEXT NOT NULL,
    city          TEXT NOT NULL,
    language      TEXT NOT NULL,
    bank_name     TEXT NOT NULL,
    -- Only the last four digits of the account, never the full number.
    account_last4 TEXT NOT NULL CHECK (account_last4 GLOB '[0-9][0-9][0-9][0-9]'),
    prior_reports INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE transactions (
    id                TEXT PRIMARY KEY,
    merchant_id       TEXT NOT NULL REFERENCES merchants(id),
    amount_inr        REAL NOT NULL CHECK (amount_inr > 0),
    at                TEXT NOT NULL,
    -- Masked before it is written (DPDP Act): "vi***@okdemo".
    payer_vpa_masked  TEXT NOT NULL CHECK (instr(payer_vpa_masked, '*') > 0),
    settlement_status TEXT NOT NULL CHECK (settlement_status IN ('unsettled', 'settled')),
    settled_at        TEXT,
    utr               TEXT,
    bill_id           TEXT
  );

  -- Proof of sale. Append-only: written once at payment time, never changed.
  CREATE TABLE sale_tags (
    txn_id      TEXT PRIMARY KEY REFERENCES transactions(id),
    recorded_at TEXT NOT NULL,
    transcript  TEXT NOT NULL CHECK (length(transcript) > 0),
    items       TEXT NOT NULL,          -- JSON array of SaleItem
    source      TEXT NOT NULL CHECK (source IN ('voice', 'recorded_clip', 'bill')),
    bound_by    TEXT CHECK (bound_by IN ('bill', 'tap', 'only_open', 'amount', 'amount_and_name')),
    bill_id     TEXT
  );
  CREATE TRIGGER sale_tags_no_update BEFORE UPDATE ON sale_tags
  BEGIN SELECT RAISE(ABORT, 'sale tags are append-only'); END;
  CREATE TRIGGER sale_tags_no_delete BEFORE DELETE ON sale_tags
  BEGIN SELECT RAISE(ABORT, 'sale tags are append-only'); END;

  -- Bill-first (issue #15). Content is fixed; status moves once, out of 'open'.
  CREATE TABLE bills (
    id          TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    amount_inr  REAL NOT NULL CHECK (amount_inr > 0),
    text        TEXT NOT NULL,
    items       TEXT NOT NULL,          -- JSON array of SaleItem
    created_at  TEXT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('open', 'paid', 'cancelled')),
    txn_id      TEXT REFERENCES transactions(id)
  );
  CREATE TRIGGER bills_content_fixed
  BEFORE UPDATE OF id, merchant_id, amount_inr, text, items, created_at ON bills
  BEGIN SELECT RAISE(ABORT, 'bill content cannot be changed'); END;
  CREATE TRIGGER bills_status_once BEFORE UPDATE OF status, txn_id ON bills
  WHEN OLD.status <> 'open'
  BEGIN SELECT RAISE(ABORT, 'only an open bill can change status'); END;
  CREATE TRIGGER bills_no_delete BEFORE DELETE ON bills
  BEGIN SELECT RAISE(ABORT, 'bills cannot be deleted'); END;

  -- Bank-side only. Never sent to the merchant, Soundbox or customer views.
  CREATE TABLE reports (
    id          TEXT PRIMARY KEY,
    txn_id      TEXT NOT NULL UNIQUE REFERENCES transactions(id),
    ack_no      TEXT NOT NULL,
    reported_at TEXT NOT NULL,
    amount_inr  REAL NOT NULL
  );

  CREATE TABLE holds (
    id              TEXT PRIMARY KEY,
    txn_id          TEXT NOT NULL UNIQUE REFERENCES transactions(id),
    type            TEXT NOT NULL CHECK (type IN ('police', 'bank')),
    scope           TEXT NOT NULL CHECK (scope IN ('lien', 'debit_freeze')),
    held_amount_inr REAL NOT NULL,
    placed_at       TEXT NOT NULL,
    reference       TEXT NOT NULL
  );

  -- Mule-screen result, one per hold, written once. Merchant side only.
  CREATE TABLE screenings (
    hold_id     TEXT PRIMARY KEY REFERENCES holds(id),
    answers     TEXT NOT NULL,          -- JSON MuleScreenAnswers
    eligibility TEXT NOT NULL,          -- JSON Eligibility
    at          TEXT NOT NULL
  );
  CREATE TRIGGER screenings_no_update BEFORE UPDATE ON screenings
  BEGIN SELECT RAISE(ABORT, 'a screening result cannot be changed'); END;

  CREATE TABLE grievances (
    hold_id               TEXT PRIMARY KEY REFERENCES holds(id),
    filed_at              TEXT NOT NULL,
    escalation_drafted_at TEXT
  );

  -- Simulated clock offset, reset epoch, active merchant and id counters.
  CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,

  // 2: invoices attached at payment time (issues #15, #19). Only a fingerprint
  // of the file is kept, never its bytes or name (the file may show buyer
  // details). One per payment, written once.
  `
  CREATE TABLE invoices (
    txn_id      TEXT PRIMARY KEY REFERENCES transactions(id),
    attached_at TEXT NOT NULL,
    sha256      TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
    kind        TEXT NOT NULL CHECK (kind IN ('pdf', 'jpeg', 'png', 'webp')),
    size_bytes  INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
    total_inr   REAL CHECK (total_inr IS NULL OR total_inr > 0)
  );
  CREATE TRIGGER invoices_no_update BEFORE UPDATE ON invoices
  BEGIN SELECT RAISE(ABORT, 'invoices are append-only'); END;
  CREATE TRIGGER invoices_no_delete BEFORE DELETE ON invoices
  BEGIN SELECT RAISE(ABORT, 'invoices are append-only'); END;
  `,

  // 3: a sale description the merchant types on the phone for a payment that
  // came without a bill ("typed"). SQLite cannot change a CHECK, so the table is
  // rebuilt with its rows and both append-only triggers. Still only inside the
  // tag window, through recordSaleTag.
  `
  CREATE TABLE sale_tags_v3 (
    txn_id      TEXT PRIMARY KEY REFERENCES transactions(id),
    recorded_at TEXT NOT NULL,
    transcript  TEXT NOT NULL CHECK (length(transcript) > 0),
    items       TEXT NOT NULL,
    source      TEXT NOT NULL CHECK (source IN ('voice', 'recorded_clip', 'bill', 'typed')),
    bound_by    TEXT CHECK (bound_by IN ('bill', 'tap', 'only_open', 'amount', 'amount_and_name')),
    bill_id     TEXT
  );
  INSERT INTO sale_tags_v3 SELECT txn_id, recorded_at, transcript, items, source, bound_by, bill_id FROM sale_tags;
  DROP TABLE sale_tags;
  ALTER TABLE sale_tags_v3 RENAME TO sale_tags;
  CREATE TRIGGER sale_tags_no_update BEFORE UPDATE ON sale_tags
  BEGIN SELECT RAISE(ABORT, 'sale tags are append-only'); END;
  CREATE TRIGGER sale_tags_no_delete BEFORE DELETE ON sale_tags
  BEGIN SELECT RAISE(ABORT, 'sale tags are append-only'); END;
  `,
];
