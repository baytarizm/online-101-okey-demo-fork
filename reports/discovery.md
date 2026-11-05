# King / Rıfkı bot keşfi

Kaynak başlangıcı: `6c2e3c4aa157cfab73f12ddea8cc1e93c3473b16` (`baytarizm/online-101-okey-demo-fork`). Dil JavaScript, CommonJS sunucu modülleri, Node.js >=22; Express 4 ve Socket.IO 4. Tarayıcı istemcisi standart HTML/CSS/JavaScript.

- `server/king.js`: deste, dağıtım, seçenekler, legal kartlar, puan ve eski bot kararları.
- `server/index.js`: masalar, Socket.IO, sıra zamanlayıcısı, otomatik oyuncu hamlesi ve isteğe bağlı checkpoint.
- `public/js/king.js`, `public/css/king.css`: mevcut masa arayüzü.
- `test/king.test.js`, `test/server.test.js`: kural ve gerçek socket testleri.

## Koddan çıkarılan kurallar

| Oyun | Birim puan | Toplam birim |
|---|---:|---:|
| El almaz | −50/el | 13 |
| Kupa almaz | −30/kupa | 13 |
| Kız almaz | −100/kız | 4 |
| Erkek almaz | −60/vale veya papaz | 8 |
| Rıfkı | −320/kupa papazı | 1 |
| Son iki | −180/son iki elin her biri | 2 |
| Koz | +50/el | 13 |

Dört oyuncu, 52 kart, 13'er kart, 20 sözleşme. Seçici `round % 4`; herkesin ilk seçimi ceza. Kişi başına üç ceza/iki koz; masada her ceza iki defa. Kozda dört renk seçilebilir. Eli alan sonraki eli açar. Renk takibi, renk yokken zorunlu ceza/koz, mümkünken koz yükseltme, büyük kart altına aynı renkten cezalı kartı bırakma kuralları `legal()` tarafından uygulanır. Kupa/Rıfkıda kupa, kozda koz kırılmadan açılamaz; yalnız o renk kaldıysa istisna. Rıfkı/kupa ası tek kupa ise Rıfkı seçilince tekrar dağıtılır. Bütün ceza birimleri toplanınca sözleşme erken tamamlanır. 0 ve üzeri herkes kazanır; King ilanıyla maçın erken bitişi yoktur.

Akış: `choosing → playing → trick → playing / roundEnd → choosing`; 20 sözleşme sonunda `finished`. Masa sahibi sözleşmeler arasında devam eder. Bağlantı kaybında oyun duraklar. Süre dolan insanın otomatik hamlesi de aynı kurallara uyar.

## Başlangıç botu

Rastgele değil, çok basit kural tabanlıdır. Ceza oyununda düşük kartla açar; kaybedebildiği elde cezalı/yüksek kartı bırakır; zorunlu kazanacaksa küçüğünü oynar. Kozda anlık kazanabilecek en küçük kartı seçer; açılışta en büyük kartını kullanır. Oyun seçimi kaba yüksek kart/cezalı kart sayımıdır. Geçmiş kart, void, rakip olasılığı, zaman bütçeli arama ve zorluk seviyesi yoktur.

Kart kararına kısıtlı görünüm verilse de eski sözleşme seçicisi bütün oyun nesnesini kabul ediyordu. Yeni bot sınırı yalnız kendi elini ve kamuya açık durumu taşır. Rakip kart değerleri okunamaz; bu durum Proxy ve gizli ellerin yerini değiştirerek test edilir.
