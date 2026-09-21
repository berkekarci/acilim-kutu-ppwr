"use client";

import { useState } from "react";
import { COMPANY } from "@/lib/company";

function value(v, fallback = "—") { return v || fallback; }
function array(v) { return Array.isArray(v) ? v : []; }
function papMeta(value) {
  const code = String(value || "").replace(/\s+/g, "").toUpperCase();
  if (code === "PAP20") return { code: "PAP 20" };
  if (code === "PAP21") return { code: "PAP 21" };
  return null;
}

export default function PublicRecord({ record, qrDataUrl }) {
  const [imageOpen, setImageOpen] = useState(false);
  const components = array(record.components);
  const materials = array(record.materials);
  const pap = papMeta(record.usage_cycle);
  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand corporate-brand"><div className="brand-logo-surface"><img className="brand-logo" src="https://acilimkutu.com/wp-content/uploads/2020/02/logo.webp" alt="Açılım Kutu" /></div><div className="brandtext brand-system"><strong>PPWR KAYIT SİSTEMİ</strong><span>Packaging Compliance Portal</span></div></div>
      </div>

      <section className="hero">
        <div>
          <div className="eyebrow">Regulation (EU) 2025/40</div>
          <h1>PPWR Uyumluluk / Compliance</h1>
          <p>Ambalaj kimliği, izlenebilirlik, teknik dokümantasyon ve kontrollü belge erişimi için Açılım Kutu dijital PPWR kayıt ekranı.</p>
          <div className="hero-meta">
            <div className="metric"><span>PPWR ID</span><strong>{value(record.ppwr_id, record.public_code)}</strong></div>
            <div className="metric"><span>Declaration ID</span><strong>{value(record.declaration_id)}</strong></div>
            <div className="metric"><span>Kayıt Kodu</span><strong>{value(record.public_code)}</strong></div>
            <div className="metric"><span>Last review</span><strong>{value(record.review_date)}</strong></div>
          </div>
        </div>
        <div className="qrbox"><div className="qrinner"><img src={qrDataUrl} alt={`${record.public_code} QR`} /><b>{record.public_code}</b><small>Scan for digital record</small></div></div>
      </section>

      <div className="grid">
        <section className="card"><h2>Firma Bilgileri / Company Information</h2><dl className="info">
          <dt>Ambalaj Üreticisi</dt><dd>{COMPANY.name}</dd><dt>E-posta</dt><dd>{COMPANY.email}</dd><dt>Telefon</dt><dd>{COMPANY.phone}</dd><dt>Müşteri</dt><dd>{value(record.customer)}</dd>
        </dl></section>

        <section className="card"><h2>Ambalaj Tanımı / Packaging Identification</h2><dl className="info">
          <dt>Açılım İş Kodu</dt><dd>{value(record.job_code)}</dd><dt>Sistem Kodu</dt><dd>{value(record.system_code)}</dd><dt>Ürün Tanımı</dt><dd>{value(record.product_name)}</dd><dt>Ambalaj Sınıfı</dt><dd>{value(record.package_class, "Yedek Parça Kutusu")}</dd><dt>Ambalaj Tipi</dt><dd>{value(record.package_type)}</dd><dt>Geri Dönüşüm Sınıfı</dt><dd>{pap ? <span className="pap-public"><span className="pap-logo">♻</span><strong>{pap.code}</strong></span> : "—"}</dd><dt>Toplam Ağırlık</dt><dd>{value(record.total_weight)}</dd><dt>Üretim Tesisi</dt><dd>{value(record.production_facility)}</dd>
        </dl></section>

        <section className="card full"><h2>Kayıt Özeti / Record Summary</h2><div className="sub">Belge durumu sistem tarafından otomatik gösterilir.</div><div className="statusgrid">
          <div className="check"><b>Ambalaj Kimliği</b><div className="flag ok">● Yayında</div></div>
          <div className="check"><b>Teknik Dosya</b><div className={record.technical_url ? "flag ok" : "flag"}>● {record.technical_url ? "PDF eklendi" : "PDF yok"}</div></div>
          <div className="check"><b>AB Uygunluk Beyanı</b><div className={record.declaration_url ? "flag ok" : "flag"}>● {record.declaration_url ? "PDF eklendi" : "PDF yok"}</div></div>
        </div></section>

        <section className="card"><h2>Ambalaj Parçaları / Packaging Components</h2>
          {components.length ? components.map((c, i) => <div className="component" key={i}><div className="num">{String(i+1).padStart(2,"0")}</div><div><h3>{value(c.name)}</h3><p>{[c.material,c.details].filter(Boolean).join(" · ")}</p></div><div className="weight">{value(c.weight)}</div></div>) : <p className="muted">Komponent bilgisi girilmemiş.</p>}
          <div className="component-total"><strong>Toplam / Total</strong><strong>{value(record.total_weight)}</strong></div>
        </section>

        <section className="card"><h2>Malzeme Bileşimi / Material Composition</h2><div className="table-scroll"><table className="materials"><thead><tr><th>Malzeme</th><th>Ağırlık</th><th>Oran</th></tr></thead><tbody>
          {materials.length ? materials.map((m,i)=><tr key={i}><td>{value(m.name)}</td><td>{value(m.weight)}</td><td>{value(m.ratio)}</td></tr>) : <tr><td colSpan="3">Malzeme bileşimi girilmemiş.</td></tr>}
          <tr><td><strong>Total</strong></td><td><strong>{value(record.total_weight)}</strong></td><td><strong>100%</strong></td></tr>
        </tbody></table></div></section>

        <section className="card full"><h2>Belgeler / Documents</h2>
          {record.declaration_url && <div className="doc"><div className="docicon">PDF</div><div><h3>AB Uygunluk Beyanı</h3></div><div className="actions"><a className="btn" href={record.declaration_url} target="_blank" rel="noreferrer">Görüntüle</a><a className="btn primary" href={record.declaration_download_url || record.declaration_url}>PDF İndir</a></div></div>}
          {record.technical_url && <div className="doc"><div className="docicon">PDF</div><div><h3>{value(record.technical_title,"Ambalaj Teknik Dosya Özeti")}</h3><p>{value(record.technical_doc_no)}</p></div><div className="actions"><a className="btn" href={record.technical_url} target="_blank" rel="noreferrer">Görüntüle</a><a className="btn primary" href={record.technical_download_url || record.technical_url}>PDF İndir</a></div></div>}
          {!record.declaration_url && !record.technical_url && <p className="muted">Yayınlanmış belge bulunmuyor.</p>}
        </section>

        <section className="card full"><h2>Ürün Görseli / Product Visualization</h2><div className="visual"><div>
          <dl className="info"><dt>Ölçüler</dt><dd>{value(record.dimensions)}</dd><dt>Net Alan</dt><dd>{value(record.net_area)}</dd></dl>
        </div><div><div className="package">{record.product_image_url ? <button type="button" className="product-image-button" onClick={() => setImageOpen(true)} aria-label="Ürün görselini büyüt"><img className="product-image" src={record.product_image_url} alt={record.product_name || "Ürün görseli"}/><span className="image-zoom-hint">Büyüt</span></button> : <div className="image-placeholder">Ürün/CAD görseli</div>}</div></div></div></section>

      {imageOpen && record.product_image_url && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Büyütülmüş ürün görseli" onClick={() => setImageOpen(false)}>
          <button type="button" className="image-lightbox-close" onClick={() => setImageOpen(false)} aria-label="Görseli kapat">×</button>
          <img src={record.product_image_url} alt={record.product_name || "Ürün görseli"} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      </div>

      <div className="footer"><img className="footer-logo" src="https://acilimkutu.com/wp-content/uploads/2020/02/logo.webp" alt="Açılım Kutu" /><strong>{COMPANY.name}</strong><br/>{COMPANY.address} · {COMPANY.email} · {COMPANY.phone}<br/><span>PPWR belge erişimi ve ambalaj kayıt sistemi</span></div>
    </div>
  );
}
