"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, getSql } from "@/lib/db";
import { COMPANY } from "@/lib/company";
import { del } from "@vercel/blob";

function s(fd, key) {
  return String(fd.get(key) || "").trim();
}

function nullable(fd, key) {
  const value = s(fd, key);
  return value || null;
}

async function deleteBlobQuietly(url) {
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".blob.vercel-storage.com")) return;
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch {
    // Veritabanı kaydı güncellense bile eski dosya temizliği kullanıcı işlemini engellemez.
  }
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

function declarationIdFromPpwr(ppwrId) {
  const value = String(ppwrId || "").trim();
  return value.replace(/(^|[-_.])APB(?=([-_.]|$))/i, "$1DOC");
}

const DEFAULT_PACKAGE_CLASS = "Yedek Parça Kutusu";
const DEFAULT_PACKAGE_TYPE = "Krome";
const DEFAULT_PRODUCTION_FACILITY = `${COMPANY.name} — İTOB OSB, Menderes / İzmir / Türkiye`;

const E_FLUTE_TAKE_UP = 1.25;
const B_FLUTE_TAKE_UP = 1.35;

const PACKAGE_RECIPES = {
  Krome: [
    { name: "Krome Karton 330 g/m²", gsm: 330 },
  ],
  "E Dalga": [
    { name: "Liner 90 g/m²", gsm: 90 },
    { name: "E Fluting 90 g/m² × 1,25", gsm: 90 * E_FLUTE_TAKE_UP },
    { name: "Krome 210 g/m²", gsm: 210 },
    { name: "Tutkal 12 g/m²", gsm: 12 },
  ],
  "B Dalga": [
    { name: "Liner 90 g/m²", gsm: 90 },
    { name: "B Fluting 90 g/m² × 1,35", gsm: 90 * B_FLUTE_TAKE_UP },
    { name: "Krome 210 g/m²", gsm: 210 },
  ],
  "EB Dalga": [
    { name: "Liner 90 g/m² (1)", gsm: 90 },
    { name: "E Fluting 90 g/m² × 1,25", gsm: 90 * E_FLUTE_TAKE_UP },
    { name: "Tutkal 12 g/m² (1)", gsm: 12 },
    { name: "Liner 90 g/m² (2)", gsm: 90 },
    { name: "B Fluting 90 g/m² × 1,35", gsm: 90 * B_FLUTE_TAKE_UP },
    { name: "Tutkal 12 g/m² (2)", gsm: 12 },
    { name: "Krome 210 g/m²", gsm: 210 },
  ],
};

function normalizePackageType(value) {
  const raw = String(value || "").trim();
  if (raw === "E Dalga Sıvamalı") return "E Dalga";
  return PACKAGE_RECIPES[raw] ? raw : DEFAULT_PACKAGE_TYPE;
}

function recipeFor(packageType) {
  return PACKAGE_RECIPES[normalizePackageType(packageType)];
}

function effectiveGsm(packageType) {
  return recipeFor(packageType).reduce((sum, row) => sum + row.gsm, 0);
}

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

function calculatePackageWeight(areaValue, packageType) {
  const area = parseAreaM2(areaValue);
  if (!area) return "";
  return `${(area * effectiveGsm(packageType)).toFixed(2)} g`;
}

function calculatePackageMaterials(areaValue, packageType) {
  const area = parseAreaM2(areaValue);
  const recipe = recipeFor(packageType);
  const totalGsm = effectiveGsm(packageType);
  return recipe.map((row) => ({
    name: row.name,
    weight: area ? `${(area * row.gsm).toFixed(2)} g` : "Net alan bekleniyor",
    ratio: `%${((row.gsm / totalGsm) * 100).toFixed(2)}`,
  }));
}

async function audit(sql, recordId, dataId, action, detail = {}) {
  await sql`
    INSERT INTO ppwr_audit_log (record_id, revision_id, action, actor, detail)
    VALUES (
      ${recordId},
      ${dataId},
      ${action},
      ${process.env.ADMIN_USERNAME || "yonetici"},
      CAST(${JSON.stringify(detail)} AS jsonb)
    )
  `;
}

export async function logoutAction() {
  const { destroyAdminSession } = await import("@/lib/auth");
  await destroyAdminSession();
  redirect("/admin/giris");
}

export async function createRecordAction(fd) {
  await requireAdmin();
  await ensureSchema();
  const code = s(fd, "code");
  if (!validCode(code)) redirect("/admin/yeni?hata=kod");

  const sql = getSql();
  try {
    const rows = await sql`INSERT INTO ppwr_records (code) VALUES (${code}) RETURNING id`;
    const recordId = rows[0].id;
    const ppwrId = s(fd, "ppwr_id");
    const rev = await sql`
      INSERT INTO ppwr_revisions (
        record_id, revision_label, status, ppwr_id, declaration_id, product_name, customer,
        package_class, package_type, production_facility, published_at, approved_at
      )
      VALUES (
        ${recordId}, 'CURRENT', 'published', ${ppwrId}, ${declarationIdFromPpwr(ppwrId)}, ${s(fd, "product_name")}, ${s(fd, "customer")},
        ${DEFAULT_PACKAGE_CLASS}, ${DEFAULT_PACKAGE_TYPE}, ${DEFAULT_PRODUCTION_FACILITY}, NOW(), NOW()
      )
      RETURNING id
    `;
    await audit(sql, recordId, rev[0].id, "record_created", { code });
    redirect(`/admin/${recordId}`);
  } catch (error) {
    if (String(error?.message || error).toLowerCase().includes("unique")) {
      redirect("/admin/yeni?hata=tekrar");
    }
    throw error;
  }
}

export async function saveRecordAction(fd) {
  await requireAdmin();
  await ensureSchema();
  const sql = getSql();
  const recordId = s(fd, "record_id");
  const dataId = s(fd, "data_id");
  const record = (await sql`SELECT * FROM ppwr_records WHERE id=${recordId} LIMIT 1`)[0];
  if (!record) throw new Error("Kayıt bulunamadı.");

  const current = (await sql`
    SELECT * FROM ppwr_revisions WHERE id=${dataId} AND record_id=${recordId} LIMIT 1
  `)[0];
  if (!current) throw new Error("PPWR kayıt verisi bulunamadı.");
  const ppwrId = s(fd, "ppwr_id");
  const packageType = normalizePackageType(s(fd, "package_type"));
  const netArea = s(fd, "net_area");
  const calculatedWeight = calculatePackageWeight(netArea, packageType);
  const materials = calculatePackageMaterials(netArea, packageType);

  const declarationRemove = s(fd, "declaration_remove") === "1";
  const technicalRemove = s(fd, "technical_remove") === "1";
  const productImageRemove = s(fd, "product_image_remove") === "1";

  const incomingDeclarationUrl = nullable(fd, "declaration_url_input");
  const declarationUrl = incomingDeclarationUrl || (declarationRemove ? null : current.declaration_url);
  const declarationDownloadUrl = incomingDeclarationUrl
    ? (nullable(fd, "declaration_download_url_input") || incomingDeclarationUrl)
    : (declarationRemove ? null : current.declaration_download_url);
  const declarationFilename = incomingDeclarationUrl
    ? nullable(fd, "declaration_filename_input")
    : (declarationRemove ? null : current.declaration_filename);

  const incomingTechnicalUrl = nullable(fd, "technical_url_input");
  const technicalUrl = incomingTechnicalUrl || (technicalRemove ? null : current.technical_url);
  const technicalDownloadUrl = incomingTechnicalUrl
    ? (nullable(fd, "technical_download_url_input") || incomingTechnicalUrl)
    : (technicalRemove ? null : current.technical_download_url);
  const technicalFilename = incomingTechnicalUrl
    ? nullable(fd, "technical_filename_input")
    : (technicalRemove ? null : current.technical_filename);

  const incomingProductImageUrl = nullable(fd, "product_image_url_input");
  const productImageUrl = incomingProductImageUrl || (productImageRemove ? null : current.product_image_url);

  // Her PPWR kaydı yalnızca tek güncel veri satırı taşır.
  await sql`DELETE FROM ppwr_audit_log WHERE record_id=${recordId} AND revision_id IS NOT NULL AND revision_id<>${dataId}`;
  await sql`DELETE FROM ppwr_revisions WHERE record_id=${recordId} AND id<>${dataId}`;

  try {
    await sql`
      UPDATE ppwr_revisions SET
        revision_label='CURRENT',
        status='published',
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
        usage_cycle=${s(fd, "usage_cycle") || (packageType === "Krome" ? "PAP21" : "PAP20")},
        total_weight=${calculatedWeight},
        production_facility=${s(fd, "production_facility") || DEFAULT_PRODUCTION_FACILITY},
        dimensions=${s(fd, "dimensions")},
        net_area=${netArea},
        color_count=${s(fd, "color_count")},
        components='[]'::jsonb,
        materials=CAST(${JSON.stringify(materials)} AS jsonb),
        identity_status='Otomatik',
        technical_status=${technicalUrl ? "PDF eklendi" : "PDF yok"},
        declaration_status=${declarationUrl ? "PDF eklendi" : "PDF yok"},
        declaration_title='',
        declaration_doc_no='',
        declaration_url=${declarationUrl},
        declaration_download_url=${declarationDownloadUrl},
        declaration_filename=${declarationFilename},
        technical_title=${s(fd, "technical_title")},
        technical_doc_no=${s(fd, "technical_doc_no")},
        technical_url=${technicalUrl},
        technical_download_url=${technicalDownloadUrl},
        technical_filename=${technicalFilename},
        product_image_url=${productImageUrl},
        product_image_source='',
        product_image_access='',
        prepared_by='',
        checked_by='',
        approved_by='',
        review_date=${s(fd, "review_date")},
        published_at=NOW(),
        approved_at=COALESCE(approved_at,NOW()),
        updated_at=NOW()
      WHERE id=${dataId} AND record_id=${recordId}
    `;
  } catch (error) {
    throw error;
  }

  await sql`UPDATE ppwr_records SET updated_at=NOW() WHERE id=${recordId}`;

  const replacedOrRemoved = [
    [current.declaration_url, declarationUrl],
    [current.technical_url, technicalUrl],
    [current.product_image_url, productImageUrl],
  ].filter(([oldUrl, newUrl]) => oldUrl && oldUrl !== newUrl);

  await Promise.all(replacedOrRemoved.map(([oldUrl]) => deleteBlobQuietly(oldUrl)));
  await audit(sql, recordId, dataId, "record_saved", { published: true });
  const rec = (await sql`SELECT code FROM ppwr_records WHERE id=${recordId} LIMIT 1`)[0];
  revalidatePath(`/admin/${recordId}`);
  revalidatePath("/admin");
  if (rec?.code) revalidatePath(`/${rec.code}`);
  redirect(`/admin/${recordId}?kaydedildi=1`);
}

export async function deleteRecordAction(fd) {
  await requireAdmin();
  await ensureSchema();

  const sql = getSql();
  const recordId = s(fd, "record_id");
  const confirmation = s(fd, "confirm_delete");

  if (confirmation !== "EVET") {
    redirect(`/admin/${recordId}?hata=silme-onay`);
  }

  const record = (await sql`
    SELECT id, code FROM ppwr_records WHERE id=${recordId} LIMIT 1
  `)[0];

  if (!record) {
    redirect("/admin");
  }

  await sql`DELETE FROM ppwr_audit_log WHERE record_id=${recordId}`;
  await sql`DELETE FROM ppwr_records WHERE id=${recordId}`;

  revalidatePath("/admin");
  revalidatePath(`/${record.code}`);
  redirect("/admin?silindi=1");
}
