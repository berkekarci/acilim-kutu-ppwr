# Açılım Kutu PPWR Portalı

Bu proje, `ppwr.acilimkutu.com` için bağımsız Vercel/Next.js uygulamasıdır. `acilimkutu.com` ana sitesine dokunmaz.

## Sabit mimari

- Kamu kaydı: `https://ppwr.acilimkutu.com/[kod]`
- Yönetici paneli: `https://ppwr.acilimkutu.com/admin`
- Kamu tarafında toplu kayıt listesi **yoktur**.
- Kod uzunluğu sabit değildir. Harf, sayı ve tire kullanılabilir. `/ ? # %` tek segment URL yapısını bozduğu için kabul edilmez.
- Her PPWR kodu tek bir güncel kayıt taşır.
- Yönetici panelindeki değişiklikler `Kaydet ve Yayınla` ile doğrudan kamu sayfasına yansır.
- Ayrı taslak, onay veya revizyon iş akışı yoktur.
- Manuel PDF ve görseller Vercel Blob'da, PPWR kayıt verileri Neon Postgres'te tutulur.
- PPWR Ambalaj Kimlik ve Teknik Bilgi PDF'i güncel kayıt verilerinden otomatik üretilir; ayrı dosya yüklemek gerekmez.
- Yönetici girişi ChatGPT/OpenAI hesabından bağımsızdır.

## Vercel kurulumu

1. GitHub deposunu Vercel projesine bağlayın.
2. Neon Postgres bağlantısını tanımlayın.
3. Vercel Blob depolamasını bağlayın.
4. Environment Variables bölümünde `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` ve `NEXT_PUBLIC_APP_URL=https://ppwr.acilimkutu.com` tanımlı olmalıdır.
5. `ppwr.acilimkutu.com` alan adı yalnızca bu Vercel projesine yönlendirilmelidir.

## Yayın mantığı

Yeni PPWR kaydı oluşturulduğunda kamu sayfası oluşur. Yönetici ekranındaki bilgiler güncellendiğinde `Kaydet ve Yayınla` işlemi mevcut kaydı doğrudan günceller. Kamu URL'si her zaman tek güncel kayıt verisini gösterir.

## Yönetici veri alanları

PPWR ID ve otomatik Declaration ID; Açılım iş kodu; müşteri; sistem kodu; ürün/ambalaj adı; ambalaj sınıfı ve tipi; geri dönüşüm sınıfı; otomatik toplam ağırlık; üretim tesisi; en × boy × yükseklik; net alan; otomatik malzeme bileşimi; PDF belgeleri; ürün/CAD görseli ve inceleme tarihi.
