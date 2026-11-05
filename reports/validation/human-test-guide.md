# Gerçek oyuncu testi: henüz yapılmadı

Bu dosya test planıdır; insan oyuncu sonucu içermez. Simülasyon kazanma oranlarından insanlara karşı kazanma oranı çıkarılmaz. Otomatik telemetri veya arkadaşlara mesaj gönderimi eklenmemiştir.

## İlk tur

- Bir insan + üç Orta botla 3 tam maç, ardından bir insan + üç Zor botla 3 tam maç.
- Sonra iki insan + iki botla 3'er tam maç. Aynı kişinin bütün koltukları kullanmasına çalışın.
- Kuralları değiştirmeyin. “Skor >=0” başarısını ve gerçek birinciliği ayrı kaydedin.
- Bu kısa seri istatistiksel güç kanıtı değildir; beklenmedik hamle bulma turudur.

## Şüpheli hamle notu

| Alan | Kaydedilecek bilgi |
|---|---|
| Oturum | Tarih, zorluk, insan/bot sayısı |
| Konum | Maçtaki oyun numarası, sözleşme, el numarası, bot koltuğu |
| Açık durum | Oynanmış kartlar, bilinen void'ler, masadaki kartlar, skorlar |
| Karar | Oynanan kart, neden tuhaf/çok bilen göründüğü, beklenen alternatif |
| Kanıt | İsteğe bağlı ekran kaydı/görüntüsü; kişisel bilgileri çıkarın |

Rakiplerin oyun sürerken gizli ellerini açmayın. Yalnız bir tahminin doğru çıkması hile göstergesi değildir. Gerçek gizli eller yerine kendi elini ve açık masayı kullanan gözlem sınırı testlerle ayrıca korunmaktadır. Bir kararı tekrar oynatmak için o anda yasal olan kartlar ve açık kart geçmişi gereklidir.

## Değerlendirme

Birden çok kişinin aynı tip hamleyi işaretlemesi durumunda önce açık bilgilerle mantıklı açıklaması olup olmadığını inceleyin; ardından sabit birim testi oluşturun. Strateji değişirse yeni, görülmemiş tohumlarla tekrar ölçün. Kişisel tercihi veya küçük bir seriyi güç artışı diye raporlamayın.

## Başlangıç koşulu notu

Yalıtılmış kart politikası simülasyonu ile masanın gerçek dağıtım/sözleşme akışını karıştırmayın. Özellikle Rıfkı seçiminde tek kupa papazı/as için yeniden dağıtım, gerçek oyunda uygulanır. Yeni sözleşme simülasyonu bu başlangıç koşulunu da sağlar; önceki sabit-sözleşme tablosunun birebir yeniden üretimi ayrıca işaretlenir.
