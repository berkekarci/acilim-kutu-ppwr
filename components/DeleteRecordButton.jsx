"use client";

export default function DeleteRecordButton({ recordId, code, action }) {
  function confirmDelete(event) {
    const ok = window.confirm(
      `"${code}" kodlu PPWR kaydını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem tüm revizyonları kaldırır ve kamu bağlantısı artık açılmaz.`
    );
    if (!ok) event.preventDefault();
  }

  return (
    <form action={action} onSubmit={confirmDelete}>
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="confirm_delete" value="EVET" />
      <button className="danger-btn" type="submit">PPWR Kaydını Sil</button>
    </form>
  );
}
