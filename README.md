# Açılım Kutu PPWR Portalı

Bu proje, `ppwr.acilimkutu.com` için bağımsız Vercel/Next.js uygulamasıdır. `acilimkutu.com` ana sitesine dokunmaz.

## Sabit mimari

- Kamu kaydı: `https://ppwr.acilimkutu.com/[kod]`
- Yönetici paneli: `https://ppwr.acilimkutu.com/yonetici`
- Kamu tarafında toplu kayıt listesi **yoktur**.
- Kod uzunluğu sabit değildir. Harf, sayı ve tire kullanılabilir. `/ ? # %` tek segment URL yapısını bozduğu için kabul edilmez.
- Her PPWR kaydının birden çok revizyonu olabilir.
- Kamu sayfası yalnızca `published` durumundaki son revizyonu gösterir.
- Yeni revizyon yayınlandığında eski yayın `archived` olur; veritabanından silinmez.
- PDF ve görseller Vercel Blob'da, kayıt/revizyon verileri Neon Postgres'te tutulur.
- Yönetici girişi ChatGPT/OpenAI hesabından bağımsızdır.

## Vercel kurulumu

1. Ayrı bir GitHub deposu oluşturun.
2. Bu klasörün içeriğini o depoya yükleyin.
3. Vercel'de yeni Project oluşturup bu depoyu bağlayın.
4. Vercel Marketplace'ten **Neon Postgres** ekleyin. `DATABASE_URL` otomatik tanımlanmalıdır.
5. Vercel Storage'dan **Blob** oluşturun. `BLOB_READ_WRITE_TOKEN` otomatik tanımlanmalıdır.
6. Project → Settings → Environment Variables bölümüne ekleyin:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET` (en az 32+ rastgele karakter)
   - `NEXT_PUBLIC_APP_URL=https://ppwr.acilimkutu.com`
7. Neon SQL Editor'da `db/001_init.sql` dosyasını bir kez çalıştırın.
8. Vercel Project → Domains bölümüne `ppwr.acilimkutu.com` ekleyin.
9. DNS tarafında Vercel'in gösterdiği CNAME/A kaydını sadece `ppwr` subdomainine uygulayın. Ana `acilimkutu.com` DNS kaydını değiştirmeyin.
10. Deploy tamamlanınca `/yonetici` üzerinden ilk PPWR kaydını oluşturun.

## Yayın güvenliği

Bir taslak veya inceleme revizyonu kamu tarafında görünmez. “Bu Revizyonu Yayınla” işlemi yapılınca aynı kaydın önceki yayınlanmış revizyonu atomik SQL işlemiyle `archived` durumuna alınır ve yeni revizyon `published` olur.

## Yönetici veri alanları

Kayıt kodu; PPWR ID ve Declaration ID; Açılım iş kodu; müşteri; müşteri referansı; sistem kodu; ithalatçı; ürün/ambalaj adı; ambalaj sınıfı/tipi; kullanım amacı; tek/çok kullanımlık; toplam ağırlık; üretim tesisi; ölçüler; net alan; komponentler; malzeme bileşimi; PPWR durumları; iki PDF; ürün/CAD görseli; hazırlayan/kontrol eden/onaylayan ve inceleme tarihi.
