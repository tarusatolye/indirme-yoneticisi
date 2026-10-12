<p align="center">
  <img src="docs/icon.png" width="128" alt="tarus indirme yöneticisi">
</p>

<h1 align="center">tarus indirme yöneticisi</h1>

<p align="center">
  Windows ve macOS için yüksek performanslı, modern ve açık kaynak kodlu indirme yöneticisi.<br>
  Chrome, Edge, Brave ve Firefox indirmelerini yakalar, çoklu segment bağlantısıyla hızlandırır ve sayfalardaki medya akışlarını indirir.
</p>

<p align="center">
  <a href="https://github.com/tarusatolye/indirme-yoneticisi/releases">Sürümler & İndir</a> · 
  <a href="#kurulum">Kurulum Kılavuzu</a>
</p>

---

## Öne Çıkan Özellikler

- **Çok Parçalı (Segmentli) Hızlandırma:** Dosyaları eşzamanlı HTTP `Range` isteklerine bölerek bant genişliğini maksimum verimlilikle kullanır (varsayılan 8 segment, 1–16 arası ayarlanabilir).
- **Duraklat / Sürdür Desteği:** İndirme ilerleme durumu anlık olarak diske kaydedilir; internet kesintilerinde veya uygulama yeniden başlatıldığında indirme kaldığı yerden devam eder.
- **Evrensel Tarayıcı Entegrasyonu:** Google Chrome, Microsoft Edge, Brave ve Mozilla Firefox ile tam uyumlu WebExtension. İndirmeleri otomatik yakalar, çerezleri (`Cookie`), `Referer` ve `User-Agent` bilgilerini uygulamaya aktarır.
- **Akıllı Video ve Medya Yakalama:** YouTube, Twitter/X, Instagram, Vimeo ve doğrudan web sayfalarındaki video/ses akışlarını algılar. Gömülü `yt-dlp` ve `FFmpeg` motorları ile en yüksek kalitede MP4 formatında birleştirerek indirir.
- **Otomatik Uygulama İçi Güncelleme:** GitHub Releases üzerinden yeni sürümleri arka planda denetler, kullanıcıyı bilgilendirir ve tek tıkla güncelleme imkanı sunar.
- **Gizlilik Odaklı:** Hiçbir kullanıcı verisi, indirme geçmişi veya dosya içeriği harici sunuculara gönderilmez. Tüm iletişim yerel bilgisayarınızda (`127.0.0.1:48213`) gerçekleşir.

---

## Kurulum

### Windows
1. [GitHub Sürümler (Releases)](https://github.com/tarusatolye/indirme-yoneticisi/releases) sayfasından `İndirme Yöneticisi Setup 0.0.2.exe` dosyasını indirin.
2. Kurulum sihirbazını başlatın ve kurulumu tamamlayın (veya kurulumsuz çalışan `Portable` sürümünü kullanabilirsiniz).
3. Uygulama açıldığında masaüstü simgesinden veya sistem tepsisinden erişebilirsiniz.

### macOS
1. [GitHub Sürümler (Releases)](https://github.com/tarusatolye/indirme-yoneticisi/releases) sayfasından `.dmg` dosyasını indirin.
2. DMG dosyasını açıp uygulamayı *Applications* (Uygulamalar) klasörüne sürükleyin.

---

## Tarayıcı Eklentisinin Kurulması (Uygulama İçi Tek Tık)

Uygulama içerisindeki yerleşik kurulum sihirbazı ile eklentiyi saniyeler içinde kurabilirsiniz:

1. Uygulamayı açın ve üst araç çubuğundaki **Tarayıcı Eklentisi** (Yapboz simgesi) butonuna (veya alt durum çubuğundaki eklenti göstergesine) tıklayın.
2. Kullandığınız tarayıcıyı (Chrome, Edge, Brave, Firefox, Opera) seçip **"Eklentiler Sayfasını Aç"** butonuna tıklayın.
3. Açılan tarayıcı sayfasında sağ üstteki **Geliştirici Modu**'nu (Developer Mode) açın.
4. **"Eklenti Klasörünü Aç"** butonuna basarak gelen `extension` klasörünü tarayıcı penceresine sürükleyin (veya *"Paketlenmemiş öge yükle"* butonuna tıklayıp kopyalanan yolu seçin).
5. Eklenti kurulduğunda uygulama arayüzü anında yeşile döner ve tarayıcınızdaki tüm indirmeler otomatik olarak İndirme Yöneticisi tarafından yakalanır.

---

## Geliştirme ve Kaynaktan Derleme

### Gereksinimler
- Node.js (v20 veya üstü)
- npm

### Projeyi Çalıştırma
```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirici modunda arayüzü başlatın
npm run dev

# Uygulamayı masaüstünde çalıştırın
npm start
```

### Kurulum Paketlerini Derleme
```bash
# Windows için NSIS Setup ve Portable exe üretir:
npm run dist:win

# macOS için DMG ve Zip üretir (macOS üzerinde):
npm run dist:mac
```

---

## Lisans ve Yasal Uyarı

- **Yazılım Lisansı:** MIT Lisansı (Bkz. `LICENSE`).
- **Yayımcı:** tarusatolye (yazilim@tarus.tr).
- **Yasal Sorumluluk:** Yazılım genel amaçlı bir indirme aracıdır. İndirilen içeriklerin telif hakları, kullanım izinleri ve üçüncü taraf platform kurallarına uygunluğundan tamamen Kullanıcı sorumludur.
