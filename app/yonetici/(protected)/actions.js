"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, getSql } from "@/lib/db";

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
    const rev = await sql`
      INSERT INTO ppwr_revisions (record_id, revision_label, ppwr_id, product_name, customer)
      VALUES (${recordId}, ${revisionLabel}, ${s(fd, "ppwr_id")}, ${s(fd, "product_name")}, ${s(fd, "customer")})
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
  const materials = parseJson(s(fd, "materials_json"));
  const requestedStatus = s(fd, "status");
  const safeStatus = ["draft", "review", "cancelled"].includes(requestedStatus) ? requestedStatus : "draft";

  try {
    await sql`
      UPDATE ppwr_revisions SET
        revision_label=${revisionLabel},
        status=${safeStatus},
        ppwr_id=${s(fd, "ppwr_id")},
        declaration_id=${s(fd, "declaration_id")},
        job_code=${s(fd, "job_code")},
        customer=${s(fd, "customer")},
        customer_ref=${s(fd, "customer_ref")},
        system_code=${s(fd, "system_code")},
        importer=${s(fd, "importer")},
        product_name=${s(fd, "product_name")},
        package_class=${s(fd, "package_class")},
        package_type=${s(fd, "package_type")},
        usage_purpose=${s(fd, "usage_purpose")},
        usage_cycle=${s(fd, "usage_cycle")},
        total_weight=${s(fd, "total_weight")},
        production_facility=${s(fd, "production_facility")},
        dimensions=${s(fd, "dimensions")},
        net_area=${s(fd, "net_area")},
        components=CAST(${JSON.stringify(components)} AS jsonb),
        materials=CAST(${JSON.stringify(materials)} AS jsonb),
        identity_status=${s(fd, "identity_status")},
        technical_status=${s(fd, "technical_status")},
        declaration_status=${s(fd, "declaration_status")},
        declaration_title=${s(fd, "declaration_title")},
        declaration_doc_no=${s(fd, "declaration_doc_no")},
        declaration_url=COALESCE(${nullable(fd, "declaration_url_input")}, declaration_url),
        declaration_download_url=COALESCE(${nullable(fd, "declaration_download_url_input")}, declaration_download_url),
        declaration_filename=COALESCE(${nullable(fd, "declaration_filename_input")}, declaration_filename),
        technical_title=${s(fd, "technical_title")},
        technical_doc_no=${s(fd, "technical_doc_no")},
        technical_url=COALESCE(${nullable(fd, "technical_url_input")}, technical_url),
        technical_download_url=COALESCE(${nullable(fd, "technical_download_url_input")}, technical_download_url),
        technical_filename=COALESCE(${nullable(fd, "technical_filename_input")}, technical_filename),
        product_image_url=COALESCE(${nullable(fd, "product_image_url_input")}, product_image_url),
        product_image_source=${s(fd, "product_image_source")},
        product_image_access=${s(fd, "product_image_access")},
        prepared_by=${s(fd, "prepared_by")},
        checked_by=${s(fd, "checked_by")},
        approved_by=${s(fd, "approved_by")},
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
    rev.product_name &&
    rev.approved_by
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
