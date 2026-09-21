import Link from "next/link";
import { getAdminStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const stats = await getAdminStats();
  return (
    <div className="admin-page">
      <div className="admin-header">
        <div><div className="admin-kicker">AÇILIM KUTU</div><h1>PPWR Yönetim Paneli</h1><p>Kayıtlar, revizyonlar ve yayın durumu.</p></div>
        <Link className="admin-primary" href="/yonetici/yeni">+ Yeni PPWR Kaydı</Link>
      </div>
      <div className="admin-stats">
        <div><span>Toplam kayıt</span><strong>{stats.total}</strong></div>
        <div><span>Yayında</span><strong>{stats.published}</strong></div>
        <div><span>Taslak / inceleme</span><strong>{stats.nonPublished}</strong></div>
      </div>
      <div className="admin-panel"><h2>Kayıt seçin</h2><p>Sol menüden bir PPWR kaydı seçerek bilgilerini ve revizyonlarını yönetin.</p></div>
    </div>
  );
}
