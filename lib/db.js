import { neon } from "@neondatabase/serverless";

let _sql = null;
let _schemaReady = null;

export function getSql() {
  if (!_sql) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.DATABASE_URL_DATABASE_URL ||
      process.env.DATABASE_URL_POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    if (!connectionString) {
      throw new Error("Neon bağlantı değişkeni bulunamadı.");
    }

    _sql = neon(connectionString);
  }
  return _sql;
}

export function ensureSchema() {
  if (_schemaReady) return _schemaReady;
  _schemaReady = (async () => {
    const sql = getSql();
    await sql`CREATE TABLE IF NOT EXISTS ppwr_records (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ppwr_records_code_ci ON ppwr_records (LOWER(code))`;

    await sql`CREATE TABLE IF NOT EXISTS ppwr_revisions (
      id BIGSERIAL PRIMARY KEY,
      record_id BIGINT NOT NULL REFERENCES ppwr_records(id) ON DELETE CASCADE,
      revision_label TEXT NOT NULL DEFAULT 'Rev.00',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived','cancelled')),
      ppwr_id TEXT,
      declaration_id TEXT,
      job_code TEXT,
      customer TEXT,
      customer_ref TEXT,
      system_code TEXT,
      importer TEXT,
      product_name TEXT,
      package_class TEXT,
      package_type TEXT,
      usage_purpose TEXT,
      usage_cycle TEXT,
      total_weight TEXT,
      production_facility TEXT,
      dimensions TEXT,
      net_area TEXT,
      components JSONB NOT NULL DEFAULT '[]'::jsonb,
      materials JSONB NOT NULL DEFAULT '[]'::jsonb,
      identity_status TEXT DEFAULT 'READY',
      technical_status TEXT DEFAULT 'REVIEW REQUIRED',
      declaration_status TEXT DEFAULT 'DRAFT',
      declaration_title TEXT,
      declaration_doc_no TEXT,
      declaration_url TEXT,
      declaration_download_url TEXT,
      declaration_filename TEXT,
      technical_title TEXT,
      technical_doc_no TEXT,
      technical_url TEXT,
      technical_download_url TEXT,
      technical_filename TEXT,
      product_image_url TEXT,
      product_image_source TEXT,
      product_image_access TEXT,
      prepared_by TEXT,
      checked_by TEXT,
      approved_by TEXT,
      review_date TEXT,
      approved_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(record_id, revision_label)
    )`;
    await sql`ALTER TABLE ppwr_revisions ADD COLUMN IF NOT EXISTS declaration_download_url TEXT`;
    await sql`ALTER TABLE ppwr_revisions ADD COLUMN IF NOT EXISTS technical_download_url TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS ppwr_revisions_record_idx ON ppwr_revisions(record_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS ppwr_revisions_published_idx ON ppwr_revisions(record_id, published_at DESC) WHERE status='published'`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ppwr_one_published_per_record ON ppwr_revisions(record_id) WHERE status='published'`;

    await sql`CREATE TABLE IF NOT EXISTS ppwr_audit_log (
      id BIGSERIAL PRIMARY KEY,
      record_id BIGINT REFERENCES ppwr_records(id) ON DELETE SET NULL,
      revision_id BIGINT REFERENCES ppwr_revisions(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      actor TEXT,
      detail JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS ppwr_audit_record_idx ON ppwr_audit_log(record_id, created_at DESC)`;
  })().catch((error) => {
    _schemaReady = null;
    throw error;
  });
  return _schemaReady;
}

async function readySql() {
  await ensureSchema();
  return getSql();
}

export async function listRecords() {
  const sql = await readySql();
  return sql`
    SELECT r.id, r.code, r.created_at, r.updated_at,
      lr.product_name, lr.customer,
      TRUE AS has_published
    FROM ppwr_records r
    LEFT JOIN LATERAL (
      SELECT product_name, customer
      FROM ppwr_revisions v
      WHERE v.record_id = r.id
      ORDER BY CASE WHEN v.status='published' THEN 0 ELSE 1 END, v.updated_at DESC, v.id DESC
      LIMIT 1
    ) lr ON true
    ORDER BY r.updated_at DESC, r.id DESC
  `;
}

export async function getRecordById(id) {
  const sql = await readySql();
  const rows = await sql`SELECT * FROM ppwr_records WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

export async function getCurrentRecordData(recordId) {
  const sql = await readySql();
  const rows = await sql`
    SELECT * FROM ppwr_revisions
    WHERE record_id = ${recordId}
    ORDER BY CASE WHEN status='published' THEN 0 ELSE 1 END, updated_at DESC, id DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getRevisions(recordId) {
  const sql = await readySql();
  return sql`
    SELECT * FROM ppwr_revisions
    WHERE record_id = ${recordId}
    ORDER BY created_at DESC, id DESC
  `;
}

export async function getRevisionById(id) {
  const sql = await readySql();
  const rows = await sql`SELECT * FROM ppwr_revisions WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

export async function getPublishedRecordByCode(code) {
  const sql = await readySql();
  const rows = await sql`
    SELECT r.id AS record_id, r.code AS public_code, v.*
    FROM ppwr_records r
    JOIN LATERAL (
      SELECT * FROM ppwr_revisions x
      WHERE x.record_id = r.id
      ORDER BY CASE WHEN x.status='published' THEN 0 ELSE 1 END, x.updated_at DESC, x.id DESC
      LIMIT 1
    ) v ON true
    WHERE lower(r.code) = lower(${code})
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getAuditLog(recordId, limit = 30) {
  const sql = await readySql();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100));
  return sql`
    SELECT id, revision_id, action, actor, detail, created_at
    FROM ppwr_audit_log
    WHERE record_id=${recordId}
    ORDER BY created_at DESC, id DESC
    LIMIT ${safeLimit}
  `;
}

export async function healthCheck() {
  const sql = await readySql();
  const rows = await sql`SELECT NOW() AS now, (SELECT COUNT(*)::int FROM ppwr_records) AS records`;
  return rows[0];
}
