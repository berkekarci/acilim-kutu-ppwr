import { COMPANY } from "@/lib/company";

function value(v, fallback = "—") { return v || fallback; }
function array(v) { return Array.isArray(v) ? v : []; }

export default function PublicRecord({ record, qrDataUrl }) {
  const components = array(record.components);
  const materials = array(record.materials);
  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand corporate-brand"><div className="brand-logo-surface"><img className="brand-logo" src="https://acilimkutu.com/wp-content/uploads/2020/02/logo.webp" alt="Açılım Kutu" /></div><div className="brandtext brand-system"><strong>PPWR KAYIT SİSTEMİ</strong><span>Packaging Compliance Portal</span></div></div>
        <div className="lang"><button className="active">TR</button><button disabled>EN</button></div>
      </div>

      <section className="hero">
        <div>
          <div className="eyebrow">Regulation (EU) 2025/40</div>
          <h1>PPWR Uyumluluk / Compliance</h1>
          <p>Ambalaj kimliği, izlenebilirlik, teknik dokümantasyon ve kontrollü belge erişimi için Açılım Kutu dijital PPWR kayıt ekranı.</p>
          <div className="hero-meta">
            <div className="metric"><span>PPWR ID</span><strong>{value(record.ppwr_id, record.public_code)}</strong></div>
            <div className="metric"><span>Declaration ID</span><strong>{value(record.declaration_id)}</strong></div>
            <div className="metric"><span>Revision</span><strong>{value(record.revision_label)} / PUBLISHED</strong></div>
            <div className="metric"><span>Last review</span><strong>{value(record.review_date)}</strong></div>
          </div>
        </div>
        <div className="qrbox"><div className="qrinner"><img src={qrDataUrl} alt={`${record.public_code} QR`} /><b>{record.public_code}</b><small>Scan for digital record</small></div></div>
      </section>

      <div className="notice"><strong>YAYINLANMIŞ KAYIT:</strong> Bu sayfa yalnızca onaylanmış güncel revizyonu gösterir. Yeni revizyon yayınlandığında önceki revizyon yönetim sisteminde arşivlenerek izlenebilirlik korunur.</div>

      <div className="grid">
        <section className="card"><h2>Firma Bilgileri / Company Information</h2><dl className="info">
          <dt>Ambalaj Üreticisi</dt><dd>{COMPANY.name}</dd><dt>Adres</dt><dd>{COMPANY.address}</dd><dt>E-posta</dt><dd>{COMPANY.email}</dd><dt>Telefon</dt><dd>{COMPANY.phone}</dd><dt>Müşteri</dt><dd>{value(record.customer)}</dd><dt>İthalatçı</dt><dd>{value(record.importer)}</dd>
        </dl></section>

        <section className="card"><h2>Ambalaj Tanımı / Packaging Identification</h2><dl className="info">
          <dt>Açılım İş Kodu</dt><dd>{value(record.job_code)}</dd><dt>Müşteri Ref</dt><dd>{value(record.customer_ref)}</dd><dt>Sistem Kodu</dt><dd>{value(record.system_code)}</dd><dt>Ürün Tanımı</dt><dd>{value(record.product_name)}</dd><dt>Ambalaj Sınıfı</dt><dd>{value(record.package_class)}</dd><dt>Ambalaj Tipi</dt><dd>{value(record.package_type)}</dd><dt>Kullanım Amacı</dt><dd>{value(record.usage_purpose)}</dd><dt>Kullanım Döngüsü</dt><dd>{value(record.usage_cycle)}</dd><dt>Toplam Ağırlık</dt><dd>{value(record.total_weight)}</dd><dt>Üretim Tesisi</dt><dd>{value(record.production_facility)}</dd>
        </dl></section>

        <section className="card full"><h2>PPWR Kayıt Durumu / Record Status</h2><div className="sub">Yayınlanan revizyonun dokümantasyon durumları.</div><div className="statusgrid">
          <div className="check"><b>Ambalaj Kimliği</b><small>İş, müşteri ve sistem kodları.</small><div className="flag ok">● {value(record.identity_status)}</div></div>
          <div className="check"><b>Teknik Dokümantasyon</b><small>Teknik dosya ve destekleyici kanıtlar.</small><div className="flag">● {value(record.technical_status)}</div></div>
          <div className="check"><b>EU Declaration of Conformity</b><small>Uygunluk beyanı belge durumu.</small><div className="flag">● {value(record.declaration_status)}</div></div>
        </div></section>

        <section className="card"><h2>Ambalaj Parçaları / Packaging Components</h2>
          {components.length ? components.map((c, i) => <div className="component" key={i}><div className="num">{String(i+1).padStart(2,"0")}</div><div><h3>{value(c.name)}</h3><p>{[c.material,c.details].filter(Boolean).join(" · ")}</p></div><div className="weight">{value(c.weight)}</div></div>) : <p className="muted">Komponent bilgisi girilmemiş.</p>}
          <div className="component-total"><strong>Toplam / Total</strong><strong>{value(record.total_weight)}</strong></div>
        </section>

        <section className="card"><h2>Malzeme Bileşimi / Material Composition</h2><div className="table-scroll"><table className="materials"><thead><tr><th>Malzeme</th><th>Ağırlık</th><th>Oran</th><th>Kanıt / Kaynak</th></tr></thead><tbody>
          {materials.length ? materials.map((m,i)=><tr key={i}><td>{value(m.name)}</td><td>{value(m.weight)}</td><td>{value(m.ratio)}</td><td>{value(m.evidence)}</td></tr>) : <tr><td colSpan="4">Malzeme bileşimi girilmemiş.</td></tr>}
          <tr><td><strong>Total</strong></td><td><strong>{value(record.total_weight)}</strong></td><td><strong>100%</strong></td><td>—</td></tr>
        </tbody></table></div></section>

        <section className="card full"><h2>Belgeler / Documents</h2>
          {record.declaration_url && <div className="doc"><div className="docicon">PDF</div><div><h3>{value(record.declaration_title,"AB Uygunluk Beyanı")}</h3><p>{value(record.declaration_doc_no)}</p></div><div className="actions"><a className="btn" href={record.declaration_url} target="_blank" rel="noreferrer">Görüntüle</a><a className="btn primary" href={record.declaration_download_url || record.declaration_url}>PDF İndir</a></div></div>}
          {record.technical_url && <div className="doc"><div className="docicon">PDF</div><div><h3>{value(record.technical_title,"Ambalaj Teknik Dosya Özeti")}</h3><p>{value(record.technical_doc_no)}</p></div><div className="actions"><a className="btn" href={record.technical_url} target="_blank" rel="noreferrer">Görüntüle</a><a className="btn primary" href={record.technical_download_url || record.technical_url}>PDF İndir</a></div></div>}
          {!record.declaration_url && !record.technical_url && <p className="muted">Yayınlanmış belge bulunmuyor.</p>}
        </section>

        <section className="card full"><h2>Ürün Görseli / Product Visualization</h2><div className="visual"><div>
          <dl className="info"><dt>Ölçüler</dt><dd>{value(record.dimensions)}</dd><dt>Net Alan</dt><dd>{value(record.net_area)}</dd><dt>Görsel Kaynağı</dt><dd>{value(record.product_image_source)}</dd><dt>Revizyon Bağı</dt><dd>{value(record.revision_label)}</dd><dt>Erişim</dt><dd>{value(record.product_image_access,"Müşteriye açık")}</dd></dl>
        </div><div><div className="package">{record.product_image_url ? <img className="product-image" src={record.product_image_url} alt={record.product_name || "Ürün görseli"}/> : <div className="image-placeholder">Ürün/CAD görseli</div>}</div></div></div></section>
      </div>

      <div className="footer"><img className="footer-logo" src="https://acilimkutu.com/wp-content/uploads/2020/02/logo.webp" alt="Açılım Kutu" /><strong>{COMPANY.name}</strong><br/>{COMPANY.address} · {COMPANY.email} · {COMPANY.phone}<br/><span>PPWR belge erişimi ve ambalaj kayıt sistemi</span></div>
    </div>
  );
}
