"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { COMPANY } from "@/lib/company";
import { automaticArticle5Filename, automaticPdfFilename, hasArticle5Document, hasDeclarationPdf, hasTechnicalPdf } from "@/lib/document-settings";

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
    { name: "Tutkal 12 g/m² × 2 katman", gsm: 24 },
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

export default function RecordEditor({ recordData, recordId, publicCode, action }) {
  const [uploadState, setUploadState] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [ppwrId, setPpwrId] = useState(recordData.ppwr_id || "");
  const initialPackageType = normalizePackageType(recordData.package_type);
  const [packageType, setPackageType] = useState(initialPackageType);
  const [papCode, setPapCode] = useState(normalizePapCode(recordData.usage_cycle) || expectedPapCode(initialPackageType));
  const [netArea, setNetArea] = useState(recordData.net_area || "");
  const [dimensions, setDimensions] = useState(recordData.dimensions || "");
  const [submitting, setSubmitting] = useState(false);
  const [technicalAuto, setTechnicalAuto] = useState(Boolean(recordData.technical_auto));
  const [declarationAuto, setDeclarationAuto] = useState(Boolean(recordData.declaration_auto));
  const [article5Auto, setArticle5Auto] = useState(Boolean(recordData.article5_auto));
  const [removedFiles, setRemovedFiles] = useState({
    declaration: false,
    technical: false,
    article5: false,
    productImage: false,
    stampImage: false,
    signatureImage: false,
  });
  const [selectedFiles, setSelectedFiles] = useState({
    declaration: "",
    technical: "",
    article5: "",
    productImage: "",
    stampImage: "",
    signatureImage: "",
  });
  const declarationFileRef = useRef(null);
  const technicalFileRef = useRef(null);
  const article5FileRef = useRef(null);
  const productImageFileRef = useRef(null);
  const stampImageFileRef = useRef(null);
  const signatureImageFileRef = useRef(null);
  const calculatedWeight = calculatePackageWeight(netArea, packageType);
  const visibleMaterials = calculatePackageMaterials(netArea, packageType);
  const consistencyCheck = getConsistencyCheck(dimensions, netArea, packageType, papCode);


  async function uploadFormFile(formData, { fileField, urlField, filenameField, removeField, kind, label, type }) {
    let file = formData.get(fileField);
    formData.delete(fileField);
    if (!(file instanceof File) || file.size === 0) return;
    if (file.size > 50 * 1024 * 1024) throw new Error(`${label} 50 MB sınırını aşıyor.`);
    if (type === "pdf" && file.type !== "application/pdf") throw new Error(`${label} yalnızca PDF olabilir.`);
    if (type === "word") {
      const extension = file.name.toLowerCase().split(".").pop();
      const allowedTypes = [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!(["doc", "docx"].includes(extension) && (allowedTypes.includes(file.type) || !file.type || file.type === "application/octet-stream"))) {
        throw new Error(`${label} yalnızca DOC veya DOCX olabilir.`);
      }
      const expectedType = extension === "docx" ? allowedTypes[1] : allowedTypes[0];
      if (file.type !== expectedType) file = new File([file], file.name, { type: expectedType });
    }
    if ((type === "image" || type === "pdf-image") && !file.type.startsWith("image/")) throw new Error(`${label} geçerli bir görsel olmalıdır.`);
    if (type === "pdf-image" && !["image/png", "image/jpeg"].includes(file.type)) {
      throw new Error(`${label} için PNG veya JPG/JPEG kullanın.`);
    }

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
    if (removeField) formData.set(removeField, "");
    if (type === "pdf" || type === "word") {
      const downloadField = urlField.replace("_url_input", "_download_url_input");
      formData.set(downloadField, blob.downloadUrl || blob.url);
    }
    formData.set(filenameField, file.name);
  }

  async function submitWithUploads(formData) {
    setSubmitting(true);
    setUploadError("");
    const generateAll = ["generate_pdfs", "generate_documents"].includes(String(formData.get("save_intent") || ""));
    if (generateAll) { setTechnicalAuto(true); setDeclarationAuto(true); setArticle5Auto(true); }
    const useTechnicalAuto = generateAll || technicalAuto;
    const useDeclarationAuto = generateAll || declarationAuto;
    const useArticle5Auto = generateAll || article5Auto;
    formData.set("technical_auto", useTechnicalAuto ? "1" : "0");
    formData.set("declaration_auto", useDeclarationAuto ? "1" : "0");
    formData.set("article5_auto", useArticle5Auto ? "1" : "0");
    try {
      if (useDeclarationAuto) formData.delete("declaration_file");
      else await uploadFormFile(formData, {
        fileField: "declaration_file",
        urlField: "declaration_url_input",
        filenameField: "declaration_filename_input",
        removeField: "declaration_remove",
        kind: "declaration",
        label: "AB Uygunluk Beyanı",
        type: "pdf",
      });
      if (useTechnicalAuto) formData.delete("technical_file");
      else await uploadFormFile(formData, {
        fileField: "technical_file",
        urlField: "technical_url_input",
        filenameField: "technical_filename_input",
        removeField: "technical_remove",
        kind: "technical",
        label: "Teknik Dosya",
        type: "pdf",
      });
      if (useArticle5Auto) formData.delete("article5_file");
      else await uploadFormFile(formData, {
        fileField: "article5_file",
        urlField: "article5_url_input",
        filenameField: "article5_filename_input",
        removeField: "article5_remove",
        kind: "article5",
        label: "Art.5 PPWR Uygunluk Beyanı",
        type: "word",
      });
      await uploadFormFile(formData, {
        fileField: "product_image",
        urlField: "product_image_url_input",
        filenameField: "product_image_filename_input",
        removeField: "product_image_remove",
        kind: "image",
        label: "Ürün / CAD görseli",
        type: "image",
      });
      await uploadFormFile(formData, {
        fileField: "stamp_image",
        urlField: "stamp_image_url_input",
        filenameField: "stamp_image_filename_input",
        removeField: "stamp_image_remove",
        kind: "stamp",
        label: "Firma kaşesi",
        type: "pdf-image",
      });
      await uploadFormFile(formData, {
        fileField: "signature_image",
        urlField: "signature_image_url_input",
        filenameField: "signature_image_filename_input",
        removeField: "signature_image_remove",
        kind: "signature",
        label: "İmza görseli",
        type: "pdf-image",
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
    const result = await action(formData);
    if (result?.error) {
      setSubmitting(false);
      setUploadState("");
      setUploadError(result.error);
    }
    return result;
  }

  return (
    <form action={submitWithUploads} className="record-form">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="data_id" value={recordData.id} />
      <input type="hidden" name="materials_json" value={JSON.stringify(visibleMaterials)} />
      <input type="hidden" name="declaration_remove" value={removedFiles.declaration ? "1" : ""} />
      <input type="hidden" name="technical_remove" value={removedFiles.technical ? "1" : ""} />
      <input type="hidden" name="article5_remove" value={removedFiles.article5 ? "1" : ""} />
      <input type="hidden" name="product_image_remove" value={removedFiles.productImage ? "1" : ""} />
      <input type="hidden" name="stamp_image_remove" value={removedFiles.stampImage ? "1" : ""} />
      <input type="hidden" name="signature_image_remove" value={removedFiles.signatureImage ? "1" : ""} />
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
            <label>
              Renk Sayısı
              <input name="color_count" type="number" min="0" step="1" defaultValue={recordData.color_count || ""} placeholder="Örn. 4" />
              <span className="admin-hint">Ambalaj üzerindeki baskı renk sayısını girin. Baskısız ise 0 yazabilirsiniz.</span>
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
            <div>
              <h2>3. Malzeme bileşimi</h2>
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
          <h2>4. Belge ve görsel dosyaları</h2>
          <div className="pdf-automation">
            <h3>Otomatik belge oluşturma</h3>
            <p className="admin-hint">İki PDF panel verilerinden üretilir. Art.5 Word belgesinde ise verdiğiniz sabit şablon korunur; yalnızca iki PPWR ID alanı ve Beyan Düzenleme Tarihi otomatik değiştirilir.</p>
            <div className="form-grid">
              <label>Ambalaj Kimlik ve Teknik Bilgi Belgesi
                <select value={technicalAuto ? "auto" : "upload"} onChange={(e) => setTechnicalAuto(e.target.value === "auto")}>
                  <option value="upload">Yüklediğim PDF'yi kullan</option>
                  <option value="auto">Panel bilgilerinden otomatik oluştur</option>
                </select>
              </label>
              <label>AB Uygunluk Beyanı
                <select value={declarationAuto ? "auto" : "upload"} onChange={(e) => setDeclarationAuto(e.target.value === "auto")}>
                  <option value="upload">Yüklediğim PDF'yi kullan</option>
                  <option value="auto">Panel bilgilerinden otomatik oluştur</option>
                </select>
              </label>
              <label>Art.5 PPWR Uygunluk Beyanı
                <select value={article5Auto ? "auto" : "upload"} onChange={(e) => setArticle5Auto(e.target.value === "auto")}>
                  <option value="upload">Yüklediğim DOC/DOCX'i kullan</option>
                  <option value="auto">Şablondan otomatik Word oluştur</option>
                </select>
              </label>
              <Input label="Beyan Düzenleme Tarihi" name="document_issue_date" defaultValue={recordData.document_issue_date || recordData.review_date} placeholder="GG.AA.YYYY" />
              <Input label="Beyanı İmzalayacak Kişi" name="signatory_name" defaultValue={recordData.signatory_name} />
              <Input label="İmzalayanın Görevi / Unvanı" name="signatory_title" defaultValue={recordData.signatory_title} />
              <label>Firma Kaşesi Görseli
                <input ref={stampImageFileRef} type="file" name="stamp_image" accept="image/png,image/jpeg" onChange={(e) => {
                  const file = e.target.files?.[0];
                  setSelectedFiles((v) => ({ ...v, stampImage: file?.name || "" }));
                  if (file) setRemovedFiles((v) => ({ ...v, stampImage: false }));
                }} />
              </label>
              <div className="existing-file">
                {selectedFiles.stampImage ? (
                  <div className="existing-file-row selected-file-row">
                    <span>{selectedFiles.stampImage}</span>
                    <button type="button" className="file-remove-btn" title="Seçilen kaşeyi kaldır" aria-label="Seçilen firma kaşesi görselini kaldır" onClick={() => {
                      if (stampImageFileRef.current) stampImageFileRef.current.value = "";
                      setSelectedFiles((v) => ({ ...v, stampImage: "" }));
                    }}>×</button>
                  </div>
                ) : recordData.stamp_image_url && !removedFiles.stampImage ? (
                  <div className="existing-file-row">
                    <a href={recordData.stamp_image_url} target="_blank" rel="noreferrer">{recordData.stamp_image_filename || "Mevcut kaşeyi aç"}</a>
                    <button type="button" className="file-remove-btn" title="Kaşeyi kaldır" aria-label="Firma kaşesi görselini kaldır" onClick={() => setRemovedFiles((v) => ({ ...v, stampImage: true }))}>×</button>
                  </div>
                ) : removedFiles.stampImage ? <span className="file-remove-pending">Kaşe kaldırılacak.</span> : "Kaşe yüklenmedi"}
              </div>
              <label>İmza Görseli
                <input ref={signatureImageFileRef} type="file" name="signature_image" accept="image/png,image/jpeg" onChange={(e) => {
                  const file = e.target.files?.[0];
                  setSelectedFiles((v) => ({ ...v, signatureImage: file?.name || "" }));
                  if (file) setRemovedFiles((v) => ({ ...v, signatureImage: false }));
                }} />
              </label>
              <div className="existing-file">
                {selectedFiles.signatureImage ? (
                  <div className="existing-file-row selected-file-row">
                    <span>{selectedFiles.signatureImage}</span>
                    <button type="button" className="file-remove-btn" title="Seçilen imzayı kaldır" aria-label="Seçilen imza görselini kaldır" onClick={() => {
                      if (signatureImageFileRef.current) signatureImageFileRef.current.value = "";
                      setSelectedFiles((v) => ({ ...v, signatureImage: "" }));
                    }}>×</button>
                  </div>
                ) : recordData.signature_image_url && !removedFiles.signatureImage ? (
                  <div className="existing-file-row">
                    <a href={recordData.signature_image_url} target="_blank" rel="noreferrer">{recordData.signature_image_filename || "Mevcut imzayı aç"}</a>
                    <button type="button" className="file-remove-btn" title="İmzayı kaldır" aria-label="İmza görselini kaldır" onClick={() => setRemovedFiles((v) => ({ ...v, signatureImage: true }))}>×</button>
                  </div>
                ) : removedFiles.signatureImage ? <span className="file-remove-pending">İmza kaldırılacak.</span> : "İmza yüklenmedi"}
              </div>
            </div>
            <p className="admin-hint pdf-signature-note">Kaşe ve/veya imza görseli yüklüyse otomatik AB Uygunluk Beyanı'ndaki imza alanına yerleştirilir. En temiz sonuç için şeffaf arka planlı PNG kullanın.</p>
            <button className="admin-primary" type="submit" name="save_intent" value="generate_documents">Kaydet ve 3 Belgeyi Oluştur</button>
          </div>
          <p className="admin-hint">PDF, DOC/DOCX ve görseller için dosya başına üst sınır 50 MB'dır.</p>
          <div className="form-grid">
            <label>AB Uygunluk Beyanı PDF<input disabled={declarationAuto} ref={declarationFileRef} type="file" name="declaration_file" accept="application/pdf" onChange={(e) => {
              const file = e.target.files?.[0];
              setSelectedFiles((v) => ({ ...v, declaration: file?.name || "" }));
              if (file) setRemovedFiles((v) => ({ ...v, declaration: false }));
            }} /></label>
            <div className="existing-file">
              {declarationAuto ? (
                <div className="auto-pdf-file">
                  <strong>Panel bilgilerinden otomatik oluşturulur</strong>
                  {recordData.declaration_auto ? <a href={`/belge/${encodeURIComponent(publicCode)}/uygunluk-beyani`} target="_blank" rel="noopener noreferrer">{automaticPdfFilename(publicCode, "uygunluk-beyani")} · Görüntüle</a> : <span>Etkinleştirmek için kaydedin.</span>}
                </div>
              ) : selectedFiles.declaration ? (
                <div className="existing-file-row selected-file-row">
                  <span>{selectedFiles.declaration}</span>
                  <button type="button" className="file-remove-btn" title="Seçilen dosyayı kaldır" aria-label="Seçilen uygunluk beyanı PDF'ini kaldır" onClick={() => {
                    if (declarationFileRef.current) declarationFileRef.current.value = "";
                    setSelectedFiles((v) => ({ ...v, declaration: "" }));
                  }}>×</button>
                </div>
              ) : recordData.declaration_url && !removedFiles.declaration ? (
                <div className="existing-file-row">
                  <a href={`/belge/${encodeURIComponent(publicCode)}/uygunluk-beyani`} target="_blank" rel="noreferrer">{recordData.declaration_filename || "Mevcut PDF'yi aç"}</a>
                  <button type="button" className="file-remove-btn" title="Belgeyi kaldır" aria-label="AB Uygunluk Beyanı PDF'ini kaldır" onClick={() => setRemovedFiles((v) => ({ ...v, declaration: true }))}>×</button>
                </div>
              ) : removedFiles.declaration ? <span className="file-remove-pending">Kaldırılacak. İsterseniz yukarıdan yeni PDF seçebilirsiniz.</span> : "Dosya yüklenmedi"}
            </div>

            <Input label="Teknik Dosya Başlığı" name="technical_title" defaultValue={recordData.technical_title} />
            <Input label="Teknik Dosya No" name="technical_doc_no" defaultValue={recordData.technical_doc_no} />
            <label>Teknik Dosya PDF<input disabled={technicalAuto} ref={technicalFileRef} type="file" name="technical_file" accept="application/pdf" onChange={(e) => {
              const file = e.target.files?.[0];
              setSelectedFiles((v) => ({ ...v, technical: file?.name || "" }));
              if (file) setRemovedFiles((v) => ({ ...v, technical: false }));
            }} /></label>
            <div className="existing-file">
              {technicalAuto ? (
                <div className="auto-pdf-file">
                  <strong>Panel bilgilerinden otomatik oluşturulur</strong>
                  {recordData.technical_auto ? <a href={`/belge/${encodeURIComponent(publicCode)}/teknik-dosya`} target="_blank" rel="noopener noreferrer">{automaticPdfFilename(publicCode, "teknik-dosya")} · Görüntüle</a> : <span>Etkinleştirmek için kaydedin.</span>}
                </div>
              ) : selectedFiles.technical ? (
                <div className="existing-file-row selected-file-row">
                  <span>{selectedFiles.technical}</span>
                  <button type="button" className="file-remove-btn" title="Seçilen dosyayı kaldır" aria-label="Seçilen teknik PDF'i kaldır" onClick={() => {
                    if (technicalFileRef.current) technicalFileRef.current.value = "";
                    setSelectedFiles((v) => ({ ...v, technical: "" }));
                  }}>×</button>
                </div>
              ) : recordData.technical_url && !removedFiles.technical ? (
                <div className="existing-file-row">
                  <a href={`/belge/${encodeURIComponent(publicCode)}/teknik-dosya`} target="_blank" rel="noreferrer">{recordData.technical_filename || "Mevcut PDF'yi aç"}</a>
                  <button type="button" className="file-remove-btn" title="Belgeyi kaldır" aria-label="Teknik Dosya PDF'ini kaldır" onClick={() => setRemovedFiles((v) => ({ ...v, technical: true }))}>×</button>
                </div>
              ) : removedFiles.technical ? <span className="file-remove-pending">Kaldırılacak. İsterseniz yukarıdan yeni PDF seçebilirsiniz.</span> : "Dosya yüklenmedi"}
            </div>

            <label>Art.5 PPWR Uygunluk Beyanı (DOC/DOCX)<input disabled={article5Auto} ref={article5FileRef} type="file" name="article5_file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => {
              const file = e.target.files?.[0];
              setSelectedFiles((v) => ({ ...v, article5: file?.name || "" }));
              if (file) setRemovedFiles((v) => ({ ...v, article5: false }));
            }} /></label>
            <div className="existing-file">
              {article5Auto ? (
                <div className="auto-pdf-file">
                  <strong>Şablondan otomatik Word oluşturulur</strong>
                  {recordData.article5_auto ? <a href={`/belge/${encodeURIComponent(publicCode)}/art-5-uygunluk-beyani/onizleme`} target="_blank" rel="noopener noreferrer">{automaticArticle5Filename({ ...recordData, public_code: publicCode, ppwr_id: ppwrId })} · Görüntüle</a> : <span>Etkinleştirmek için kaydedin.</span>}
                </div>
              ) : selectedFiles.article5 ? (
                <div className="existing-file-row selected-file-row">
                  <span>{selectedFiles.article5}</span>
                  <button type="button" className="file-remove-btn" title="Seçilen dosyayı kaldır" aria-label="Seçilen Art.5 PPWR Uygunluk Beyanı belgesini kaldır" onClick={() => {
                    if (article5FileRef.current) article5FileRef.current.value = "";
                    setSelectedFiles((v) => ({ ...v, article5: "" }));
                  }}>×</button>
                </div>
              ) : recordData.article5_url && !removedFiles.article5 ? (
                <div className="existing-file-row">
                  <a href={`/belge/${encodeURIComponent(publicCode)}/art-5-uygunluk-beyani/onizleme`} target="_blank" rel="noopener noreferrer">{recordData.article5_filename || "Mevcut DOC/DOCX belgesini aç"}</a>
                  <button type="button" className="file-remove-btn" title="Belgeyi kaldır" aria-label="Art.5 PPWR Uygunluk Beyanı belgesini kaldır" onClick={() => setRemovedFiles((v) => ({ ...v, article5: true }))}>×</button>
                </div>
              ) : removedFiles.article5 ? <span className="file-remove-pending">Kaldırılacak. İsterseniz yukarıdan yeni DOC/DOCX seçebilirsiniz.</span> : "Dosya yüklenmedi"}
            </div>

            <label>Ürün / CAD Görseli<input ref={productImageFileRef} type="file" name="product_image" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              setSelectedFiles((v) => ({ ...v, productImage: file?.name || "" }));
              if (file) setRemovedFiles((v) => ({ ...v, productImage: false }));
            }} /></label>
            <div className="existing-file">
              {selectedFiles.productImage ? (
                <div className="existing-file-row selected-file-row">
                  <span>{selectedFiles.productImage}</span>
                  <button type="button" className="file-remove-btn" title="Seçilen görseli kaldır" aria-label="Seçilen ürün görselini kaldır" onClick={() => {
                    if (productImageFileRef.current) productImageFileRef.current.value = "";
                    setSelectedFiles((v) => ({ ...v, productImage: "" }));
                  }}>×</button>
                </div>
              ) : recordData.product_image_url && !removedFiles.productImage ? (
                <div className="existing-file-row">
                  <a href={recordData.product_image_url} target="_blank" rel="noreferrer">Mevcut görseli aç</a>
                  <button type="button" className="file-remove-btn" title="Görseli kaldır" aria-label="Ürün görselini kaldır" onClick={() => setRemovedFiles((v) => ({ ...v, productImage: true }))}>×</button>
                </div>
              ) : removedFiles.productImage ? <span className="file-remove-pending">Kaldırılacak. İsterseniz yukarıdan yeni görsel seçebilirsiniz.</span> : "Görsel yüklenmedi"}
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <h2>5. Otomatik kayıt özeti</h2>
          <p className="admin-hint">Bu bölüm sistem tarafından otomatik takip edilir; ayrıca doldurmanız gerekmez.</p>
          <div className="auto-status-grid">
            <div className="auto-status"><span>Ambalaj kimliği</span><strong>{ppwrId && recordData.product_name ? "Hazır" : "Temel bilgiler bekleniyor"}</strong></div>
            <div className="auto-status"><span>AB Uygunluk Beyanı</span><strong>{hasDeclarationPdf(recordData) ? "PDF hazır" : "PDF yok"}</strong></div>
            <div className="auto-status"><span>Teknik dosya</span><strong>{hasTechnicalPdf(recordData) ? "PDF hazır" : "PDF yok"}</strong></div>
            <div className="auto-status"><span>Art.5 PPWR Uygunluk Beyanı</span><strong>{hasArticle5Document(recordData) ? (recordData.article5_auto ? "Word otomatik hazır" : "DOC/DOCX eklendi") : "Belge yok"}</strong></div>
          </div>
        </section>

        <div className="sticky-save">
          <button className="admin-primary" type="submit">{submitting ? "Kaydediliyor ve yayınlanıyor…" : "Kaydet ve Yayınla"}</button>
        </div>
      </fieldset>
    </form>
  );
}
