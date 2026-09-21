"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function Input({ label, name, defaultValue, type = "text", className = "", placeholder = "" }) {
  return (
    <label className={className}>
      {label}
      <input name={name} type={type} defaultValue={defaultValue || ""} placeholder={placeholder} />
    </label>
  );
}

function safeFilename(value) {
  return String(value || "file").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 150);
}

export default function RevisionEditor({ revision, recordId, action }) {
  const [components, setComponents] = useState(safeArray(revision.components));
  const [materials, setMaterials] = useState(safeArray(revision.materials));
  const [uploadState, setUploadState] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const locked = revision.status === "published" || revision.status === "archived";

  const updateC = (i, key, value) => setComponents((items) => items.map((item, n) => (n === i ? { ...item, [key]: value } : item)));
  const updateM = (i, key, value) => setMaterials((items) => items.map((item, n) => (n === i ? { ...item, [key]: value } : item)));

  async function uploadFormFile(formData, { fileField, urlField, filenameField, kind, label, type }) {
    const file = formData.get(fileField);
    formData.delete(fileField);
    if (!(file instanceof File) || file.size === 0) return;
    if (file.size > 50 * 1024 * 1024) throw new Error(`${label} 50 MB sınırını aşıyor.`);
    if (type === "pdf" && file.type !== "application/pdf") throw new Error(`${label} yalnızca PDF olabilir.`);
    if (type === "image" && !file.type.startsWith("image/")) throw new Error(`${label} geçerli bir görsel olmalıdır.`);

    setUploadState(`${label} yükleniyor…`);
    const blob = await upload(
      `ppwr/${recordId}/${revision.id}/${kind}/${safeFilename(file.name)}`,
      file,
      {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        multipart: file.size > 4 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setUploadState(`${label} yükleniyor… %${Math.round(percentage)}`),
      }
    );
    formData.set(urlField, blob.url);
    if (type === "pdf") {
      const downloadField = urlField.replace("_url_input", "_download_url_input");
      formData.set(downloadField, blob.downloadUrl || blob.url);
    }
    formData.set(filenameField, file.name);
  }

  async function submitWithUploads(formData) {
    setSubmitting(true);
    setUploadError("");
    try {
      await uploadFormFile(formData, {
        fileField: "declaration_file",
        urlField: "declaration_url_input",
        filenameField: "declaration_filename_input",
        kind: "declaration",
        label: "AB Uygunluk Beyanı",
        type: "pdf",
      });
      await uploadFormFile(formData, {
        fileField: "technical_file",
        urlField: "technical_url_input",
        filenameField: "technical_filename_input",
        kind: "technical",
        label: "Teknik Dosya",
        type: "pdf",
      });
      await uploadFormFile(formData, {
        fileField: "product_image",
        urlField: "product_image_url_input",
        filenameField: "product_image_filename_input",
        kind: "image",
        label: "Ürün / CAD görseli",
        type: "image",
      });
      setUploadState("Kayıt verileri kaydediliyor…");
    } catch (error) {
      setSubmitting(false);
      setUploadState("");
      setUploadError(error?.message || "Dosya yükleme sırasında hata oluştu.");
      return;
    }
    return action(formData);
  }

  return (
    <form action={submitWithUploads} className="revision-form">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="revision_id" value={revision.id} />
      <input type="hidden" name="components_json" value={JSON.stringify(components)} />
      <input type="hidden" name="materials_json" value={JSON.stringify(materials)} />

      {locked && (
        <div className="notice">
          <strong>REVİZYON KİLİTLİ:</strong> Yayınlanmış veya arşivlenmiş revizyon doğrudan değiştirilmez. Değişiklik için yeni revizyon oluşturun.
        </div>
      )}
      {uploadError && <div className="errorbox">{uploadError}</div>}
      {uploadState && <div className="uploadbox">{uploadState}</div>}

      <fieldset disabled={locked || submitting}>
        <section className="admin-panel">
          <h2>1. Kayıt ve müşteri bilgileri</h2>
          <div className="form-grid">
            <Input label="Revizyon" name="revision_label" defaultValue={revision.revision_label} placeholder="Rev.00" />
            <label>
              Çalışma Durumu
              <select name="status" defaultValue={revision.status}>
                <option value="draft">Taslak</option>
                <option value="review">İncelemede</option>
                <option value="cancelled">İptal</option>
              </select>
            </label>
            <Input label="PPWR ID" name="ppwr_id" defaultValue={revision.ppwr_id} />
            <Input label="Declaration ID" name="declaration_id" defaultValue={revision.declaration_id} />
            <Input label="Açılım İş Kodu" name="job_code" defaultValue={revision.job_code} />
            <Input label="Müşteri" name="customer" defaultValue={revision.customer} />
            <Input label="Müşteri Referansı" name="customer_ref" defaultValue={revision.customer_ref} />
            <Input label="Sistem Kodu" name="system_code" defaultValue={revision.system_code} />
            <Input label="İthalatçı" name="importer" defaultValue={revision.importer} />
            <Input label="Son İnceleme Tarihi" name="review_date" defaultValue={revision.review_date} placeholder="GG.AA.YYYY" />
          </div>
        </section>

        <section className="admin-panel">
          <h2>2. Ambalajın genel tanımı</h2>
          <div className="form-grid">
            <Input label="Ürün / Ambalaj Adı" name="product_name" defaultValue={revision.product_name} className="span2" />
            <Input label="Ambalaj Sınıfı" name="package_class" defaultValue={revision.package_class} />
            <Input label="Ambalaj Tipi" name="package_type" defaultValue={revision.package_type} />
            <Input label="Kullanım Amacı" name="usage_purpose" defaultValue={revision.usage_purpose} />
            <Input label="Tek / Çok Kullanımlık" name="usage_cycle" defaultValue={revision.usage_cycle} />
            <Input label="Toplam Ağırlık" name="total_weight" defaultValue={revision.total_weight} />
            <Input label="Üretim Tesisi" name="production_facility" defaultValue={revision.production_facility} />
            <Input label="Ölçüler" name="dimensions" defaultValue={revision.dimensions} />
            <Input label="Net Alan" name="net_area" defaultValue={revision.net_area} />
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-title-row">
            <h2>3. Ambalaj komponentleri</h2>
            <button type="button" className="admin-secondary" onClick={() => setComponents([...components, { name: "", material: "", details: "", weight: "" }])}>+ Komponent</button>
          </div>
          {components.length === 0 && <p className="admin-hint">Henüz komponent eklenmedi.</p>}
          {components.map((component, i) => (
            <div className="array-row" key={i}>
              <input placeholder="Komponent" value={component.name || ""} onChange={(e) => updateC(i, "name", e.target.value)} />
              <input placeholder="Malzeme" value={component.material || ""} onChange={(e) => updateC(i, "material", e.target.value)} />
              <input placeholder="Ölçü / gramaj / açıklama" value={component.details || ""} onChange={(e) => updateC(i, "details", e.target.value)} />
              <input placeholder="Ağırlık" value={component.weight || ""} onChange={(e) => updateC(i, "weight", e.target.value)} />
              <button type="button" aria-label="Komponenti sil" className="remove" onClick={() => setComponents(components.filter((_, n) => n !== i))}>×</button>
            </div>
          ))}
        </section>

        <section className="admin-panel">
          <div className="panel-title-row">
            <h2>4. Malzeme bileşimi</h2>
            <button type="button" className="admin-secondary" onClick={() => setMaterials([...materials, { name: "", weight: "", ratio: "", evidence: "" }])}>+ Malzeme</button>
          </div>
          {materials.length === 0 && <p className="admin-hint">Henüz malzeme satırı eklenmedi.</p>}
          {materials.map((material, i) => (
            <div className="array-row materials-edit" key={i}>
              <input placeholder="Malzeme" value={material.name || ""} onChange={(e) => updateM(i, "name", e.target.value)} />
              <input placeholder="Ağırlık" value={material.weight || ""} onChange={(e) => updateM(i, "weight", e.target.value)} />
              <input placeholder="Oran" value={material.ratio || ""} onChange={(e) => updateM(i, "ratio", e.target.value)} />
              <input placeholder="Kanıt / kaynak" value={material.evidence || ""} onChange={(e) => updateM(i, "evidence", e.target.value)} />
              <button type="button" aria-label="Malzemeyi sil" className="remove" onClick={() => setMaterials(materials.filter((_, n) => n !== i))}>×</button>
            </div>
          ))}
        </section>

        <section className="admin-panel">
          <h2>5. Belge ve görsel dosyaları</h2>
          <p className="admin-hint">Dosyalar tarayıcıdan doğrudan Vercel Blob'a yüklenir. PDF ve görseller için dosya başına üst sınır 50 MB'dır.</p>
          <div className="form-grid">
            <Input label="AB Uygunluk Beyanı Başlığı" name="declaration_title" defaultValue={revision.declaration_title} />
            <Input label="AB Uygunluk Beyanı No" name="declaration_doc_no" defaultValue={revision.declaration_doc_no} />
            <label>AB Uygunluk Beyanı PDF<input type="file" name="declaration_file" accept="application/pdf" /></label>
            <div className="existing-file">{revision.declaration_url ? <a href={revision.declaration_url} target="_blank" rel="noreferrer">{revision.declaration_filename || "Mevcut PDF'yi aç"}</a> : "Dosya yüklenmedi"}</div>

            <Input label="Teknik Dosya Başlığı" name="technical_title" defaultValue={revision.technical_title} />
            <Input label="Teknik Dosya No" name="technical_doc_no" defaultValue={revision.technical_doc_no} />
            <label>Teknik Dosya PDF<input type="file" name="technical_file" accept="application/pdf" /></label>
            <div className="existing-file">{revision.technical_url ? <a href={revision.technical_url} target="_blank" rel="noreferrer">{revision.technical_filename || "Mevcut PDF'yi aç"}</a> : "Dosya yüklenmedi"}</div>

            <label>Ürün / CAD Görseli<input type="file" name="product_image" accept="image/*" /></label>
            <div className="existing-file">{revision.product_image_url ? <a href={revision.product_image_url} target="_blank" rel="noreferrer">Mevcut görseli aç</a> : "Görsel yüklenmedi"}</div>
            <Input label="Görsel Kaynağı" name="product_image_source" defaultValue={revision.product_image_source} />
            <Input label="Görsel Erişim" name="product_image_access" defaultValue={revision.product_image_access} />
          </div>
        </section>

        <section className="admin-panel">
          <h2>6. Durum ve onay</h2>
          <div className="form-grid">
            <Input label="Ambalaj Kimliği Durumu" name="identity_status" defaultValue={revision.identity_status} />
            <Input label="Teknik Dokümantasyon Durumu" name="technical_status" defaultValue={revision.technical_status} />
            <Input label="Uygunluk Beyanı Durumu" name="declaration_status" defaultValue={revision.declaration_status} />
            <Input label="Hazırlayan" name="prepared_by" defaultValue={revision.prepared_by} />
            <Input label="Kontrol Eden" name="checked_by" defaultValue={revision.checked_by} />
            <Input label="Onaylayan" name="approved_by" defaultValue={revision.approved_by} />
          </div>
        </section>

        <div className="sticky-save">
          <button className="admin-primary" type="submit">{submitting ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}</button>
        </div>
      </fieldset>
    </form>
  );
}
