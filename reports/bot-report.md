# King / Rıfkı bot geliştirme sonucu

2026-11-05. Değişiklikler altı ayrı, test edilmiş commit halinde hazırlanmıştır. Oyun kuralları ve puanları değiştirilmemiştir.

## Önce keşif

[Kaynak, yapı, tam kurallar ve başlangıç davranışı](discovery.md).

## Aşamalar ve önce/sonra

1. **Bilgi takibi:** açık kart günlüğü, void çıkarımı, kendi elini/rakip kartlarını ayıran gözlem sınırı ve yaklaşık olasılık tablosu. 15 test; aynı 240 oyunluk seride karar politikası değişmediği için puan farkı 0.
2. **Sezgisel kart skoru:** ilk deneme ortalama maç puanını −46'dan −296,3'e düşürdü. Rakibin yüksek kartı tutmasını, onu oynama zorunluluğuyla karıştıran risk modeli düzeltildi. Aynı 800 oyunda −46 → +177,8; kazanma %50 → %70. 19 test.
3. **Sözleşme seçimi:** elin uzunluğu, kısalığı, void, kontrol kartları, kupa, kalan haklar ve skor değerlendirilir. Aynı seride +177,8 → +260; kazanma %70 → %77,5. 22 test.
4. **Monte Carlo:** her yasal aday aynı örnek dağılımda sözleşme sonuna kadar oynatılır; eksik örnek grubu atılır. 12 örnek/25 ms eğitim ölçümünde +260 → +611,3; kazanma %77,5 → %97,5. İlk en kötü 404 ms ölçümü üzerine üretim araması ayrı worker'a taşındı; zaman aşımı ve iş yoğunluğu için sezgisel geri dönüş eklendi. 27 test.
5. **Zorluk:** Kolay sınırlı geçmiş ve %35 rastgele yasal seçim; Orta tam sezgisel; Zor sezgisel + arama. Zorluk masa başında seçilir, sunucuda doğrulanır. Kolay seviyenin aynı seride −249 puan/%27,5 sonucu bilinçli olarak daha zayıftır; bir iyileşme iddiası değildir. 31 test.
6. **Son doğrulama:** yeni tohumlar, bağımsız rakip rastgele akışları, eşlenik tam maçlar ve sözleşme bazlı kontrol. Kozda Orta seviye kaybı yalıtıldı: aşırı ihtiyatlı takip yerine kazanılabilir eli alma davranışı düzeltildi. Ayrı 300 dağıtımlı kontrolde bütün sözleşmelerin ortalama puanı başlangıçtan yüksek. Sonuçlar aşağıda.

Aşama 1–5 serileri geliştirme ölçümleridir. Nihai güç kıyasları 3001–3060 tohumlarıyla ve dört koltuğa dönüşümlü oturan bir adayın üç rakibe karşı oynadığı 60 tam maçla yapılmıştır. Her maç 20 sözleşmedir. Aşağıdaki beş önce/sonra senaryosu toplam 600 tam maç / **12.000 sözleşme** içerir; arama rollout'ları bu sayıya dahil değildir.

## Son güç kıyası

| Aday | Üç rakip | Önce ort. puan | Sonra ort. puan | Önce kazanma | Sonra kazanma | Önce ceza/maç | Sonra ceza/maç | Yasadışı |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| easy | legacy | -167.8 | -308.2 | 33.3% | 28.3% | 1421.2 | 1431.5 | 0 |
| medium | legacy | -167.8 | 308.2 | 33.3% | 75.0% | 1421.2 | 1013.5 | 0 |
| hard | legacy | -167.8 | 602.5 | 33.3% | 93.3% | 1421.2 | 875.0 | 0 |
| medium | random | 1072.0 | 1272.0 | 100.0% | 100.0% | 743.8 | 513.0 | 0 |
| hard | random | 1072.0 | 1450.2 | 100.0% | 100.0% | 743.8 | 414.0 | 0 |

Kazanma mevcut masa kuralına göre toplam skor >= 0 demektir; bir maçta birden çok kazanan olabilir. Rastgele rakiplerde %100 tavanına ulaşıldığı için iyileşme puan ve ceza üzerinden de değerlendirilmelidir. Bu simülasyon oranları insanlara karşı kazanma oranı değildir.

| Kıyas | Eşlenik puan artışı | Yaklaşık %95 güven aralığı |
|---|---:|---|
| easy / legacy | -140.3 | [-268.4, -12.3] |
| medium / legacy | 476.0 | [368.1, 583.9] |
| hard / legacy | 770.3 | [660.5, 880.2] |
| medium / random | 200.0 | [75.7, 324.3] |
| hard / random | 378.2 | [263.5, 492.8] |

Arama gücü kıyasında 12 örnek ve sabit örnek modu kullanılmıştır. Böylece işletim sistemi yükünün örnek sayısını değiştirmesi önlenmiştir. Bu çevrimdışı mod üretime uygulanmaz; üretim 24 örnek/35 ms hedefi ve watchdog kullanır. Önce/sonra dağıtımları eşleşir; sözleşme seçimi değişirse oynanan sözleşmelerin hangi dağıtıma denk geldiği değişebilir.

## Sözleşme başına yalıtılmış kart politikası

Her sözleşmede 9001–9300 tohumlarıyla aynı 300 dağıtım, tek yeni Orta bot/üç eski bot. Oyun seçimi bu ölçümde sabittir. İki politika toplam **4.200 ek sözleşme** oynar.

| Sözleşme | Eski ort. puan | Yeni Orta | Fark |
|---|---:|---:|---:|
| el | -152.0 | -135.8 | 16.2 |
| kupa | -86.8 | -66.3 | 20.5 |
| kiz | -95.7 | -74.0 | 21.7 |
| erkek | -112.6 | -91.6 | 21.0 |
| rifki | -67.2 | -45.9 | 21.3 |
| son | -80.4 | -22.2 | 58.2 |
| koz | 162.2 | 165.8 | 3.7 |

## Performans

Node v24.22.1, INTEL(R) XEON(R) PLATINUM 8573C, Linux. 38 üretim bütçeli arama ölçümü: medyan **35.0 ms**, p95 **36.1 ms**, en yüksek **41.6 ms**. Ortalama 18.4 tamamlanan örnek. Worker için 19 hamlede en yüksek toplam süre 43.4 ms; ana sunucu döngüsü 225 heartbeat üretebildi.

Dört kat daraltılmış hesap payında p95 9.4 ms, ortalama 9.5 örnek. Bu gerçek telefon ölçümü değildir. Hesap zaten sunucuda çalışır; fiziksel mobil cihaz testi yapılmamıştır. Süre hedefi işbirlikçi kontrol edilir; OS/GC duraklamaları aşabilir. Worker hatası, aşım veya başka masanın aramasıyla çakışmada yasal sezgisel hamleye dönülür.

## Doğrulama

36 test başarılı; sunucu/istemci sözdizimi ve git diff kontrolleri temiz. Üretim bağımlılığı denetiminde 0 güvenlik açığı.

## Gizlilik, kurallar ve sınırlar

- Gerçek rakip elleri bot modülüne veya worker'a gönderilmez. Proxy testi rakip kartı okumayı yasaklar; rakip ellerinin yerini değiştirince gözlem ve sabit tohumlu karar değişmez.
- Simülasyondaki rakip elleri sadece gözlenen bilgilerden üretilen varsayımsal ellerdir. Rollout oyuncusu da sadece kendi simüle edilmiş elini ve açık masayı görür.
- Oynanan kartlar tekilleştirilir; dağıtımda günlük sıfırlanır. Void'lerde olasılık 0'dır. Örnek dağıtım her oyuncunun kalan kart sayısını tam sağlar.
- IPF tablosu yaklaşık marjinal dağılımdır; rastgele eşleme bütün geçerli dağılımlardan uniform örnekleme garantisi vermez. Eksik/eski checkpoint bilgisinde sezgisel geri dönüş vardır.
- Testler kural motorunun legal kart filtresini kullanır; gerçek socket akışı, yeniden bağlantı, worker hatası/yoğunluğu ve zorluk kalıcılığı ayrıca kontrol edilir.
- Yerel tarayıcıda Zor seçimi, masa açılışı ve bot ilerlemesi kontrol edildi. Masa düzeni korunmuştur; yalnız zorluk seçimi eklenmiştir.

## Sonraki ölçülebilir adımlar

1. İnsan oyunculara karşı anonim ve isteğe bağlı oyun içi ölçümle strateji açıklarını incelemek.
2. Uniform örneklemeye yaklaşmak ve zorunlu ceza kartı bırakma gibi ek açık davranışlardan daha güçlü çıkarım yapmak.
3. Eşzamanlı masa sayısı yükseldiğinde worker yoğunluğunu ölçüp kapasiteyi buna göre ayarlamak.

Ham JSON dosyaları ve çalıştırma komutları aynı dizinde/README'dedir; aşama commit'leri bağımsız geri alınabilir.
