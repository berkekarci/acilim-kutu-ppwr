"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function AdminSidebar({ records }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return records;
    return records.filter((r) => [r.public_code, r.product_name, r.customer, r.ppwr_id].some((v) => String(v || "").toLowerCase().includes(n)));
  }, [q, records]);

  return (
    <aside className="admin-side">
      <div className="admin-brand"><div className="brandmark">AK</div><div><strong>Açılım Kutu</strong><small>PPWR Yönetimi</small></div></div>
      <Link className="admin-primary admin-new" href="/yonetici/yeni">+ Yeni kayıt</Link>
      <label className="side-search">Kayıtlarda ara<input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Kod, müşteri, ürün..." /></label>
      <div className="admin-record-count">{filtered.length} kayıt</div>
      <div className="admin-records">
        {filtered.map((r) => <Link key={r.id} className="admin-record" href={`/yonetici/${r.id}`}><div className="record-line"><strong>{r.public_code}</strong><i className={`status-dot ${r.latest_status || ""}`} /></div><span>{r.product_name || "Ürün tanımı yok"}</span><small>{r.customer || "Müşteri belirtilmedi"}</small></Link>)}
        {!filtered.length && <div className="side-empty">Kayıt bulunamadı.</div>}
      </div>
      <form action="/api/auth/logout" method="post"><button className="admin-logout" type="submit">Çıkış yap</button></form>
    </aside>
  );
}
