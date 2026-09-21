import { listRecords } from "@/lib/db";

export default async function AdminHome() {
  const rows = await listRecords();

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div><h1>PPWR Yönetim Paneli</h1><p>Tüm kayıtlar yalnızca bu yönetim ekranında listelenir. Kamu tarafında toplu liste oluşturulmaz.</p></div>
      </div>
      <div className="admin-stats">
        <div><span>Toplam kayıt</span><strong>{rows.length}</strong></div>
        <div><span>Aktif kamu sayfası</span><strong>{rows.length}</strong></div>
        <div><span>Yayınlama modu</span><strong>Anında</strong></div>
      </div>
      <div className="admin-panel">
        <h2>Çalışma mantığı</h2>
        <p>Soldan bir PPWR kaydı seçin veya yeni kayıt oluşturun. Yönetici ekranında yaptığınız değişiklikler “Kaydet ve Yayınla” ile doğrudan ilgili kamu sayfasına yansır. Ayrı taslak, onay veya revizyon adımı yoktur.</p>
      </div>
    </div>
  );
}
