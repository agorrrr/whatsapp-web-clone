# WhatsApp Web Clone 💬

Aplikasi web chat yang dirancang semirip mungkin dengan antarmuka dan interaksi **WhatsApp Web**.

![WhatsApp Web Preview](https://static.whatsapp.net/rsrc.php/v3/yP/r/N7XG-J5c2v6.png)

## ✨ Fitur Utama
- 💬 **Chat Realtime & Teks**: Mengirim dan menerima pesan teks dengan bubble khas WhatsApp, timestamp, dan status centang (abu-abu terkirim, biru terbaca).
- 📷 **Kirim Foto / Gambar**: Unggah foto dari perangkat, preview dengan teks keterangan (caption), dan lightbox pembesar gambar saat diklik.
- 🎙️ **Rekam Suara (Voice Note)**: Merekam suara langsung lewat mikrofon browser dengan indikator timer dan visualisasi gelombang suara. Dilengkapi pemutar audio dengan pengaturan kecepatan playback (1x, 1.5x, 2x).
- 🎭 **Stiker & Emoji Drawer**: Panel stiker interaktif dan pemilih emoji lengkap untuk mengekspresikan percakapan.
- ❤️ **Reaksi Pesan**: Berikan reaksi emoji pada pesan mana pun (hover bubble pesan).
- 🤖 **Simulasi Kontak & Bot Asisten**: Dilengkapi kontak simulasi interaktif (Budi, Siti, Tech Lead, Bot Asisten) dengan indikator status *sedang mengetik...* dan balasan otomatis alami.
- 🌓 **Mode Terang & Gelap (Dark Mode)**: Tema warna dan wallpaper doodle WhatsApp Web autentik.
- 💾 **Penyimpanan Lokal Persisten**: Percakapan dan kontak tersimpan otomatis di browser (`localStorage`).
- 📱 **Desain Responsif**: Nyaman digunakan di layar Desktop maupun Mobile browser.
- 🚫 *Fitur Telepon & Video Call dinonaktifkan sesuai spesifikasi.*

---

## 🚀 Cara Menjalankan di Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) v18 atau lebih baru
- NPM atau PNPM / Yarn

### Langkah-langkah
1. Clone repositori:
   ```bash
   git clone https://github.com/<username>/whatsapp-web-clone.git
   cd whatsapp-web-clone
   ```

2. Pasang dependensi:
   ```bash
   npm install
   ```

3. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```

4. Buka di browser:
   [http://localhost:3000](http://localhost:3000)

---

## ☁️ Cara Deploy ke Vercel

Aplikasi ini menggunakan **Next.js**, sehingga dioptimalkan secara langsung untuk platform **Vercel** tanpa konfigurasi tambahan (*zero configuration*).

### Opsi 1: Lewat Dashboard Vercel (Paling Mudah)
1. Buka [https://vercel.com](https://vercel.com) dan login dengan akun GitHub Anda.
2. Klik tombol **Add New...** > **Project**.
3. Pilih repositori `whatsapp-web-clone` yang sudah di-push ke GitHub.
4. Klik **Deploy**.
5. Tunggu ~1 menit, aplikasi langsung aktif dan mendapatkan URL publik `https://whatsapp-web-clone-xxx.vercel.app`!

### Opsi 2: Menggunakan Vercel CLI
```bash
npm i -g vercel
vercel
```

---

## 🛠️ Teknologi yang Digunakan
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **UI Library**: React 18, [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Audio & Media**: Web MediaRecorder API, Web Audio API
