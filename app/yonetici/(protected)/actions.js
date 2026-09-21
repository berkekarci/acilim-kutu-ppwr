"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, getSql } from "@/lib/db";
import { COMPANY } from "@/lib/company";

function s(fd, key) {
  return String(fd.get(key) || "").trim();
}

function nullable(fd, key) {
  const value = s(fd, key);
  return value || null;
}

function parseJson(value, fallback = []) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function validCode(code) {
  return code.length > 0 && code.length <= 160 && /^[\p{L}\p{N}._-]+$/u.test(code);
}

function validRevisionLabel(label) {
  return label.length > 0 && label.length <= 80 && !/[\/?#%]/.test(label);
}

function declarationIdFromPpwr(ppwrId) {
  const value = String(ppwrId || "").trim();
  return value.replace(/(^|[-_.])APB(?=([-_.]|$))/i, "$1DOC");
}

const DEFAULT_PACKAGE_CLASS = "Yedek Parça Kutusu";
const DEFAULT_PACKAGE_TYPE = "Kağıt / Karton Ambalaj";
const DEFAULT_PRODUCTION_FACILITY = `${COMPANY.name} — İTOB OSB, Menderes / İzmir / Türkiye`;

const E_FLUTE_TAKE_UP = 1.25;
const LINER_GSM = 90;
const FLUTING_GSM = 90;
const KROME_GSM = 210;
const GLUE_GSM = 12;
const EFFECTIVE_GSM = LINER_GSM + (FLUTING_GSM * E_FLUTE_TAKE_UP) + KROME_GSM + GLUE_GSM;

function parseAreaM2(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace("m²", "")
    .replace("m2", "")
    .replace(",", ".")
    .trim();
  const area = Number.parseFloat(normalized);
  return Number.isFinite(area) && area > 0 ? area : 0;
}

function calculateEFluteWeight(areaValue) {
  const area = parseAreaM2(areaValue);
  if (!area) return "";
  return `${(area * EFFECTIVE_GSM).toFixed(2)} g`;
}

function calculateEFluteMaterials(areaValue) {
  const area = parseAreaM2(areaValue);
  const rows = [
    { name: "Liner 90 g/m²", gsm: LINER_GSM },
    { name: "Fluting 90 g/m² × 1,25", gsm: FLUTING_GSM * E_FLUTE_TAKE_UP },
    { name: "Krome 210 g/m²", gsm: KROME_GSM },
    { name: "Tutkal 12 g/m²", gsm: GLUE_GSM },
  ];
  return rows.map((row) => ({
    name: row.name,
    weight: area ? `${(area * row.gsm).toFixed(2)} g` : "Net alan bekleniyor",
    ratio: `%${((row.gsm / EFFECTIVE_GSM) * 100).toFixed(2)}`,
    evidence: "E Dalga otomatik reçete",
  }));
}

function isEFlute(value) {
  return /e\s*dalga/i.test(String(value || ""));
}

async function audit(sql, recordId, revisionId, action, detail = {}) {
  await sql`
    INSERT INTO ppwr_audit_log (record_id, revision_id, action, actor, detail)
    VALUES (
      ${recordId},
      ${revisionId},
      ${action},
      ${process.env.ADMIN_USERNAME || "yonetici"},
      CAST(${JSON.stringify(detail)} AS jsonb)
    )
  `;
}

export async function logoutAction() {
  const { destroyAdminSession } = await import("@/lib/auth");
  await destroyAdminSession();
  redirect("/yonetici/giris");
}

export async function createRecordAction(fd) {
  await requireAdmin();
  await ensureSchema();
  const code = s(fd, "code");
  const revisionLabel = s(fd, "revision_label") || "Rev.00";

  if (!validCode(code)) redirect("/yonetici/yeni?hata=kod");
  if (!validRevisionLabel(revisionLabel)) redirect("/yonetici/yeni?hata=revizyon");

  const sql = getSql();
  try {
    const rows = await sql`INSERT INTO ppwr_records (code) VALUES (${code}) RETURNING id`;
    const recordId = rows[0].id;
    const ppwrId = s(fd, "ppwr_id");
    const rev = await sql`
      INSERT INTO ppwr_revisions (
        record_id, revision_label, ppwr_id, declaration_id, product_name, customer,
        package_class, package_type, production_facility
      )
      VALUES (
        ${recordId}, ${revisionLabel}, ${ppwrId}, ${declarationIdFromPpwr(ppwrId)}, ${s(fd, "product_name")}, ${s(fd, "customer")},
        ${DEFAULT_PACKAGE_CLASS}, ${DEFAULT_PACKAGE_TYPE}, ${DEFAULT_PRODUCTION_FACILITY}
      )
      RETURNING id
    `;
    await audit(sql, recordId, rev[0].id, "record_created", { code });
    redirect(`/yonetici/${recordId}`);
  } catch (error) {
    if (String(error?.message || error).toLowerCase().includes("unique")) {
      redirect("/yonetici/yeni?hata=tekrar");
    }
    throw error;
  }
}

export async function saveRevisionAction(fd) {
  await requireAdmin();
  await ensureSchema();
  const sql = getSql();
  const recordId = s(fd, "record_id");
  const revisionId = s(fd, "revision_id");
  const revisionLabel = s(fd, "revision_label");

  if (!validRevisionLabel(revisionLabel)) {
    redirect(`/yonetici/${recordId}?rev=${revisionId}&hata=revizyon`);
  }

  const record = (await sql`SELECT * FROM ppwr_records WHERE id=${recordId} LIMIT 1`)[0];
  if (!record) throw new Error("Kayıt bulunamadı.");

  const current = (await sql`
    SELECT * FROM ppwr_revisions WHERE id=${revisionId} AND record_id=${recordId} LIMIT 1
  `)[0];
  if (!current) throw new Error("Revizyon bulunamadı.");
  if (current.status === "published" || current.status === "archived") {
    throw new Error("Yayınlanmış/arşivlenmiş revizyon doğrudan değiştirilemez. Yeni revizyon oluşturun.");
  }

  const components = parseJson(s(fd, "components_json"));
  const submittedMaterials = parseJson(s(fd, "materials_json"));
  const safeStatus = ["draft", "review", "cancelled"].includes(current.status) ? current.status : "draft";
  const ppwrId = s(fd, "ppwr_id");
  const packageType = s(fd, "package_type") || DEFAULT_PACKAGE_TYPE;
  const netArea = s(fd, "net_area");
  const eFluteSelected = isEFlute(packageType);
  const calculatedWeight = eFluteSelected ? calculateEFluteWeight(netArea) : s(fd, "total_weight");
  const materials = eFluteSelected ? calculateEFluteMaterials(netArea) : submittedMaterials;

  try {
    await sql`
      UPDATE ppwr_revisions SET
        revision_label=${revisionLabel},
        status=${safeStatus},
        ppwr_id=${ppwrId},
        declaration_id=${declarationIdFromPpwr(ppwrId)},
        job_code=${s(fd, "job_code")},
        customer=${s(fd, "customer")},
        customer_ref='',
        system_code=${s(fd, "system_code")},
        importer='',
        product_name=${s(fd, "product_name")},
        package_class=${DEFAULT_PACKAGE_CLASS},
        package_type=${packageType},
        usage_purpose='',
        usage_cycle=${s(fd, "usage_cycle")},
        total_weight=${calculatedWeight},
        production_facility=${s(fd, "production_facility") || DEFAULT_PRODUCTION_FACILITY},
        dimensions=${s(fd, "dimensions")},
        net_area=${netArea},
        components=CAST(${JSON.stringify(components)} AS jsonb),
        materials=CAST(${JSON.stringify(materials)} AS jsonb),
        identity_status='Otomatik',
        technical_status=CASE WHEN technical_url IS NOT NULL THEN 'PDF eklendi' ELSE 'İsteğe bağlı' END,
        declaration_status=CASE WHEN declaration_url IS NOT NULL THEN 'PDF eklendi' ELSE 'İsteğe bağlı' END,
        declaration_title='',
        declaration_doc_no='',
        declaration_url=COALESCE(${nullable(fd, "declaration_url_input")}, declaration_url),
        declaration_download_url=COALESCE(${nullable(fd, "declaration_download_url_input")}, declaration_download_url),
        declaration_filename=COALESCE(${nullable(fd, "declaration_filename_input")}, declaration_filename),
        technical_title=${s(fd, "technical_title")},
        technical_doc_no=${s(fd, "technical_doc_no")},
        technical_url=COALESCE(${nullable(fd, "technical_url_input")}, technical_url),
        technical_download_url=COALESCE(${nullable(fd, "technical_download_url_input")}, technical_download_url),
        technical_filename=COALESCE(${nullable(fd, "technical_filename_input")}, technical_filename),
        product_image_url=COALESCE(${nullable(fd, "product_image_url_input")}, product_image_url),
        product_image_source='',
        product_image_access='',
        prepared_by='',
        checked_by='',
        approved_by='',
        review_date=${s(fd, "review_date")},
        updated_at=NOW()
      WHERE id=${revisionId} AND record_id=${recordId}
    `;
  } catch (error) {
    if (String(error?.message || error).toLowerCase().includes("unique")) {
      redirect(`/yonetici/${recordId}?rev=${revisionId}&hata=revizyon-tekrar`);
    }
    throw error;
  }

  await sql`UPDATE ppwr_records SET updated_at=NOW() WHERE id=${recordId}`;
  await audit(sql, recordId, revisionId, "revision_saved", { status: safeStatus });
  revalidatePath(`/yonetici/${recordId}`);
  redirect(`/yonetici/${recordId}?rev=${revisionId}&kaydedildi=1`);
}

export async function newRevisionAction(fd) {
  await requireAdmin();
  await ensureSchema();
  const sql = getSql();
  const recordId = s(fd, "record_id");
  const sourceId = s(fd, "source_revision_id");
  const label = s(fd, "new_revision_label");

  if (!validRevisionLabel(label)) redirect(`/yonetici/${recordId}?hata=revizyon`);

  try {
    const rows = await sql`
      INSERT INTO ppwr_revisions (
        record_id, revision_label, status, ppwr_id, declaration_id, job_code, customer, customer_ref, system_code, importer,
        product_name, package_class, package_type, usage_purpose, usage_cycle, total_weight, production_facility, dimensions, net_area,
        components, materials, identity_status, technical_status, declaration_status,
        declaration_title, declaration_doc_no, declaration_url, declaration_download_url, declaration_filename,
        technical_title, technical_doc_no, technical_url, technical_download_url, technical_filename,
        product_image_url, product_image_source, product_image_access,
        prepared_by, checked_by, approved_by, review_date
      )
      SELECT
        record_id, ${label}, 'draft', ppwr_id, declaration_id, job_code, customer, customer_ref, system_code, importer,
        product_name, package_class, package_type, usage_purpose, usage_cycle, total_weight, production_facility, dimensions, net_area,
        components, materials, identity_status, technical_status, declaration_status,
        declaration_title, declaration_doc_no, declaration_url, declaration_download_url, declaration_filename,
        technical_title, technical_doc_no, technical_url, technical_download_url, technical_filename,
        product_image_url, product_image_source, product_image_access,
        prepared_by, checked_by, NULL, review_date
      FROM ppwr_revisions
      WHERE id=${sourceId} AND record_id=${recordId}
      RETURNING id
    `;
    if (!rows[0]) throw new Error("Kaynak revizyon bulunamadı.");
    await audit(sql, recordId, rows[0].id, "revision_created", { sourceId, label });
    redirect(`/yonetici/${recordId}?rev=${rows[0].id}`);
  } catch (error) {
    if (String(error?.message || error).toLowerCase().includes("unique")) {
      redirect(`/yonetici/${recordId}?hata=revizyon-tekrar`);
    }
    throw error;
  }
}

export async function publishRevisionAction(fd) {
  await requireAdmin();
  await ensureSchema();
  const sql = getSql();
  const recordId = s(fd, "record_id");
  const revisionId = s(fd, "revision_id");
  const rev = (await sql`
    SELECT * FROM ppwr_revisions WHERE id=${revisionId} AND record_id=${recordId} LIMIT 1
  `)[0];

  if (!rev) throw new Error("Revizyon bulunamadı.");
  const publishReady = Boolean(
    rev.ppwr_id &&
    rev.product_name
  );
  if (!publishReady) {
    redirect(`/yonetici/${recordId}?rev=${revisionId}&hata=yayin-zorunlu`);
  }

  await sql`
    WITH archived AS (
      UPDATE ppwr_revisions
      SET status='archived', updated_at=NOW()
      WHERE record_id=${recordId} AND status='published' AND id<>${revisionId}
      RETURNING id
    )
    UPDATE ppwr_revisions
    SET status='published', published_at=NOW(), approved_at=COALESCE(approved_at,NOW()), updated_at=NOW()
    WHERE id=${revisionId} AND record_id=${recordId}
  `;

  await sql`UPDATE ppwr_records SET updated_at=NOW() WHERE id=${recordId}`;
  await audit(sql, recordId, revisionId, "revision_published", {});

  const rec = (await sql`SELECT code FROM ppwr_records WHERE id=${recordId} LIMIT 1`)[0];
  revalidatePath(`/yonetici/${recordId}`);
  revalidatePath("/yonetici");
  if (rec?.code) revalidatePath(`/${rec.code}`);
  redirect(`/yonetici/${recordId}?rev=${revisionId}&yayinlandi=1`);
}


export async function deleteRecordAction(fd) {
  await requireAdmin();
  await ensureSchema();

  const sql = getSql();
  const recordId = s(fd, "record_id");
  const confirmation = s(fd, "confirm_delete");

  if (confirmation !== "EVET") {
    redirect(`/yonetici/${recordId}?hata=silme-onay`);
  }

  const record = (await sql`
    SELECT id, code FROM ppwr_records WHERE id=${recordId} LIMIT 1
  `)[0];

  if (!record) {
    redirect("/yonetici");
  }

  await sql`DELETE FROM ppwr_audit_log WHERE record_id=${recordId}`;
  await sql`DELETE FROM ppwr_records WHERE id=${recordId}`;

  revalidatePath("/yonetici");
  revalidatePath(`/${record.code}`);
  redirect("/yonetici?silindi=1");
}
