# Yol Haritası

Bu proje; tek dosya SPA (index.html), GitHub JSON kalıcılığı ve “Hasta Modu” hedef/dağılım motoru temelinde ilerliyor. Aşağıda kısa/orta vadeli plan ve her adım için kabul kriterleri yer alır.

## Şimdi (0–2 hafta)

1) Hedefleri tabloya uygula (quick actions)
- Gün/öğün başlıklarına hızlı butonlar: kcal, C/P/F hedefini ilgili satır/sütuna doldur.
- Dağılım mevcut öğünlere göre re-normalize edilerek uygulanır.
- Geri al (undo) seçeneği ve basit biçimlendirme (örn: 1 ondalık, birim).
- Kabul: Bir günde sadece 2 öğün varsa, toplam hedefin %100’ü bu iki öğüne doğru şekilde paylaşılarak tabloya yazılabiliyor.

2) Diyet tipi şeması + haftaya bağlama
- diet-types.json: makro katsayıları, notlar/kısıtlar, etiketler.
- Haftalık plan için diyet tipi seçimi; hesaplamalara yansıma.
- UI: Haftayı/dönemi seçerken diyet tipi dropdown.
- Kabul: Haftanın diyet tipi değiştiğinde rozet ve popover hedefleri anında güncellenir.

3) “Yemek Adı” akıllı tamamlama (temel)
- Yerel + GitHub JSON gıda listesi; basit fuzzy arama.
- Klavye ile gezinme, “sonuç yok” boşdurumları.
- Kabul: 3 karakter yazınca alakalı 5–10 öneri döner; Enter ile hücreye işler.

4) GitHub kalıcılık sağlamlaştırma (temel)
- 409/422 için SHA tazeleme ve otomatik yeniden deneme.
- Oran sınırlama/backoff mesajları; offline mod için kuyruklama uyarısı.
- Kabul: Ağ kesintisi sonrası yeniden bağlanınca bekleyen 1 dosya sorunsuz kaydedilir veya kullanıcıya net uyarı verilir.

5) UX küçük rötuşlar
- Popover’da “öğün bulunamadı” mesajı (gerekirse).
- Sayı biçimleri tutarlılığı (kcal, g; 0/1 ondalık).
- Kabul: Popover ve tablo değerleri tutarlı birim ve ondalıkla görünür.

## Sıradaki (2–4 hafta)

6) Şablonlar ve arşiv
- Öğün/hafta şablonları, etiketler ve sürümler; uygula/geri al akışı.
- Arşivle/geri yükle; GitHub JSON kalıcılığı.
- Kabul: Bir haftaya kayıtlı şablonu tek tıkla uygulayıp geri alabiliyorum.

7) Minimal test düzeneği
- Tarayıcı içi hafif test koşucu.
- Testler: calcTargets, renormalizeDistributionForKeys, başlık tespiti.
- Kabul: Testler yerelde tek tıkla çalışıyor ve yeşil.

8) Erişilebilirlik ve i18n
- Popover/modal/otomatik tamamlama için klavye kullanılabilirliği, ARIA etiketleri.
- Metinlerin tutarlı Türkçe kopyası; çok dillilik için hazırlık.
- Kabul: Temel akışlar sadece klavye ile tamamlanabiliyor.

9) Yerel geliştirme rehberi (Windows)
- VS Code Live Server / npx http-server alternatifleri; GitHub API CORS notları.
- SSS ve sorun giderme.
- Kabul: Yeni bir kurulumda 5 dakikada çalışır hale gelme.

## Sonra (1–2 ay)

10) Veri şeması versiyonlama
- settings, templates vb. için semver; geçiş/migrasyon yardımcıları.
- Kabul: Eski sürüm veriler sorunsuz yükseltiliyor veya uyarıyla dönüştürülüyor.

11) Telemetri ve log konsolu (opsiyonel)
- İstek/yanıt ve kritik akışlar için uygulama içi log paneli.
- Kullanıcı kapatıp açabilir; PII içermez.
- Kabul: Hata anında kısayolla log açılıp kök neden görülebiliyor.

12) Performans ve ölçeklenebilirlik
- Büyük hafta/tablo verilerinde render optimizasyonu.
- Kabul: 10× satırda dahi etkileşim gecikmesi hissedilir biçimde azalır.

---

Öncelik önerisi: 1 → 2 → 3 → 4 → 5, ardından 6 ve 7. Gerektiğinde sırayı birlikte güncelleyebiliriz.
