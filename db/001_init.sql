CREATE TABLE IF NOT EXISTS ppwr_records (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ppwr_records_code_ci ON ppwr_records (LOWER(code));

CREATE TABLE IF NOT EXISTS ppwr_revisions (
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
);
CREATE INDEX IF NOT EXISTS ppwr_revisions_record_idx ON ppwr_revisions(record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ppwr_revisions_published_idx ON ppwr_revisions(record_id, published_at DESC) WHERE status='published';
CREATE UNIQUE INDEX IF NOT EXISTS ppwr_one_published_per_record ON ppwr_revisions(record_id) WHERE status='published';

CREATE TABLE IF NOT EXISTS ppwr_audit_log (
  id BIGSERIAL PRIMARY KEY,
  record_id BIGINT REFERENCES ppwr_records(id) ON DELETE SET NULL,
  revision_id BIGINT REFERENCES ppwr_revisions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ppwr_audit_record_idx ON ppwr_audit_log(record_id, created_at DESC);
