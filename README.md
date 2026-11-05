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
