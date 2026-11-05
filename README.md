# Yazboz · King / Rıfkı

Botlarla veya davet koduyla dört kişilik çevrim içi King. Bu sürüm eski Eşli 101 oyununu değiştirir; eski motor, istemci ve taş varlıkları kaldırılmıştır. Mevcut Render hizmetinin URL'si uyumluluk için aynıdır.

## Çalıştırma

Node.js 22+; `npm ci`, `npm test`, `npm start`. PORT varsayılan 3000, sağlık adresi `/health`. Tek Node süreci / tek sunucu örneği kullanılmalıdır. Socket.IO masa ve kart durumunu sunucuda yönetir; her istemci yalnız kendi elini görür.

## Masa kuralları

52 kart, 4 oyuncu, herkese 13 kart. Toplam 20 oyun; her oyuncu sırayla 3 ceza ve 2 koz seçer. İlk seçim zorunlu cezadır. Her ceza masada iki kez oynanır. El Almaz −50/el; Kupa −30/kupa; Kız −100/kız; Erkek −60/vale ve papaz; Rıfkı −320/kupa papazı; Son İki −180/son iki elin her biri; Koz +50/el. Maç sonunda 0 ve üzerinde herkes kazanır; puana göre sıralanır. King ilanıyla erken bitiş uygulanmaz.

Renk takibi zorunlu. Ceza oyununda renk yoksa cezalı kart atılır. Yerde daha büyük kart varsa aynı rengin cezalı kartı düşürülür. Rıfkıda renk yoksa öncelik kupa papazı, sonra kupadır. Kupa/Rıfkıda kupa kırılmadan kupa açılamaz; yalnız kupa kalırsa açılabilir. Rıfkı veya kupa ası tek kupaysa Rıfkı seçildiğinde yeniden dağıtılır. Kozda renk yoksa koz atılır; mümkünse koz yükseltilir. Koz kırılmadan koz açılamaz; yalnız koz kalırsa açılır. Tüm cezalı kartlar toplanınca o oyun tamamlanır. Sonraki oyuna masa sahibi geçer.

Kart sırası ekranda kendi koltuğunuzdan sol, karşı ve sağ koltuğa geçer. Eli alan yeni eli açar. 30 saniye içinde seçim/kart oynanmazsa yasal otomatik hamle yapılır. Botlar yalnız kendi elleri ile açık masa bilgilerini kullanır; stratejileri basit sezgiseldir.

Kaynaklar: https://play.google.com/store/apps/details?id=net.gamyun.android.king&hl=tr ve https://zipi.games/tr/kurallar/king/ . İlk seçim, skorlar, kazanma ve erken bitiş kuralları mevcut Yazboz `engine.js` ile uyumludur.

## Bağlantı ve kayıt

Masaya davet koduyla katılınır. Masa sahibi boş yerleri botlarla doldurabilir. Oyun başladıktan sonra koltuklar sabittir. Bağlantı kesilince oyun duraklar. Oturum anahtarı tarayıcıda saklanır; aynı tarayıcıdan yeniden açılınca koltuğa dönülür. Başka cihaza otomatik oturum aktarımı yoktur.

Masalar varsayılan RAM'dedir: yeniden başlatma/ücretsiz Render uykusu masaları kaybettirebilir. Var olan kalıcı bir disk kullanılıyorsa `STATE_FILE` mutlak dosya yoluyla atomik checkpoint açılır; bu değişiklik ücretli kaynak oluşturmaz. Bağlantısız masalar 30 dakika sonra temizlenir. Sadece King kayıtları yüklenir; eski 101 checkpoint'leri okunmaz. Oturum anahtarları sunucuda SHA-256 olarak saklanır.

`YAZBOZ_ORIGIN` varsayılan `https://yazbozhaysag.vercel.app`; CSP iframe çerçevelemeyi bu adrese açar.

## Doğrulama

`npm test`: legal kart, renk/koz/ceza zorunlulukları, Rıfkı erken bitişi, 100 tam maçta kota ve toplam puan, dört gerçek Socket.IO istemcisi, özel eller, sıra kontrolü, duraklama/geri dönüş ve bot ilerlemesi.

## Bot zekâsı ve zorluk seviyeleri

Botlar `server/bots/` altında oyun motorundan ayrıdır. `view.js` tek veri sınırıdır: botlara sadece kendi eli, açık kart geçmişi, kalan kart adetleri, skor ve seçim hakları verilir. Rakip elleri bu sınırdan geçmez. `king.js` motorunun dağıtım, legal hamle, puan ve sözleşme kuralları korunur; sadece kamuya açık hamle günlüğü eklenir.

- **Kolay:** geçmiş kart/void takibi sınırlı; %35 olasılıkla rastgele **yasal** seçim. Rastgele seçim her zaman kötü hamle demek değildir.
- **Orta (varsayılan):** tam açık kart/void takibi, yaklaşık kart-sahipliği olasılıkları, sözleşmeye özel risk, güvenli kart boşaltma, Rıfkı koruma/sıkıştırma, Son İki için küçük kart rezervi, koz sayımı ve uzun renk.
- **Zor:** aynı bilgi sınırı ve sezgiseller + void ve kart adetlerine uygun rastgele dağıtımlarda bütün adayları sözleşme sonuna kadar oynatan Monte Carlo araması. İlk sezgisel değerlendirmeye küçük bir öncelik ağırlığı verilir.

Masa sahibi ana ekrandaki **Bot zorluğu** alanından seviyeyi seçer; çevrim içi masanın boş koltuklarına eklenecek botlar da bu seviyeyi kullanır. Masa başladıktan sonra seviye değiştirilmez. Oturum dönüşünde seçim korunur.

Zor seviye varsayılanı 24 dağıtım ve 35 ms hesap hedefidir. `BOT_MC_SAMPLES` (0–256), `BOT_MC_BUDGET_MS` (0–100 ms) sunucu ortamından ayarlanabilir. `BOT_DIFFICULTY` sunucu varsayılanıdır; mevcut istemci Orta seviyeyi önseçili gönderir. Kimliği doğrulanmamış istemci hesap bütçesini genişletemez.

Arama sunucuda varsayılan olarak tek paylaşılan worker thread içinde çalışır. `BOT_WORKERS` 1–2 arasında sınırlıdır; varsayılan 1 korunur. İki worker seçimi, dağıtım yapılan makinede ayrıca yük ölçümü gerektirir. Yeni zor masada iş parçacığı önceden ısıtılır. Worker meşgulse sınırsız kuyruk oluşturulmaz; o hamlede sezgisel politika kullanılır. Hesap hedefini aşan iş için 120 ms ek watchdog payı vardır; hata, zaman aşımı veya geçersiz sonuçta yasal sezgisel hamleye dönülür. Sunucu eski sıra için gelen sonucu uygulatmaz. İşletim sistemi/GC duraklamaları nedeniyle bu hedefler gerçek zaman garantisi değildir.

Olasılıklar IPF ile yaklaşık normalize edilir; determinize edilmiş dağılımlar void ve kalan kart sayısını tam sağlar, fakat bütün geçerli dağılımlar üzerinde tam uniform örnekleme garantisi vermez. Arama, kusursuz oyunu veya insanlara karşı belirli bir kazanma oranını garanti etmez. Eski checkpoint'te açık kart geçmişi eksikse o sözleşmede arama güvenli sezgisel seçime döner; sonraki dağıtımda tam takip başlar.

### Tekrarlanabilir ölçüm

```bash
npm test
npm run bots:arena -- --matches 60 --seed 3001 --candidate hard --opponent legacy --samples 12 --fixed-samples true --out reports/example.json
npm run bots:arena -- --matches 60 --seed 3001 --candidate medium --opponent random
node scripts/bot-contract-arena.js 300 reports/fixed-contracts.json
npm run bots:perf -- reports/performance.json
```

Arena, bir yeni botu üç eski/rastgele bota karşı, aynı dağıtım tohumları ve dönüşümlü koltuklarla 20 oyunluk tam maçlarda değerlendirir. Önceki bot `legacy.js` içinde dondurulmuştur. Skor, toplam ceza, gerçek maç kazanma oranı (>=0), yasadışı hamle ve hamle süreleri raporlanır. Aynı dağıtım çiftlerinin puan farkı için yaklaşık %95 güven aralığı hesaplanır. Rakiplerin ve adayın rastgele sayı akışları ayrıdır.

`--fixed-samples true` güç kıyasını tekrar üretmek için süre kesmesini kapatır; yalnız bu çevrimdışı testte örnek sayısı sabittir. Canlı uygulama bu modu kabul etmez ve zaman bütçesini uygular. Zaman sınırına bağlı kıyaslar makinenin yüküne göre farklı sayıda örnek tamamlayabilir. Performans testi üretim zaman bütçesini ayrıca ölçer. Telefon üzerinde fiziksel performans ölçümü yapılmamıştır; hesaplama zaten sunucudadır. Dört kat daraltılmış hesap payı yalnız stres yaklaşımıdır.

Aşama raporları, keşif ve sonuçlar: [reports/bot-report.md](reports/bot-report.md).

## İkinci doğrulama ve yük araçları

Doğrudan seviye kıyasları, birincilik ve skor >=0 başarısının ayrımı, sözleşme güven aralıkları ve yük sınırları [ikinci raporda](reports/validation/report.md).

```bash
node scripts/bot-validation.js
node scripts/bot-contract-confidence.js
node scripts/bot-load.js
node scripts/bot-socket-load.js
```

İlk komut beş senaryoda 200'er tam maç çalıştırır ve uzun sürebilir. Güç kıyasıyla yük testini eşzamanlı çalıştırmayın. Raporlar eski ölçüm dosyalarını yeniden kullanabilir; yeni politika ölçümü için ayrı plan/tohumlar ve yeni çıktı dizini gerekir. İlk rapordaki 60 maçlık seriler geliştirme geçmişidir; insan oyuncu kanıtı değildir.

Canlı uygulamanın kabul sınırı 100 masa, IP başına 10 masadır. Socket yük aracı yalnız kendi yerel sunucusunun kabul sınırını 300'e çıkarır. Canlı sınır veya erişim politikası değişmez. Worker sayaçları yalnız sunucu nesnesindeki `botStats()` erişiminden okunur; yeni bir açık HTTP yolu veya kişisel telemetri yoktur. Sanal karar stresi ile gerçek Socket.IO masa testi ayrı raporlanır. Yerel testin CPU/belleği Render hizmetiyle eşdeğer sayılmaz.
