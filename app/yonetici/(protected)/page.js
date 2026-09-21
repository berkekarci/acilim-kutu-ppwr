import { listRecords } from "@/lib/db";

export default async function AdminHome() {
  const rows = await listRecords();
  const published = rows.filter((row) => row.has_published).length;
  const working = rows.filter((row) => row.status === "draft" || row.status === "review").length;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div><h1>PPWR Yönetim Paneli</h1><p>Tüm kayıtlar yalnızca bu yönetim ekranında listelenir. Kamu tarafında toplu liste oluşturulmaz.</p></div>
      </div>
      <div className="admin-stats">
        <div><span>Toplam kayıt</span><strong>{rows.length}</strong></div>
        <div><span>Kamuya yayında</span><strong>{published}</strong></div>
        <div><span>Aktif taslak / inceleme</span><strong>{working}</strong></div>
      </div>
      <div className="admin-panel">
        <h2>Çalışma mantığı</h2>
        <p>Soldan bir PPWR kaydı seçin veya yeni kayıt oluşturun. Her kayıt altında birden fazla revizyon tutulur. Kamu URL'si daima o kodun son yayınlanmış revizyonunu açar. Yeni bir revizyon üzerinde çalışmak mevcut yayını kesmez.</p>
      </div>
    </div>
  );
}
