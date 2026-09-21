"use client";

import { useState } from "react";
import { COMPANY } from "@/lib/company";

function value(v, fallback = "—") { return v || fallback; }
function array(v) { return Array.isArray(v) ? v : []; }
function dimensionParts(value) {
  const parts = String(value || "")
    .toLowerCase()
    .replace(/mm/g, "")
    .replace(/,/g, ".")
    .split(/[x×*]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length === 3 ? parts : ["", "", ""];
}
function papMeta(value) {
  const code = String(value || "").replace(/\s+/g, "").toUpperCase();
  if (code === "PAP20") return { code: "PAP 20" };
  if (code === "PAP21") return { code: "PAP 21" };
  return null;
}

function packageTypeLabel(value) {
  const type = String(value || "").trim();
  if (type === "E Dalga") return "E Dalga / E-Flute";
  if (type === "B Dalga") return "B Dalga / B-Flute";
  if (type === "EB Dalga") return "EB Dalga / EB-Flute";
  return value(type);
}

function packageClassLabel(value) {
  const text = String(value || "").trim();
  if (!text || text === "Yedek Parça Kutusu") return "Yedek Parça Kutusu / Spare Parts Box";
  return text;
}

function materialLabel(value) {
  return String(value || "")
    .replace("Krome Karton", "Krome Karton / Chromo Board")
    .replace("Tutkal", "Tutkal / Adhesive");
}

export default function PublicRecord({ record, qrDataUrl }) {
  const [imageOpen, setImageOpen] = useState(false);
  const materials = array(record.materials);
  const pap = papMeta(record.usage_cycle);
  const [widthMm, lengthMm, heightMm] = dimensionParts(record.dimensions);
  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand corporate-brand"><div className="brand-logo-surface"><img className="brand-logo" src="https://acilimkutu.com/wp-content/uploads/2020/02/logo.webp" alt="Açılım Kutu" /></div><div className="brandtext brand-system"><strong>PPWR KAYIT SİSTEMİ / PPWR RECORD SYSTEM</strong><span>Ambalaj Uygunluk Portalı / Packaging Compliance Portal</span></div></div>
      </div>

      <section className="hero">
        <div>
          <div className="eyebrow">Regulation (EU) 2025/40</div>
          <h1>PPWR Uyumluluk / Compliance</h1>
          <p>Ambalaj kimliği, izlenebilirlik, teknik dokümantasyon ve kontrollü belge erişimi için Açılım Kutu dijital PPWR kayıt ekranı. / Açılım Kutu digital PPWR record page for packaging identification, traceability, technical documentation and controlled document access.</p>
          <div className="hero-meta">
            <div className="metric"><span>PPWR ID</span><strong>{value(record.ppwr_id, record.public_code)}</strong></div>
            <div className="metric"><span>Beyan ID / Declaration ID</span><strong>{value(record.declaration_id)}</strong></div>
            <div className="metric"><span>Kayıt Kodu / Record Code</span><strong>{value(record.public_code)}</strong></div>
            <div className="metric"><span>Son İnceleme / Last Review</span><strong>{value(record.review_date)}</strong></div>
          </div>
        </div>
        <div className="qrbox"><div className="qrinner"><img src={qrDataUrl} alt={`${record.public_code} QR`} /><b>{record.public_code}</b><small>Dijital kayıt için tarayın / Scan for digital record</small></div></div>
      </section>

      <div className="grid">
        <section className="card"><h2>Firma Bilgileri / Company Information</h2><dl className="info">
          <dt>Ambalaj Üreticisi / Packaging Manufacturer</dt><dd>{COMPANY.name}</dd><dt>E-posta / Email</dt><dd>{COMPANY.email}</dd><dt>Telefon / Phone</dt><dd>{COMPANY.phone}</dd><dt>Müşteri / Customer</dt><dd>{value(record.customer)}</dd>
        </dl></section>

        <section className="card packaging-id-card"><h2>Ambalaj Tanımı / Packaging Identification</h2>
          <div className="packaging-info">
            <div className="packaging-info-row"><span>Açılım İş Kodu / Job Code</span><strong>{value(record.job_code)}</strong></div>
            <div className="packaging-info-row"><span>Sistem Kodu / System Code</span><strong>{value(record.system_code)}</strong></div>
            <div className="packaging-info-row"><span>Ürün Tanımı / Product Description</span><strong>{value(record.product_name)}</strong></div>
            <div className="packaging-info-row"><span>Ambalaj Sınıfı / Packaging Class</span><strong>{packageClassLabel(record.package_class)}</strong></div>
            <div className="packaging-info-row"><span>Ambalaj Tipi / Packaging Type</span><strong>{packageTypeLabel(record.package_type)}</strong></div>
            <div className="packaging-info-row"><span>Geri Dönüşüm Sınıfı / Recycling Class</span><strong>{pap ? <span className="pap-public"><span className="pap-logo">♻</span><strong>{pap.code}</strong></span> : "—"}</strong></div>
            <div className="packaging-info-row"><span>Toplam Ağırlık / Total Weight</span><strong>{value(record.total_weight)}</strong></div>
            <div className="packaging-info-row"><span>Üretim Tesisi / Production Facility</span><strong>{value(record.production_facility)}</strong></div>
          </div>
        </section>

        <section className="card full"><h2>Kayıt Özeti / Record Summary</h2><div className="sub">Belge durumu sistem tarafından otomatik gösterilir. / Document status is displayed automatically by the system.</div><div className="statusgrid">
          <div className="check"><b>Ambalaj Kimliği / Packaging Identity</b><div className="flag ok">● Yayında / Published</div></div>
          <div className="check"><b>Teknik Dosya / Technical File</b><div className={record.technical_url ? "flag ok" : "flag"}>● {record.technical_url ? "PDF eklendi / PDF Available" : "PDF yok / No PDF"}</div></div>
          <div className="check"><b>AB Uygunluk Beyanı / EU Declaration of Conformity</b><div className={record.declaration_url ? "flag ok" : "flag"}>● {record.declaration_url ? "PDF eklendi / PDF Available" : "PDF yok / No PDF"}</div></div>
        </div></section>

        <section className="card full"><h2>Malzeme Bileşimi / Material Composition</h2><div className="table-scroll"><table className="materials"><thead><tr><th>Malzeme / Material</th><th>Ağırlık / Weight</th><th>Oran / Ratio</th></tr></thead><tbody>
          {materials.length ? materials.map((m,i)=><tr key={i}><td>{materialLabel(m.name)}</td><td>{value(m.weight)}</td><td>{value(m.ratio)}</td></tr>) : <tr><td colSpan="3">Malzeme bileşimi girilmemiş. / Material composition not provided.</td></tr>}
          <tr><td><strong>Toplam / Total</strong></td><td><strong>{value(record.total_weight)}</strong></td><td><strong>100%</strong></td></tr>
        </tbody></table></div></section>

        <section className="card full"><h2>Belgeler / Documents</h2>
          {record.declaration_url && <div className="doc"><div className="docicon">PDF</div><div><h3>AB Uygunluk Beyanı / EU Declaration of Conformity</h3></div><div className="actions"><a className="btn" href={`/belge/${encodeURIComponent(record.public_code)}/uygunluk-beyani`} target="_blank" rel="noreferrer">Görüntüle / View</a><a className="btn primary" href={`/belge/${encodeURIComponent(record.public_code)}/uygunluk-beyani?indir=1`}>PDF İndir / Download PDF</a></div></div>}
          {record.technical_url && <div className="doc"><div className="docicon">PDF</div><div><h3>{value(record.technical_title,"Ambalaj Teknik Dosya Özeti / Packaging Technical File Summary")}</h3><p>{value(record.technical_doc_no)}</p></div><div className="actions"><a className="btn" href={`/belge/${encodeURIComponent(record.public_code)}/teknik-dosya`} target="_blank" rel="noreferrer">Görüntüle / View</a><a className="btn primary" href={`/belge/${encodeURIComponent(record.public_code)}/teknik-dosya?indir=1`}>PDF İndir / Download PDF</a></div></div>}
          {!record.declaration_url && !record.technical_url && <p className="muted">Yayınlanmış belge bulunmuyor. / No published documents available.</p>}
        </section>

        <section className="card full product-visual-card"><h2>Ürün Görseli / Product Visualization</h2>
          <div className="visual">
            <div className="visual-specs">
              <div className="visual-stat"><span>En / Width</span><strong>{widthMm ? `${widthMm} mm` : "—"}</strong></div>
              <div className="visual-stat"><span>Boy / Length</span><strong>{lengthMm ? `${lengthMm} mm` : "—"}</strong></div>
              <div className="visual-stat"><span>Yükseklik / Height</span><strong>{heightMm ? `${heightMm} mm` : "—"}</strong></div>
              <div className="visual-stat"><span>Net Alan / Net Area</span><strong>{value(record.net_area)}</strong></div>
              <div className="visual-stat"><span>Renk Sayısı / Color Count</span><strong>{record.color_count || "—"}</strong></div>
              <div className="visual-stat"><span>Toplam Ağırlık / Total Weight</span><strong>{value(record.total_weight)}</strong></div>
            </div>
            <div className="visual-image-pane">
              <div className="package">{record.product_image_url ? <button type="button" className="product-image-button" onClick={() => setImageOpen(true)} aria-label="Ürün görselini büyüt / Enlarge product image"><img className="product-image" src={record.product_image_url} alt={record.product_name || "Ürün görseli / Product image"}/><span className="image-zoom-hint">Büyüt / Enlarge</span></button> : <div className="image-placeholder">Ürün/CAD görseli / Product/CAD image</div>}</div>
            </div>
          </div>
        </section>

      {imageOpen && record.product_image_url && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Büyütülmüş ürün görseli / Enlarged product image" onClick={() => setImageOpen(false)}>
          <button type="button" className="image-lightbox-close" onClick={() => setImageOpen(false)} aria-label="Görseli kapat / Close image">×</button>
          <img src={record.product_image_url} alt={record.product_name || "Ürün görseli / Product image"} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      </div>

      <div className="footer"><img className="footer-logo" src="https://acilimkutu.com/wp-content/uploads/2020/02/logo.webp" alt="Açılım Kutu" /><strong>{COMPANY.name}</strong><br/>{COMPANY.address} · {COMPANY.email} · {COMPANY.phone}<br/><span>PPWR belge erişimi ve ambalaj kayıt sistemi / PPWR document access and packaging record system</span></div>
    </div>
  );
}
