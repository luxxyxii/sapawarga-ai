# 🇮🇩 SapaWarga AI - Portal Layanan Masyarakat Berbasis AI Chatbot

**SapaWarga AI** adalah sistem pelayanan publik dan penanganan aspirasi/pengaduan masyarakat terintegrasi berbasis kecerdasan buatan. Aplikasi ini dirancang untuk memudahkan warga mendapatkan informasi persyaratan dokumen resmi (KTP, KK, Bansos, NIB UMKM, BPJS) serta melaporkan masalah fasilitas umum (jalan berlubang, sampah, lampu PJU padam) secara cepat, transparan, dan 24 jam non-stop.

---

## 🌟 Fitur Utama

### 1. 🤖 Asisten Chatbot AI Pintar (24/7)
* **Pemahaman Bahasa Natural Bahasa Indonesia**: Mengenali bahasa santai, istilah daerah, dan singkatan.
* **Knowledge Base Terpadu**:
  * **Disdukcapil**: Syarat KTP-el hilang/rusak, Kartu Keluarga, Akta Kelahiran, Pindah Domisili (SKPWNI), IKD (Identitas Kependudukan Digital).
  * **Dinas Sosial**: Cek kepesertaan PKH, BPNT, dan pendaftaran DTKS.
  * **Dinas PUPR & Lingkungan Hidup**: Pengaduan jalan rusak, PJU padam, tumpukan sampah liar, pemangkasan pohon rimbun.
  * **Dinas Kesehatan & BPJS**: Prosedur rujukan berjenjang, pindah faskes tingkat 1 di Mobile JKN.
  * **DPMPTSP & UMKM**: Pembuatan NIB gratis instan via OSS RBA.
  * **Panggilan Darurat**: Layanan terpadu 112, Kepolisian 110, Damkar 113, Ambulans 119.
* **Pembuatan Tiket Otomatis via Percakapan**:
  * Ketika warga mengeluhkan masalah (misal: *"jalan berlubang di depan pasar"*), AI langsung mendeteksi kategori dan menawarkan tombol satu-klik **"Terbitkan Tiket Sekarang"**.
* **Fitur Aksesibilitas**:
  * 🎙️ **Voice-to-Text (Speech Recognition)**: Bicara langsung melalui mikrofon untuk lansia / disabilitas.
  * 🔊 **Text-to-Speech (TTS)**: Dengarkan jawaban AI dibacakan dengan suara alami bahasa Indonesia.

### 2. 🔍 Pelacakan Tiket Real-Time
* Masukkan kode tiket (contoh: `LAPOR-2026-0101`).
* Tampilan visual stepper progres 3 tahap: **Terverifikasi ➔ Ditangani Dinas ➔ Tuntas / Selesai**.
* Dilengkapi log riwayat penanganan petugas dan catatan teknis lapangan.

### 3. 📝 Formulir Pengaduan Mandiri (Fast-Track)
* Formulir lengkap dengan input identitas, kategori dinas, tingkat urgensi (Normal/Tinggi/Darurat), lokasi detail, dan simulasi unggah foto bukti lapangan.

### 4. 📚 Direktori & Syarat Layanan Interaktif
* Katalog seluruh dokumen administrasi publik lengkap dengan rincian biaya (**Rp 0 / Gratis Bebas Pungli**), estimasi hari kerja, dan dasar instansi pembina.
* Dilengkapi fitur pencarian langsung (*live search*).

### 5. 🛡️ Dashboard Petugas & Admin (Backoffice)
* Statistik ringkasan pengaduan: Total, Menunggu Verifikasi, Sedang Ditindak, dan Selesai.
* Filter status aduan dan pencarian cerdas.
* Modal update status dan catatan tindak lanjut petugas untuk transparansi kepada warga pelapor.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi dibangun menggunakan Node.js dan Express tanpa konfigurasi rumit.

### 1. Masuk ke Direktori Proyek
```powershell
cd C:\Users\user\.gemini\antigravity\scratch\layanan-masyarakat-ai
```

### 2. Jalankan Server
```powershell
node server.js
```

### 3. Buka di Browser
Akses aplikasi melalui peramban:
```
http://localhost:3000
```

---

## 📁 Struktur Direktori

```
layanan-masyarakat-ai/
├── data/
│   ├── knowledge.json    # Basis data pengetahuan layanan masyarakat & FAQ
│   └── tickets.json      # Database penyimpanan tiket pengaduan warga
├── public/
│   ├── index.html        # Halaman utama aplikasi (Chatbot, Lacak, Form, Admin)
│   ├── style.css         # Styling custom, bubble chat, animasi & status badge
│   └── app.js            # Logika frontend, Speech API, tracking, & integrasi API
├── server.js             # Express API server & AI Intent Classifier
├── package.json          # Konfigurasi dependensi Node.js
└── README.md             # Dokumentasi sistem
```

---

## 📡 Dokumentasi Endpoint REST API

| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `POST` | `/api/chat` | Mengirim pertanyaan ke AI chatbot |
| `GET` | `/api/knowledge` | Mengambil seluruh direktori layanan & FAQ |
| `GET` | `/api/tickets` | Mengambil daftar tiket (filter by status, category, q) |
| `GET` | `/api/tickets/:id` | Mengambil rincian 1 tiket berdasarkan kode |
| `POST` | `/api/tickets` | Menerbitkan tiket pengaduan baru |
| `PATCH` | `/api/tickets/:id` | Mengubah status tiket & menambah catatan petugas |
| `GET` | `/api/stats` | Statistik agregat untuk dashboard petugas |
