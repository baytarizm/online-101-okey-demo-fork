# King / Rıfkı: ikinci doğrulama

5 Kasım 2026. Bu çalışma bot karar politikasını değiştirmez; önceki raporun eksik kıyaslarını ve belirsizliklerini tamamlar. **İnsan oyuncu testi yapılmamıştır.** [Test planı](human-test-guide.md).

## Sabit plan ve kaynak

- Kaynak politika: `fbcd904e53d4760f83a3857898d1fef4c3ce2ef0`. Dokuz karar/kural dosyasının SHA-256 özeti `817b4f53a513091bab2b15477e75d1558be5d0c5430ba66ecf385187747a4000`; dosyalar bu kaynakla birebir eşleşiyor.
- [Plan](plan.json): her senaryoda **200 tam maç**, beş senaryo, toplam **1.000 maç / 20.000 sözleşme**. Tohumlar 48001–48200; önceki geliştirme serilerinden ayrıdır. Her maç bağımsız bir dağıtım tohumudur; koltuklar dönüşümlüdür. Senaryolar aynı tohumları kullanır; eşlenik fark bu ortaklığı korur.
- Üretim ayarı: 24 örnek üst sınırı / 35 ms hesap hedefi; sabit örnek modu kapalı. Hesapta süre sınırı vardır; OS yükü tamamlanan örnek sayısını ve tam tekrar üretilebilirliği etkiler.
- Skor, skor >=0 başarısı, paylaşımlı birincilik (beraberlikte 1/k pay), tek başına birincilik ve ortalama sıra ayrı ölçülür. **Skor >=0, birincilik değildir.**
- %95 aralıklar 2.000 tekrar ile tam maç bazında yüzdelik bootstrap'tır; aynı masadaki farklar aynı maç içinde eşleniktir. Bunlar yaklaşık belirsizlik aralıklarıdır.

## Ortak rakip havuzu: bir aday + üç Orta bot

| Aday | Maç | Ortalama puan (%95 GA) | Tek başına birincilik (%95 GA) | Paylaşımlı birincilik | Skor >=0 | Ortalama sıra |
|---|---:|---|---|---:|---:|---:|
| Eski | 200 | -422,1 [-487,1; -352,3] | 7,0% [3,5%; 10,5%] | 7,5% | 20,5% | 3,3 |
| Kolay | 200 | -710,5 [-775,3; -647,0] | 1,5% [0,0%; 3,5%] | 1,5% | 6,0% | 3,7 |
| Orta | 200 | -8,3 [-72,2; 57,8] | 22,0% [16,5%; 28,0%] | 22,3% | 51,5% | 2,5 |
| Zor | 200 | 390,1 [330,9; 448,6] | 57,0% [50,0%; 64,0%] | 57,3% | 82,0% | 1,7 |

Aynı tohumlarda adayın Orta yerine Zor olmasıyla eşlenik puan farkı **398,3**, %95 GA **[344,9; 453,6]**. Bu masa bir Zor + üç Orta karşılaşmasıdır; takım oyunu değildir. Orta/Orta kontrolü aynı seviyede dört oyuncu içerir.

## Karma masa: birer Zor, Orta, Kolay ve eski bot

| Seviye | Maç | Ortalama puan (%95 GA) | Tek başına birincilik (%95 GA) | Paylaşımlı birincilik | Skor >=0 | Ortalama sıra |
|---|---:|---|---|---:|---:|---:|
| Zor | 200 | 648,2 [592,4; 703,5] | 70,0% [63,5%; 76,5%] | 70,0% | 93,5% | 1,4 |
| Orta | 200 | 299,7 [238,1; 357,6] | 26,5% [20,5%; 32,5%] | 26,5% | 75,0% | 2,1 |
| Kolay | 200 | -615,0 [-684,9; -548,8] | 0,5% [0,0%; 1,5%] | 0,5% | 12,0% | 3,5 |
| Eski | 200 | -332,9 [-401,8; -263,7] | 3,0% [1,0%; 5,5%] | 3,0% | 28,5% | 3,1 |

Aynı karma masada Zor−Orta puan farkı **348,5**, %95 GA **[256,6; 444,3]**. Bütün senaryolarda toplam yasadışı hamle: **0**. İnsan gücü veya insanlara karşı kazanma oranı bu veriden çıkarılamaz.

## Önceki sözleşme tablosuna eklenen güven aralıkları

9001–9300 tohumlu eski 300 dağıtım, eski başlangıç koşullarıyla birebir yeniden oluşturuldu. Her satırın eski/yeni ortalaması arşiv JSON'u ile sayısal olarak doğrulandı.

| Sözleşme | Önce | Sonra | Eşlenik fark | %95 GA | Yedi kıyas için düzeltilmiş GA |
|---|---:|---:|---:|---|---|
| El almaz | -152,0 | -135,8 | 16,2 | [9,7; 23,0] | [7,3; 25,3] |
| Kupa almaz | -86,8 | -66,3 | 20,5 | [13,7; 27,6] | [10,8; 29,9] |
| Kız almaz | -95,7 | -74,0 | 21,7 | [13,3; 30,0] | [10,3; 33,0] |
| Erkek almaz | -112,6 | -91,6 | 21,0 | [13,4; 28,8] | [10,4; 31,8] |
| Rıfkı | -67,2 | -45,9 | 21,3 | [9,6; 34,1] | [5,3; 38,4] |
| Son iki | -80,4 | -22,2 | 58,2 | [39,0; 76,8] | [32,4; 83,4] |
| Koz | 162,2 | 165,8 | 3,7 | [1,3; 6,2] | [0,7; 7,2] |

Önceki koz farkı **3,7** için %95 GA **[1,3; 6,2]**. Etki küçük olmakla birlikte, eşlenik tekli aralık pozitiftir; düzeltilmiş aralık da tabloda gösterilir.

Önceki yalıtılmış test, doğrudan sözleşme başlatıyordu; Rıfkı için seçimdeki yeniden dağıtım koşulu bu eski kurulumda uygulanmıyordu. Tarihsel tabloyu değiştirip üstünü örtmek yerine bu kurulum birebir tutuldu. Yeni seri bu koşulu da uygular ve koz rengini koltuktan ayırır.

## Yeni sözleşme serisi

78001–80000 tohumları; her sözleşmede **2.000 eşlenik dağıtım**. Kart politikası karşılaştırması Orta/eskidir; sözleşme seçimi bu yalıtılmış testte sabittir. %95 GA yanında yedi sözleşme için Bonferroni amaçlı yaklaşık %99,286 bootstrap aralığı (10.000 tekrar) verilir. Birden çok kıyasa bakılarak karar verme riski böylece açıkça ele alınır.

| Sözleşme | Önce | Sonra | Fark | %95 GA | Düzeltilmiş GA | Yorum |
|---|---:|---:|---:|---|---|---|
| El almaz | -161,3 | -145,6 | 15,7 | [13,2; 18,3] | [12,4; 19,2] | Düzeltmeden sonra pozitif |
| Kupa almaz | -99,0 | -80,3 | 18,8 | [16,1; 21,4] | [15,1; 22,5] | Düzeltmeden sonra pozitif |
| Kız almaz | -98,3 | -81,7 | 16,6 | [13,4; 19,9] | [12,1; 21,1] | Düzeltmeden sonra pozitif |
| Erkek almaz | -121,1 | -96,7 | 24,4 | [21,5; 27,5] | [20,3; 28,7] | Düzeltmeden sonra pozitif |
| Rıfkı | -78,7 | -59,8 | 18,9 | [13,9; 24,0] | [11,7; 25,9] | Düzeltmeden sonra pozitif |
| Son iki | -89,6 | -19,5 | 70,1 | [63,0; 77,2] | [60,5; 79,8] | Düzeltmeden sonra pozitif |
| Koz | 164,6 | 166,4 | 1,8 | [0,8; 2,9] | [0,4; 3,3] | Düzeltmeden sonra pozitif |

Ham eşlenik kart politikası puanları `contract-*-pairs.csv` dosyalarındadır. Yeni seride iki politika toplam **28.000 sözleşme** oynar. Tarihsel yeniden üretim ayrıca 4.200 sözleşmedir.

## Worker yoğunluğu: karar stresi

Bu test sanal açık gözlemleri gerçek üretim worker sınıfına gönderir ve ayrı bir istemci sürecinden gerçek HTTP sağlık yolunu ölçer. HTTP ölçüm istemcisi sunucunun olay döngüsünden bağımsızdır. “staggered” yükünde her sanal masa üç saniyede bir karar ister; “burst” bütün kararları birlikte yollar. Kartlar erken-el pozisyonlarıdır; tam maçtaki her aşamanın dağılımı değildir.

| Sanal masa | Worker | Yük | İstek | MC tamamlanan | Sezgisel dönüş | Yoğunluk dönüşü | Süre aşımı | HTTP örneği | HTTP p99 ms | Döngü p99 ms | Yasadışı |
|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 50 | 1 | burst | 50 | 2,0% | 98,0% | 49 | 0 | 3 | 56,0 | 67,8 | 0 |
| 50 | 1 | staggered | 168 | 98,8% | 1,2% | 2 | 0 | 327 | 11,9 | 8,8 | 0 |
| 100 | 1 | burst | 100 | 1,0% | 99,0% | 99 | 0 | 2 | 22,3 | 39,9 | 0 |
| 100 | 1 | staggered | 335 | 48,4% | 51,6% | 172 | 0 | 322 | 28,5 | 12,6 | 0 |
| 300 | 1 | burst | 300 | 0,3% | 99,7% | 299 | 0 | 4 | 63,7 | 90,6 | 0 |
| 300 | 1 | staggered | 1002 | 24,7% | 75,3% | 755 | 0 | 323 | 11,6 | 7,4 | 0 |
| 50 | 2 | burst | 50 | 4,0% | 96,0% | 48 | 0 | 3 | 14,1 | 7,1 | 0 |
| 50 | 2 | staggered | 168 | 98,2% | 1,8% | 2 | 0 | 328 | 75,0 | 6,3 | 0 |
| 100 | 2 | burst | 100 | 2,0% | 98,0% | 98 | 0 | 3 | 31,5 | 51,9 | 0 |
| 100 | 2 | staggered | 335 | 99,1% | 0,9% | 3 | 0 | 329 | 6,4 | 6,9 | 0 |
| 300 | 2 | burst | 300 | 0,7% | 99,3% | 298 | 0 | 4 | 59,4 | 87,0 | 0 |
| 300 | 2 | staggered | 1001 | 49,1% | 50,9% | 509 | 0 | 328 | 5,8 | 7,8 | 0 |

İlk denemede HTTP üreticisi sunucuyla aynı süreçteydi; burst gecikmesinin bir kısmını kaçırabildiği için sağlık istemcisi ayrı sürece alındı ve yük testleri yenilendi. İlk JSON dosyaları *-colocated-initial.json adıyla arşivlenir; sonuç tablosu yenilenen ölçümü kullanır. Kısa burst testlerinde HTTP örnek sayısı azdır; bu p99 değerleri tek başına kapasite kanıtı değildir.

“MC tamamlanan” en az bir tam örnek grubuyla dönülen karardır. Sezgisel dönüş oranı yoğunluk, süre aşımı veya tamamlanan örnek olmamasını kapsar. **Düşük HTTP gecikmesi, tüm Zor botların tam arama yapabildiği anlamına gelmez.**

## Gerçek Socket.IO tur yükü

Her masada bir gerçek istemci bağlantısı ve üç Zor bot vardır. Üretimdeki 850 ms bot bekleme süresi korunur. Bütün masalar ilk eli başlatır; ilk elin tamamlanması ölçülür. Bu kısa tur testi uzun süreli dayanıklılık testi değildir.

| Masa / istemci | Tamamlanan ilk el | Oyun hatası | İlk el p95 ms | HTTP p99 ms | Worker arama | Yoğunluk dönüşü | Süre aşımı | RSS artışı MiB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 50 / 50 | 50 | 0 | 2591,8 | 190,3 | 6 | 136 | 0 | 40,7 |
| 100 / 100 | 100 | 0 | 2593,6 | 241,0 | 5 | 275 | 0 | 29,3 |
| 300 / 300 | 300 | 0 | 2836,0 | 528,4 | 12 | 817 | 0 | 44,3 |

Üretim kabul sınırı **100 masa / IP başına 10 masa** olarak korunmuştur. 300 masalık Socket.IO testinde yalnız izole test sunucusunun sınırı yükseltilmiştir. Canlı sunucunun sınırı veya erişim politikası değiştirilmemiştir.

Test makinesi: INTEL(R) XEON(R) PLATINUM 8573C, Node v24.22.1, 8 kullanılabilir CPU; çalışma ortamı 8 GiB bellek sınırına sahiptir. Bu, ücretsiz Render hizmetiyle eşdeğer donanım değildir; **bu sonuçlardan Render'ın 300 masayı desteklediği sonucu çıkarılamaz.** Canlı hizmete yük trafiği gönderilmemiştir.

## Kapasite kararı ve kalan iş

Aralıklı 100 masa yükünde Monte Carlo tamamlanma oranı bir worker ile yaklaşık 48,4%, iki worker ile 99,1% oldu. Aralıklı 300 masada oranlar 24,7% ve 49,1%; iki worker da bütün kararları tam aramayla karşılayamıyor. Eşzamanlı başlatılan 300 gerçek Socket.IO masasında ilk ellerin hepsi tamamlansa da worker isteklerinin yalnız 12/829 kadarı (1,4%) tam aramayla döndü. **Akışın tamamlanması, Zor seviyenin yük altında korunduğunu kanıtlamaz.**

- Varsayılan worker sayısı 1 korunur. `BOT_WORKERS` ile 1–2 arası sınırlı ayar desteklenir; ikinci worker'ın CPU paylaşımı ve gecikmesi dağıtılan makinede ölçülmelidir. Yerel iyileşme bulunsa bile kaynak başına kapasite garantisi verilmez. Yeni ücretli kaynak oluşturulmamıştır.
- Sınırsız iş kuyruğu açılmaz. Yoğunlukta hızlı ve yasal sezgisel dönüş devam eder; bunun güç kaybı artık sayılabilir. Sayaçlar sunucu nesnesindeki `botStats()` üzerinden alınır; yeni bir açık HTTP yolu eklenmemiştir.
- İnsan oyuncu testi tamamlanmadı. Test rehberi hazır; gerçek maç gözlemleri gelmeden “insanları yeniyor” sonucu yoktur.
- Uniform olmayan gizli-el örneklemesi ve basit rollout politikası korunuyor. Yeni kıyas, bu sınırlılıkları ortadan kaldırmaz.
- Yeni strateji denemeleri bu doğrulama tohumlarına göre ayarlanmamalı; yeni plan ve yeni tohumlar ayrılmalı.

43 test başarılı; üretim bağımlılığı denetiminde güvenlik açığı bulunmadı. Hile sınırı, yasal hamleler, ilk seçim/puan kuralları ve bağlantı akışı testleri de geçiyor.

Ham JSON/CSV dosyaları ve araçlar bu raporla aynı commit'te kaydedilir.
