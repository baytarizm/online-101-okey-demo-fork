# HAYSAG OKEY · Online 101

Davet koduyla dört kişilik özel masalar. Yazboz içinden açılmak üzere hazırlanmıştır.

Kaynak: [boradmir/online-101-okey-demo](https://github.com/boradmir/online-101-okey-demo), Bora. Orijinal README `UPSTREAM_README.md` dosyasında korunmuştur. Fork, upstream'in taş oluşturma/dağıtma ve puanlama motorunu kullanır; lobi, oyun arayüzü ve Socket.IO hamle katmanı HAYSAG için yenilenmiştir.

## Çalıştırma

Node.js 22+ (üretim imajı Node 24).

```sh
npm ci
npm test
npm start
```

`http://localhost:3000` adresinde masa kurun; davet bağlantısıyla üç farklı sekmeden/cihazdan katılın. Dördüncü oyuncu geldiğinde oyun başlar. `/health` sağlık kontrolüdür. Geliştirme komutu `--port` parametresini destekler.

## Oynanış

- İsim yazın, yeni masa kurun veya altı karakterlik davet koduyla katılın.
- Eşli, katlamalı ve işler taş cezası masa kurulurken belirlenir.
- Taşlara dokunarak seçin; “Seçilenleri grupla” ile seri/per veya çift hazırlayın. Hazırlanan gruba dokunarak geri alın. “El aç” bütün grupları sunucuya gönderir.
- İlk normal açılış en az 101, çift açılış en az 5 çifttir. Katlamalı masada sonraki normal açılış önceki puandan yüksek olmalıdır.
- Açtıktan sonra aynı türde yeni gruplar indirebilirsiniz. Tek taş seçip masadaki seri/pere dokunarak işleyebilirsiniz. Çift açan oyuncu bir turda en fazla iki taş işler. Çift gruplarına üçüncü taş eklenmez.
- Sıranızda önce ortadan/solunuzdan çekin, sonra tek taş seçip atın. Yerden aldığınız taşı ilk açılışta kullanmanız gerekir. Bir atış taşı bırakın; son taşı atınca el biter.
- Normal bitiş −101, okey veya çift bitiş −202, çift ve okey bitişi −404. Diğer puanlar upstream'in `calculatePoints` kurallarıdır. Elden bitiş için ayrı çarpan bu sürümde uygulanmaz. Yığın bitince el puansız kapanır. Yazboz’un manuel 100 puan “Bitti” indirimi ayrı özelliktir; online masayla karıştırılmaz.
- Skorlar masada elden ele toplanır. Yeni eli masa sahibi dört kişi bağlıyken başlatır.
- Sohbet, para/bahis veya herkese açık eşleştirme yoktur.

## Güvenlik ve bağlantı

Sunucu taş sahipliğini, sıra ve çekme aşamasını, grup geçerliliğini ve açılış puanını doğrular. İstemcinin gönderdiği puan veya taş nesnesine güvenilmez. Her oyuncuya yalnızca kendi eli ve masanın açık bilgisi gönderilir. El bitince sonuçta kalan eller görünür.

Yeniden bağlanma isimle değil, tahmin edilemez sekme oturum anahtarıyla yapılır. Sunucu yalnızca anahtar özetini tutar. Anahtar `sessionStorage` içindedir; başka cihaza otomatik taşınmaz. Oyun sırasında ayrılan oyuncunun sandalyesi ve indeksleri korunur; dönene kadar hamleler bekletilir. Lobi sandalyeleri bağlantı kesildikten iki dakika sonra boşalır. Herkes ayrıldıktan 30 dakika sonra masa temizlenir.

WebSocket yük sınırı ve bağlantı başına hamle sınırı vardır. Bu özel arkadaş masası sürümüdür; geniş halka açık servis için hesaplı kimlik, kötüye kullanım izleme ve işletim kontrolleri ayrıca gerekir.

## Yayın

`render.yaml`, ücretsiz ve tek örnekli Node servisi tarifidir. Ücretli plan veya disk otomatik açılmaz. Render hesabında bu repo üzerinden Blueprint oluşturup yayımlanabilir; Dockerfile ile tek bir Node hostunda da çalışır. Render'ın canlı URL'si ancak deployment sonrası belli olur.

**Tek örnek/tek süreç kullanın.** Oyun durumu varsayılan olarak RAM'dedir. Sunucu uyutulursa, yeniden başlatılırsa veya yeniden deploy edilirse aktif masalar kaybolur. Bunun korunması istenirse kalıcı disk bağlayıp `STATE_FILE` verin; örneğin `/app/data/rooms.json`. Bu dosya eller ve oturum anahtarı özetleri içerir; herkese açık dizinde tutulmamalıdır. Checkpoint, her hamlede atomik dosya değişimiyle yazılır. Çok örnekli dağıtım için paylaşılan durum/depolama ve dağıtık kilit/iletişim katmanı gerekir.

Vercel WebSocket desteklese de bu tek süreç mimarisi Vercel Functions'a olduğu gibi yayınlanmamalıdır: bağlantılar farklı örneklere gidebilir. Bu yüzden bu repoda yanıltıcı bir Vercel yapılandırması yoktur.

## Yazboz bağlantısı

Yazboz `HAYSAG_OKEY_URL` build değişkenine canlı sunucunun HTTPS adresi verilir. `YAZBOZ_ORIGIN` varsayılanı `https://yazbozhaysag.vercel.app` olup iframe için izin verilen üst sayfadır. Yazboz alan adı değişirse bunu da güncelleyin. Oyunun “Yazboz’a dön” bağlantısı aynı adrese gider.

## Lisans durumu

Upstream README’de MIT rozeti, package.json’da ISC tanımı var; upstream ayrı LICENSE dosyası sağlamıyor. Bunlardan birini seçip yeni bir izin beyanı üretmedik. `package.json` içindeki upstream ISC bilgisi ve kaynak atfı korundu. Yeniden dağıtım/ticari kullanım koşulları upstream yazarından netleştirilmelidir. Görsel varlıklar için de upstream tarafından ayrıca bir izin metni verilmemiştir; HAYSAG arayüzü portre fotoğraflarını kullanmaz.

## Doğrulama

`npm test`: gerçek Socket.IO istemcileriyle dört oyuncu, ayrı masa izolasyonu, taş gizliliği, sıra/çekme kontrolü, sahte taş/puan ve tekrar ID reddi, token ile dönüş, taş korunumları, çift açılış/bitiş, checkpoint geri yükleme ve HTTP kontrolleri. Testler, bütün olası 101 kural varyantlarının onaylandığı anlamına gelmez.

## Hayvan Sağlığı görsel teması

- Taşlar masaüstünde 42 × 62 px, mobilde ekran genişliğine göre en az 28 px genişlikte ve yaklaşık 2:3 oranındadır. Izgara 11 sütun ve iki satırdır; taşlar ekran boyunca yatay esnemez. Renge/sayıya dizme soldan sağa ilerler.
- `public/asset/animal-health-lounge.webp`: bu proje için yerleşik ImageGen ile üretilen 1536 × 1024 px ambiyans görselinin 146 KB WebP sürümü. Kısa üretim özeti: sığır/koyun/keçi/kanatlı duvar panoları, stetoskop ve saha defteri, ahşap ve pirinç ayrıntılar, çaylı sıcak veteriner kahvehanesi; oyun üstüne bineceği için orta alan sakin ve koyu yeşil, görsel üzerinde yazı veya oyun arayüzü yok.
- `public/asset/animal-health-mark.svg`: özgün sığır, koyun ve kanatlı çizgisel masa filigranı. Resmî kurum logosu değildir.
- Masa ve lobi aynı ambiyansı kullanır. Taşlar, sayılar, düğmeler ve tüm oyun bilgileri gerçek HTML/CSS olarak kalır.


## Botlarla oyun

Ana ekranda **Botlarla oyna** tek insan + üç botla hemen masayı açar. **Arkadaş masası kur** normal bekleme lobisini açar; masa sahibi **Boş yerleri botlarla doldur** ile bir veya iki arkadaşıyla da başlayabilir. Botlar başladığı el boyunca sandalyelerini korur; devam eden oyuna insan oyuncu yerleştirilmez.

Botlar sunucuda çalışır ve insanlarla aynı sıra, çekme, açma, işleme ve atma doğrulamalarını kullanır. Kendi elleri ve masanın açık bilgileriyle sınırlı basit bir strateji kullanır; diğer oyuncuların ellerini ve yığının sırasını görmezler. Ortadan çeker, uygun seri/per veya beş çiftle açar, masaya taş işler ve atar. İleri seviye rakip olarak tasarlanmamıştır.

Bot sıraları yaklaşık bir saniye arayla oynanır. İnsanlardan biri koparsa botlar da durur; yeniden bağlanınca devam ederler. Masada insan kalmazsa otomatik oyun sürmez; normal masa temizleme süresi geçerlidir. Yeni eli masa sahibi başlatır.

## Masa yerleşimi ve ıstaka

Oyuncular kendi bakış açılarına göre karşı/sol/sağ/alt koltuklarda görünür. Açılan gruplar, sahibinin adıyla ayrılmış dört masa alanında herkese gösterilir; son atışlar masa kenarlarındadır. Kendi atış alanınız sağ alttaki **SAĞA AT** alanıdır.

**Seri diz**, geçerli seri/perleri; **Çift diz**, aynı taş çiftlerini ayırır ve aralarında bir taş boşluğu bırakır. Eşleşmeyen taşlar ayrı tutulur. Bu işlem yalnızca ıstakayı düzenler, otomatik el açmaz. Her per tek rafta tutulur. Gerçek ve sahte okey mevcut masa kurallarıyla değerlendirilir.

Taşlar fare veya dokunmatik pointer hareketiyle sağdaki alana bırakılarak atılabilir; sıra ve çekme kontrolleri sunucuda korunur. Dokunup seçme ve **Seçili taşı at** düğmesi de kullanılabilir. Istaka içinde sürüklemek elle sıralamayı sağlar.
