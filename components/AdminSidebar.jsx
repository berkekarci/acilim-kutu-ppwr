"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function AdminSidebar({ records, logoutAction }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return records;
    return records.filter((record) =>
      [record.code, record.product_name, record.customer]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(q))
    );
  }, [query, records]);

  return (
    <aside className="admin-side">
      <div className="admin-brand">
        <div className="admin-logo-surface"><img className="admin-logo" src="https://acilimkutu.com/wp-content/uploads/2020/02/logo.webp" alt="Açılım Kutu" /></div>
        <div className="admin-brand-copy"><strong>PPWR Yönetim</strong><small>Kayıt Sistemi</small></div>
      </div>
      <Link className="admin-primary admin-new" href="/yonetici/yeni">+ Yeni PPWR Kaydı</Link>
      <label className="side-search">
        <span>Kayıtlarda ara</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kod, ürün, müşteri…" />
      </label>
      <div className="admin-record-count">{filtered.length} / {records.length} kayıt</div>
      <div className="admin-records">
        {filtered.map((record) => (
          <Link href={`/yonetici/${record.id}`} key={record.id} className="admin-record">
            <div className="record-line"><strong>{record.code}</strong></div>
            <span>{record.product_name || "Ürün adı girilmedi"}</span>
            <small>{record.customer || "Müşteri girilmedi"} · kamu sayfası aktif</small>
          </Link>
        ))}
        {!filtered.length && <p className="side-empty">Eşleşen kayıt yok.</p>}
      </div>
      <form action={logoutAction}><button className="admin-logout">Çıkış Yap</button></form>
    </aside>
  );
}
