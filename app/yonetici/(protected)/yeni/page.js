import { createRecordAction } from "../actions";

export default async function NewRecordPage({ searchParams }) {
  const sp = await searchParams;
  let error = "";
  if (sp?.hata === "tekrar") error = "Bu kamu kodu zaten kullanılıyor.";
  if (sp?.hata === "kod") error = "Kod yalnızca harf, sayı, nokta, alt çizgi ve tire içerebilir; en fazla 160 karakter olabilir.";
  if (sp?.hata === "revizyon") error = "İlk revizyon etiketi geçersiz.";

  return (
    <div className="admin-page">
      <div className="admin-header"><div><h1>Yeni PPWR Kaydı</h1><p>Kamu kodu sabit uzunlukta değildir. Harf, sayı ve tire kombinasyonları kullanılabilir.</p></div></div>
      {error && <div className="errorbox">{error}</div>}
      <form action={createRecordAction} className="admin-panel admin-form">
        <div className="form-grid">
          <label>Kamu Kayıt Kodu<input name="code" placeholder="160553 / AK-26-00049 / ABC123" required maxLength={160} /></label>
          <label>İlk Revizyon<input name="revision_label" defaultValue="Rev.00" required maxLength={80} /></label>
          <label>PPWR ID<input name="ppwr_id" placeholder="ACL-APB-85-160553" /></label>
          <label>Müşteri<input name="customer" /></label>
          <label className="span2">Ürün / Ambalaj Adı<input name="product_name" /></label>
        </div>
        <button className="admin-primary" type="submit">Kaydı Oluştur</button>
      </form>
    </div>
  );
}
