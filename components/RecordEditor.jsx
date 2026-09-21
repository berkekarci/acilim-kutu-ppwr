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
    { name: "Liner 90 g/m² (2)", gsm: 90 },
    { name: "B Fluting 90 g/m² × 1,35", gsm: 90 * B_FLUTE_TAKE_UP },
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
  return (area * effectiveGsm(packageType)).toFixed(2);
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

function isCorrugated(value) {
  return ["E Dalga", "B Dalga", "EB Dalga"].includes(normalizePackageType(value));
}

function expectedPapCode(packageType) {
  return normalizePackageType(packageType) === "Krome" ? "PAP21" : "PAP20";
}

function formatEffectiveGsm(packageType) {
  return effectiveGsm(packageType).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
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
  const expectedPap = expectedPapCode(packageType);
  if (papCode && papCode !== expectedPap) {
    return { type: "warn", text: `${normalizePackageType(packageType)} için geri dönüşüm sınıfı ${expectedPap.replace("PAP", "PAP ")} olmalıdır. Seçimi kontrol edin.` };
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

export default function RecordEditor({ recordData, recordId, action }) {
  const [components, setComponents] = useState(safeArray(recordData.components));
  const [uploadState, setUploadState] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [ppwrId, setPpwrId] = useState(recordData.ppwr_id || "");
  const initialPackageType = normalizePackageType(recordData.package_type);
  const [packageType, setPackageType] = useState(initialPackageType);
  const [papCode, setPapCode] = useState(normalizePapCode(recordData.usage_cycle) || expectedPapCode(initialPackageType));
  const [netArea, setNetArea] = useState(recordData.net_area || "");
  const [dimensions, setDimensions] = useState(recordData.dimensions || "");
  const [submitting, setSubmitting] = useState(false);
  const calculatedWeight = calculatePackageWeight(netArea, packageType);
  const visibleMaterials = calculatePackageMaterials(netArea, packageType);
  const consistencyCheck = getConsistencyCheck(dimensions, netArea, packageType, papCode);

  const updateC = (i, key, value) => setComponents((items) => items.map((item, n) => (n === i ? { ...item, [key]: value } : item)));

  async function uploadFormFile(formData, { fileField, urlField, filenameField, kind, label, type }) {
    const file = formData.get(fileField);
    formData.delete(fileField);
    if (!(file instanceof File) || file.size === 0) return;
    if (file.size > 50 * 1024 * 1024) throw new Error(`${label} 50 MB sınırını aşıyor.`);
    if (type === "pdf" && file.type !== "application/pdf") throw new Error(`${label} yalnızca PDF olabilir.`);
    if (type === "image" && !file.type.startsWith("image/")) throw new Error(`${label} geçerli bir görsel olmalıdır.`);

    setUploadState(`${label} yükleniyor…`);
    const blob = await upload(
      `ppwr/${recordId}/${recordData.id}/${kind}/${safeFilename(file.name)}`,
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
      const message = error?.message || "Dosya yükleme sırasında hata oluştu.";
      setUploadError(
        message.includes("Failed to retrieve the client token")
          ? "Vercel Blob yükleme yetkisi alınamadı. Sunucuda BLOB_READ_WRITE_TOKEN eksik veya yanlış Blob store'a ait olabilir."
          : message
      );
      return;
    }
    return action(formData);
  }

  return (
    <form action={submitWithUploads} className="record-form">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="data_id" value={recordData.id} />
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
            <Input label="Açılım İş Kodu" name="job_code" defaultValue={recordData.job_code} />
            <Input label="Müşteri" name="customer" defaultValue={recordData.customer} />
            <Input label="Sistem Kodu" name="system_code" defaultValue={recordData.system_code} />
            <Input label="Son İnceleme Tarihi" name="review_date" defaultValue={recordData.review_date} placeholder="GG.AA.YYYY" />
          </div>
        </section>

        <section className="admin-panel">
          <h2>2. Ambalajın genel tanımı</h2>
          <p className="admin-hint">Ambalaj sınıfı, ambalaj tipi ve üretim tesisi standart değerlerle otomatik gelir; gerektiğinde kayıt özelinde değiştirilebilir.</p>
          <div className="form-grid">
            <Input label="Ürün / Ambalaj Adı" name="product_name" defaultValue={recordData.product_name} className="span2" />
            <label>
              Ambalaj Sınıfı
              <input name="package_class" value={DEFAULT_PACKAGE_CLASS} readOnly />
            </label>
            <label>
              Ambalaj Tipi
              <select
                name="package_type"
                value={packageType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setPackageType(nextType);
                  setPapCode(expectedPapCode(nextType));
                }}
              >
                <option value="Krome">Krome</option>
                <option value="E Dalga">E Dalga</option>
                <option value="B Dalga">B Dalga</option>
                <option value="EB Dalga">EB Dalga</option>
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
                value={calculatedWeight ? `${calculatedWeight} g` : ""}
                readOnly
                placeholder="Net alan girildiğinde otomatik hesaplanır"
              />
              <span className="admin-hint">Otomatik reçete: {packageType} — {formatEffectiveGsm(packageType)} g/m².</span>
            </label>
            <Input label="Üretim Tesisi" name="production_facility" defaultValue={recordData.production_facility || DEFAULT_PRODUCTION_FACILITY} />
            <label>
              En × Boy × Yükseklik (mm)
              <input name="dimensions" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="Örn. 30x81x700" />
            </label>
            <label>
              Net Alan
              <input name="net_area" value={netArea} onChange={(e) => setNetArea(e.target.value)} placeholder="Örn. 0,1763 m²" />
              <span className="admin-hint">Net alan değiştikçe toplam ağırlık, malzeme ağırlıkları ve yüzdelik oranlar anında yeniden hesaplanır.</span>
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
              <p className="admin-hint">{packageType} reçetesi otomatik oluşturuldu. Net alan değiştikçe ağırlıklar ve yüzdelik oranlar senkronize güncellenir.</p>
            </div>

          </div>
          {visibleMaterials.length === 0 && <p className="admin-hint">Henüz malzeme satırı eklenmedi.</p>}
          {visibleMaterials.map((material, i) => (
            <div className="array-row materials-edit" key={i}>
              <input placeholder="Malzeme" value={material.name || ""} readOnly />
              <input placeholder="Ağırlık" value={material.weight || ""} readOnly />
              <input placeholder="Oran" value={material.ratio || ""} readOnly />
            </div>
          ))}
        </section>

        <section className="admin-panel">
          <h2>5. Belge ve görsel dosyaları</h2>
          <p className="admin-hint">Dosyalar tarayıcıdan doğrudan Vercel Blob'a yüklenir. PDF ve görseller için dosya başına üst sınır 50 MB'dır.</p>
          <div className="form-grid">
            <label>AB Uygunluk Beyanı PDF <span className="optional-mark">İsteğe bağlı</span><input type="file" name="declaration_file" accept="application/pdf" /></label>
            <div className="existing-file">{recordData.declaration_url ? <a href={recordData.declaration_url} target="_blank" rel="noreferrer">{recordData.declaration_filename || "Mevcut PDF'yi aç"}</a> : "Dosya yüklenmedi"}</div>

            <Input label="Teknik Dosya Başlığı" name="technical_title" defaultValue={recordData.technical_title} />
            <Input label="Teknik Dosya No" name="technical_doc_no" defaultValue={recordData.technical_doc_no} />
            <label>Teknik Dosya PDF<input type="file" name="technical_file" accept="application/pdf" /></label>
            <div className="existing-file">{recordData.technical_url ? <a href={recordData.technical_url} target="_blank" rel="noreferrer">{recordData.technical_filename || "Mevcut PDF'yi aç"}</a> : "Dosya yüklenmedi"}</div>

            <label>Ürün / CAD Görseli<input type="file" name="product_image" accept="image/*" /></label>
            <div className="existing-file">{recordData.product_image_url ? <a href={recordData.product_image_url} target="_blank" rel="noreferrer">Mevcut görseli aç</a> : "Görsel yüklenmedi"}</div>
          </div>
        </section>

        <section className="admin-panel">
          <h2>6. Otomatik kayıt özeti</h2>
          <p className="admin-hint">Bu bölüm sistem tarafından otomatik takip edilir; ayrıca doldurmanız gerekmez.</p>
          <div className="auto-status-grid">
            <div className="auto-status"><span>Ambalaj kimliği</span><strong>{ppwrId && recordData.product_name ? "Hazır" : "Temel bilgiler bekleniyor"}</strong></div>
            <div className="auto-status"><span>AB Uygunluk Beyanı</span><strong>{recordData.declaration_url ? "PDF eklendi" : "İsteğe bağlı"}</strong></div>
            <div className="auto-status"><span>Teknik dosya</span><strong>{recordData.technical_url ? "PDF eklendi" : "İsteğe bağlı"}</strong></div>
          </div>
        </section>

        <div className="sticky-save">
          <button className="admin-primary" type="submit">{submitting ? "Kaydediliyor ve yayınlanıyor…" : "Kaydet ve Yayınla"}</button>
        </div>
      </fieldset>
    </form>
  );
}
