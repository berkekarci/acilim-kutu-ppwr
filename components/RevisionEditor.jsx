"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { COMPANY } from "@/lib/company";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function declarationIdFromPpwr(ppwrId) {
  return String(ppwrId || "").trim().replace(/(^|[-_.])APB(?=([-_.]|$))/i, "$1DOC");
}

function normalizePapCode(value) {
  const code = String(value || "").replace(/\s+/g, "").toUpperCase();
  return code === "PAP20" || code === "PAP21" ? code : "";
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
  return (area * EFFECTIVE_GSM).toFixed(2);
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
  }));
}

function isEFlute(value) {
  return /e\s*dalga/i.test(String(value || ""));
}

function parseDimensionsMm(value) {
  const parts = String(value || "")
    .toLowerCase()
    .replace(/mm/g, "")
    .replace(/,/g, ".")
    .split(/[x×*]/)
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part));
  return parts.length === 3 && parts.every((part) => part > 0) ? parts : null;
}

function getConsistencyCheck(dimensionsValue, areaValue, packageType, papCode) {
  if (isEFlute(packageType) && papCode === "PAP21") {
    return { type: "warn", text: "E Dalga oluklu mukavva ile PAP 21 seçimi uyumsuz görünüyor. Geri dönüşüm sınıfını kontrol edin." };
  }

  const dims = parseDimensionsMm(dimensionsValue);
  const area = parseAreaM2(areaValue);

  if (dimensionsValue && !dims) {
    return { type: "warn", text: "Ölçü formatı anlaşılmadı. En × Boy × Yükseklik şeklinde ve mm cinsinden girin. Örnek: 30x81x700." };
  }
  if (!dims || !area) return null;

  const [en, boy, yukseklik] = dims;
  if ([en, boy, yukseklik].some((v) => v < 5 || v > 3000)) {
    return { type: "warn", text: "En / boy / yükseklik değerlerinden biri olağandışı görünüyor. mm birimini kontrol edin." };
  }

  const closedSurfaceM2 = (2 * ((en * boy) + (en * yukseklik) + (boy * yukseklik))) / 1_000_000;
  const ratio = area / closedSurfaceM2;

  if (ratio < 0.9) {
    return { type: "warn", text: `Net alan (${area.toFixed(4)} m²), girilen ölçülerden hesaplanan yaklaşık kapalı yüzey alanından (${closedSurfaceM2.toFixed(4)} m²) küçük görünüyor. Ölçü veya net alanı kontrol edin.` };
  }
  if (ratio > 2.2) {
    return { type: "warn", text: `Net alan (${area.toFixed(4)} m²), girilen ölçülere göre olağandışı yüksek görünüyor. Ölçü, birim veya m² değerini kontrol edin.` };
  }

  return { type: "ok", text: `Ölçüler ile net alan birbiriyle uyumlu görünüyor. Yaklaşık geometrik yüzey: ${closedSurfaceM2.toFixed(4)} m².` };
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
  const [ppwrId, setPpwrId] = useState(revision.ppwr_id || "");
  const [papCode, setPapCode] = useState(normalizePapCode(revision.usage_cycle));
  const [packageType, setPackageType] = useState(revision.package_type || DEFAULT_PACKAGE_TYPE);
  const [netArea, setNetArea] = useState(revision.net_area || "");
  const [dimensions, setDimensions] = useState(revision.dimensions || "");
  const [manualWeight, setManualWeight] = useState(revision.total_weight || "");
  const [submitting, setSubmitting] = useState(false);
  const eFluteSelected = isEFlute(packageType);
  const calculatedWeight = eFluteSelected ? calculateEFluteWeight(netArea) : "";
  const visibleMaterials = eFluteSelected ? calculateEFluteMaterials(netArea) : materials;
  const consistencyCheck = getConsistencyCheck(dimensions, netArea, packageType, papCode);

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
      <input type="hidden" name="materials_json" value={JSON.stringify(visibleMaterials)} />
      {uploadError && <div className="errorbox">{uploadError}</div>}
      {uploadState && <div className="uploadbox">{uploadState}</div>}

      <fieldset disabled={submitting}>
        <section className="admin-panel">
          <h2>1. Kayıt ve müşteri bilgileri</h2>
          <div className="form-grid">
            <label>
              PPWR ID
              <input name="ppwr_id" value={ppwrId} onChange={(e) => setPpwrId(e.target.value)} />
            </label>
            <label>
              Declaration ID
              <input name="declaration_id" value={declarationIdFromPpwr(ppwrId)} readOnly />
            </label>
            <Input label="Açılım İş Kodu" name="job_code" defaultValue={revision.job_code} />
            <Input label="Müşteri" name="customer" defaultValue={revision.customer} />
            <Input label="Sistem Kodu" name="system_code" defaultValue={revision.system_code} />
            <Input label="Son İnceleme Tarihi" name="review_date" defaultValue={revision.review_date} placeholder="GG.AA.YYYY" />
          </div>
        </section>

        <section className="admin-panel">
          <h2>2. Ambalajın genel tanımı</h2>
          <p className="admin-hint">Ambalaj sınıfı, ambalaj tipi ve üretim tesisi standart değerlerle otomatik gelir; gerektiğinde kayıt özelinde değiştirilebilir.</p>
          <div className="form-grid">
            <Input label="Ürün / Ambalaj Adı" name="product_name" defaultValue={revision.product_name} className="span2" />
            <label>
              Ambalaj Sınıfı
              <input name="package_class" value={DEFAULT_PACKAGE_CLASS} readOnly />
            </label>
            <label>
              Ambalaj Tipi
              <select name="package_type" value={packageType} onChange={(e) => setPackageType(e.target.value)}>
                <option value="Kağıt / Karton Ambalaj">Kağıt / Karton Ambalaj</option>
                <option value="E Dalga Sıvamalı">E Dalga Sıvamalı</option>
              </select>
            </label>
            <label className="pap-select-field">
              Geri Dönüşüm Sınıfı
              <select name="usage_cycle" value={papCode} onChange={(e) => setPapCode(e.target.value)}>
                <option value="">Seçiniz</option>
                <option value="PAP20">♻ PAP 20</option>
                <option value="PAP21">♻ PAP 21</option>
              </select>
              <span className="pap-preview">
                <span className="pap-logo">♻</span>
                <strong>{papCode ? papCode.replace("PAP", "PAP ") : "PAP"}</strong>
              </span>
            </label>
            <label>
              Toplam Ağırlık
              <input
                name="total_weight"
                value={eFluteSelected ? (calculatedWeight ? `${calculatedWeight} g` : "") : manualWeight}
                onChange={(e) => setManualWeight(e.target.value)}
                readOnly={eFluteSelected}
                placeholder={eFluteSelected ? "Net alan girildiğinde otomatik hesaplanır" : "Ağırlığı girin"}
              />
              <span className="admin-hint">{eFluteSelected ? "Ağırlık hesabı otomatik seçildi: E Dalga — 424,5 g/m²." : "E Dalga seçildiğinde ağırlık hesabı otomatikleşir."}</span>
            </label>
            <Input label="Üretim Tesisi" name="production_facility" defaultValue={revision.production_facility || DEFAULT_PRODUCTION_FACILITY} />
            <label>
              En × Boy × Yükseklik (mm)
              <input name="dimensions" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="Örn. 30x81x700" />
            </label>
            <label>
              Net Alan
              <input name="net_area" value={netArea} onChange={(e) => setNetArea(e.target.value)} placeholder="Örn. 0,1763 m²" />
              <span className="admin-hint">{eFluteSelected ? "Net alan değiştikçe toplam ağırlık ve malzeme bileşimi anında yeniden hesaplanır." : "Otomatik hesaplama için Ambalaj Tipi olarak E Dalga Sıvamalı seçin."}</span>
            </label>
            {consistencyCheck && (
              <div className={`consistency-check ${consistencyCheck.type} span2`}>
                <strong>{consistencyCheck.type === "ok" ? "✓ Uyum kontrolü" : "⚠ Kontrol gerekli"}</strong>
                <span>{consistencyCheck.text}</span>
              </div>
            )}
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
            <div>
              <h2>4. Malzeme bileşimi</h2>
              {eFluteSelected && <p className="admin-hint">E Dalga seçildiği için reçete otomatik oluşturuldu. Net alan değiştikçe ağırlıklar senkronize güncellenir.</p>}
            </div>
            {!eFluteSelected && <button type="button" className="admin-secondary" onClick={() => setMaterials([...materials, { name: "", weight: "", ratio: "" }])}>+ Malzeme</button>}
          </div>
          {visibleMaterials.length === 0 && <p className="admin-hint">Henüz malzeme satırı eklenmedi.</p>}
          {visibleMaterials.map((material, i) => (
            <div className="array-row materials-edit" key={i}>
              <input placeholder="Malzeme" value={material.name || ""} readOnly={eFluteSelected} onChange={(e) => updateM(i, "name", e.target.value)} />
              <input placeholder="Ağırlık" value={material.weight || ""} readOnly={eFluteSelected} onChange={(e) => updateM(i, "weight", e.target.value)} />
              <input placeholder="Oran" value={material.ratio || ""} readOnly={eFluteSelected} onChange={(e) => updateM(i, "ratio", e.target.value)} />
              {!eFluteSelected && <button type="button" aria-label="Malzemeyi sil" className="remove" onClick={() => setMaterials(materials.filter((_, n) => n !== i))}>×</button>}
            </div>
          ))}
        </section>

        <section className="admin-panel">
          <h2>5. Belge ve görsel dosyaları</h2>
          <p className="admin-hint">Dosyalar tarayıcıdan doğrudan Vercel Blob'a yüklenir. PDF ve görseller için dosya başına üst sınır 50 MB'dır.</p>
          <div className="form-grid">
            <label>AB Uygunluk Beyanı PDF <span className="optional-mark">İsteğe bağlı</span><input type="file" name="declaration_file" accept="application/pdf" /></label>
            <div className="existing-file">{revision.declaration_url ? <a href={revision.declaration_url} target="_blank" rel="noreferrer">{revision.declaration_filename || "Mevcut PDF'yi aç"}</a> : "Dosya yüklenmedi"}</div>

            <Input label="Teknik Dosya Başlığı" name="technical_title" defaultValue={revision.technical_title} />
            <Input label="Teknik Dosya No" name="technical_doc_no" defaultValue={revision.technical_doc_no} />
            <label>Teknik Dosya PDF<input type="file" name="technical_file" accept="application/pdf" /></label>
            <div className="existing-file">{revision.technical_url ? <a href={revision.technical_url} target="_blank" rel="noreferrer">{revision.technical_filename || "Mevcut PDF'yi aç"}</a> : "Dosya yüklenmedi"}</div>

            <label>Ürün / CAD Görseli<input type="file" name="product_image" accept="image/*" /></label>
            <div className="existing-file">{revision.product_image_url ? <a href={revision.product_image_url} target="_blank" rel="noreferrer">Mevcut görseli aç</a> : "Görsel yüklenmedi"}</div>
          </div>
        </section>

        <section className="admin-panel">
          <h2>6. Otomatik kayıt özeti</h2>
          <p className="admin-hint">Bu bölüm sistem tarafından otomatik takip edilir; ayrıca doldurmanız gerekmez.</p>
          <div className="auto-status-grid">
            <div className="auto-status"><span>Ambalaj kimliği</span><strong>{ppwrId && revision.product_name ? "Hazır" : "Temel bilgiler bekleniyor"}</strong></div>
            <div className="auto-status"><span>AB Uygunluk Beyanı</span><strong>{revision.declaration_url ? "PDF eklendi" : "İsteğe bağlı"}</strong></div>
            <div className="auto-status"><span>Teknik dosya</span><strong>{revision.technical_url ? "PDF eklendi" : "İsteğe bağlı"}</strong></div>
          </div>
        </section>

        <div className="sticky-save">
          <button className="admin-primary" type="submit">{submitting ? "Kaydediliyor ve yayınlanıyor…" : "Kaydet ve Yayınla"}</button>
        </div>
      </fieldset>
    </form>
  );
}
