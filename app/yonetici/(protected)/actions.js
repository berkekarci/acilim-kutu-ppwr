"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  createRecord,
  createRevision,
  updateRevision,
  publishRevision,
  updateRecordIdentity,
} from "@/lib/db";

function text(v) { return String(v ?? "").trim(); }
function numberOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export async function createRecordAction(formData) {
  await requireAdmin();
  const publicCode = text(formData.get("public_code"));
  if (!publicCode) throw new Error("Kayıt kodu zorunludur.");
  if (/[\/?#%]/.test(publicCode)) throw new Error("Kayıt kodunda / ? # % kullanılamaz.");

  const record = await createRecord({
    publicCode,
    ppwrId: text(formData.get("ppwr_id")) || publicCode,
    declarationId: text(formData.get("declaration_id")),
    productName: text(formData.get("product_name")),
    customer: text(formData.get("customer")),
  });
  revalidatePath("/yonetici");
  redirect(`/yonetici/${record.id}`);
}

export async function createRevisionAction(formData) {
  await requireAdmin();
  const recordId = text(formData.get("record_id"));
  const revisionNo = text(formData.get("revision_no"));
  if (!recordId || !revisionNo) throw new Error("Kayıt ve revizyon numarası zorunludur.");
  const revision = await createRevision(recordId, revisionNo);
  revalidatePath(`/yonetici/${recordId}`);
  redirect(`/yonetici/${recordId}?rev=${revision.id}`);
}

export async function saveRevisionAction(formData) {
  await requireAdmin();
  const recordId = text(formData.get("record_id"));
  const revisionId = text(formData.get("revision_id"));
  if (!recordId || !revisionId) throw new Error("Kayıt bulunamadı.");

  await updateRecordIdentity(recordId, {
    publicCode: text(formData.get("public_code")),
    ppwrId: text(formData.get("ppwr_id")),
    declarationId: text(formData.get("declaration_id")),
  });

  await updateRevision(revisionId, {
    revisionNo: text(formData.get("revision_no")),
    status: text(formData.get("status")) || "draft",
    jobCode: text(formData.get("job_code")),
    customer: text(formData.get("customer")),
    customerRef: text(formData.get("customer_ref")),
    systemCode: text(formData.get("system_code")),
    importer: text(formData.get("importer")),
    productName: text(formData.get("product_name")),
    packagingClass: text(formData.get("packaging_class")),
    packagingType: text(formData.get("packaging_type")),
    intendedUse: text(formData.get("intended_use")),
    reuseType: text(formData.get("reuse_type")),
    totalWeightG: numberOrNull(formData.get("total_weight_g")),
    manufacturingSite: text(formData.get("manufacturing_site")),
    dimensions: text(formData.get("dimensions")),
    netAreaM2: numberOrNull(formData.get("net_area_m2")),
    components: parseJsonArray(formData.get("components_json")),
    materials: parseJsonArray(formData.get("materials_json")),
    identityStatus: text(formData.get("identity_status")),
    technicalStatus: text(formData.get("technical_status")),
    declarationStatus: text(formData.get("declaration_status")),
    declarationPdfUrl: text(formData.get("declaration_pdf_url")),
    technicalPdfUrl: text(formData.get("technical_pdf_url")),
    productImageUrl: text(formData.get("product_image_url")),
    preparedBy: text(formData.get("prepared_by")),
    checkedBy: text(formData.get("checked_by")),
    approvedBy: text(formData.get("approved_by")),
    reviewDate: text(formData.get("review_date")) || null,
  });

  revalidatePath(`/yonetici/${recordId}`);
  revalidatePath(`/`);
  return { ok: true };
}

export async function publishRevisionAction(formData) {
  await requireAdmin();
  const recordId = text(formData.get("record_id"));
  const revisionId = text(formData.get("revision_id"));
  await publishRevision(recordId, revisionId);
  revalidatePath(`/yonetici/${recordId}`);
  revalidatePath(`/`);
  return { ok: true };
}
