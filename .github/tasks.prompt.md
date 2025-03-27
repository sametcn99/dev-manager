# VS Code Tasks.json Editor Interface Prompt

Bu prompt, VS Code'un tasks.json dosyasını görsel bir arayüz üzerinden düzenlemek için eklenti geliştirmeye rehberlik edecektir.

```markdown
# VS Code Tasks.json Editor Geliştirme Rehberi

## Genel Bakış

Bu özellik, VS Code'un tasks.json dosyasını görsel bir arayüz üzerinden düzenlemeyi sağlayacaktır. Kullanıcılar, karmaşık JSON yapısıyla uğraşmak yerine form tabanlı bir arayüz kullanarak görevlerini kolayca tanımlayabilecek, düzenleyebilecek ve yönetebilecektir.

## Temel Özellikler

- Mevcut tasks.json dosyasını okuma ve görselleştirme
- Yeni görevler ekleme ve mevcut görevleri düzenleme
- Görev türlerini (npm, shell, typescript vb.) seçme imkanı
- Görev bağımlılıklarını görsel olarak yönetme
- Görev gruplarını (build, test vb.) yapılandırma
- Değişiklikleri gerçek zamanlı olarak tasks.json dosyasına kaydetme

## Teknik Gereksinimler

- VS Code WebView API kullanarak etkileşimli arayüz oluşturma
- VS Code FileSystem API ile tasks.json dosyasını okuma/yazma işlemleri
- tasks.json şemasına uygun validasyon mekanizması
- VS Code Theming API ile tema desteği sağlama
- Erişilebilirlik standartlarına uygunluk

## Uygulama Aşamaları

1. Temel WebView arayüzü oluşturma
2. tasks.json dosyasını okuma ve parse etme
3. Form bileşenlerini oluşturma (görev tipleri, komut girişleri, problem eşleştirme vb.)
4. Değişiklikleri tasks.json formatına dönüştürme ve doğrulama
5. Görsel görev bağımlılık editörü geliştirme
6. Ayarlar ve özelleştirme seçenekleri ekleme

## Kullanıcı Deneyimi Hedefleri

- Sezgisel arayüz ile JSON bilgisi gerektirmeden görev yapılandırma
- Otomatik tamamlama ve öneriler ile yapılandırma kolaylığı
- Ön tanımlı görev şablonları ile başlangıç sürecini hızlandırma
- İleri seviye kullanıcılar için JSON düzenleme ve görsel editör arasında geçiş imkanı
- Hata doğrulama ve bildirimleri ile kullanıcı yönlendirme

## Entegrasyon Noktaları

- VS Code görev çalıştırma sistemine entegrasyon
- VS Code komut paletine özel komutlar ekleme
- Bağlam menüsü (sağ tık) üzerinden hızlı erişim
- Durum çubuğunda aktif görevleri gösterme ve yönetme
```
