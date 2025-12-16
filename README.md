# 🗺️ VibelyMap - Base Mini App

Yakın mekanları keşfetmek için Base blockchain üzerinde çalışan harita uygulaması.

## ✨ Özellikler

- 🗺️ **İnteraktif Harita:** Leaflet ile güçlendirilmiş harita görünümü
- 🔗 **Base Wallet Entegrasyonu:** Base App içinde otomatik wallet bağlantısı
- 🔍 **Mekan Arama:** Google Places API ile yakın mekanları bulma
- 🤖 **AI Analiz:** Mekan özelliklerini AI ile analiz etme
- ⚡ **Gasless İşlemler:** Paymaster desteği ile gas ücreti ödemeden işlem yapma

## 🚀 Hızlı Başlangıç

### 1. Paketleri Yükleyin

```bash
npm install
```

### 2. Environment Variables Ayarlayın

`.env.local` dosyası oluşturun:

```env
NEXT_PUBLIC_COINBASE_DEVELOPER_PLATFORM_API_KEY=your_api_key_here
GOOGLE_PLACES_KEY=your_google_key_here
GPT5_API_KEY=your_gpt_key_here
GEMINI_API_KEY=your_gemini_key_here
```

**Cloudinary Kurulumu:**
- `CLOUDINARY_SETUP.md` dosyasında adım adım kurulum rehberi var
- Cloudinary hesabı: https://cloudinary.com (ücretsiz)
- Dashboard'dan Cloud Name ve Upload Preset oluşturun

### 3. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresine gidin.

## 📱 Base Mini App Olarak Kullanım

1. Geliştirme sunucusunu başlatın: `npm run dev`
2. Base Developer Platform'da Mini App URL'ini ayarlayın
3. Base App'te test edin

## 🛠️ Teknolojiler

- **Framework:** Next.js 14 (App Router)
- **Blockchain:** Base (Ethereum L2)
- **Wallet:** Wagmi + Viem
- **Harita:** Leaflet
- **Styling:** Tailwind CSS
- **Type Safety:** TypeScript

## 📁 Proje Yapısı

```
├── app/
│   ├── api/
│   │   └── proxy/          # API proxy routes
│   ├── components/         # React bileşenleri
│   ├── hooks/              # Custom hooks
│   └── page.tsx            # Ana sayfa
├── public/
│   ├── logo.png            # Uygulama logosu
│   └── manifest.json       # PWA manifest
└── contracts/              # Smart contracts
```

## 🔐 Güvenlik

- ✅ API key'ler sadece server-side'da kullanılıyor
- ✅ `.env.local` Git'e commit edilmiyor
- ✅ Proxy API routes ile güvenli API erişimi
- ✅ Base blockchain entegrasyonu

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🔗 Bağlantılar

- [Base Documentation](https://docs.base.org/)
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Not:** Bu uygulama Base Mini App olarak çalışmak üzere tasarlanmıştır. Base App içinde açıldığında otomatik olarak wallet bağlantısı yapılır.



