import { requireAdmin } from "@/lib/auth";
import { listRecords } from "@/lib/db";
import AdminSidebar from "@/components/AdminSidebar";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  await requireAdmin();
  const records = await listRecords();
  return (
    <div className="admin-shell">
      <AdminSidebar records={records} logoutAction={logoutAction} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
