import { createRecordAction } from "../actions";

export default function NewRecordPage() {
  return (
    <div className="admin-page">
      <div className="admin-header"><div><div className="admin-kicker">YENİ KAYIT</div><h1>PPWR kaydı oluştur</h1><p>Kayıt kodu URL'nin son bölümüdür ve sabit uzunlukta değildir.</p></div></div>
      <form action={createRecordAction} className="admin-panel admin-form">
        <div className="form-grid">
          <label>Kamu kayıt kodu<input name="public_code" required placeholder="160553 / AK-26-00049 / ABC123" /></label>
          <label>PPWR ID<input name="ppwr_id" placeholder="Kodla aynı olabilir" /></label>
          <label>Declaration ID<input name="declaration_id" /></label>
          <label>Ürün / ambalaj adı<input name="product_name" /></label>
          <label className="span2">Müşteri<input name="customer" /></label>
        </div>
        <div style={{marginTop:16}}><button className="admin-primary" type="submit">Kaydı oluştur</button></div>
      </form>
    </div>
  );
}
