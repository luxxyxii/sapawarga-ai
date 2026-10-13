const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'knowledge.json');

// In-memory cache for serverless environments (Vercel)
let inMemoryTickets = null;
let inMemoryKnowledge = null;

// Helper to read JSON
function readJson(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function getTickets() {
  if (!inMemoryTickets) {
    inMemoryTickets = readJson(TICKETS_FILE, []);
  }
  return inMemoryTickets;
}

function saveTickets(data) {
  inMemoryTickets = data;
  try {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Vercel serverless functions have a read-only filesystem
    console.warn('Filesystem read-only (typical on Vercel), maintaining in-memory state:', err.message);
  }
}

function getKnowledge() {
  if (!inMemoryKnowledge) {
    inMemoryKnowledge = readJson(KNOWLEDGE_FILE, { categories: [], faqs: [] });
  }
  return inMemoryKnowledge;
}

// ===== API ROUTES =====

// 1. Get Knowledge Base
app.get('/api/knowledge', (req, res) => {
  const data = getKnowledge();
  res.json(data);
});

// 2. Get All Tickets / Search Tickets
app.get('/api/tickets', (req, res) => {
  const { status, category, q } = req.query;
  let tickets = [...getTickets()];

  if (status) {
    tickets = tickets.filter(t => t.status.toLowerCase() === status.toLowerCase());
  }
  if (category) {
    tickets = tickets.filter(t => t.category.toLowerCase() === category.toLowerCase());
  }
  if (q) {
    const query = q.toLowerCase();
    tickets = tickets.filter(t =>
      t.id.toLowerCase().includes(query) ||
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      (t.reporterName && t.reporterName.toLowerCase().includes(query)) ||
      (t.location && t.location.toLowerCase().includes(query))
    );
  }

  // Sort newest first
  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(tickets);
});

// 3. Get Single Ticket by ID
app.get('/api/tickets/:id', (req, res) => {
  const idToFind = req.params.id.trim().toUpperCase();
  const tickets = getTickets();
  
  const ticket = tickets.find(t => 
    t.id.toUpperCase() === idToFind || 
    t.id.replace('#', '').toUpperCase() === idToFind.replace('#', '')
  );

  if (!ticket) {
    return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  }

  res.json(ticket);
});

// 4. Create New Ticket
app.post('/api/tickets', (req, res) => {
  const {
    reporterName = 'Warga Anonim',
    phone = '-',
    category = 'pupr',
    categoryName,
    title,
    description,
    location,
    urgency = 'Sedang',
    source = 'Portal Web'
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Judul dan deskripsi laporan wajib diisi' });
  }

  const tickets = getTickets();
  const knowledge = getKnowledge();
  const catObj = knowledge.categories.find(c => c.id === category);

  // Generate Unique Ticket ID: LAPOR-2026-XXXX
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const newId = `LAPOR-2026-${randomSuffix}`;

  const now = new Date().toISOString();

  const newTicket = {
    id: newId,
    reporterName,
    phone,
    category,
    categoryName: categoryName || (catObj ? catObj.name : 'Lainnya'),
    title,
    description,
    location: location || 'Lokasi belum dispesifikasikan',
    urgency,
    status: 'MENUNGGU',
    assignedDinas: catObj ? catObj.dinas : 'Pemerintah Daerah Terkait',
    source,
    createdAt: now,
    updatedAt: now,
    timeline: [
      {
        status: 'MENUNGGU',
        timestamp: now,
        note: `Laporan berhasil dibuat via ${source} dan sedang mengantre verifikasi awal.`,
        by: 'Sistem Terpadu SapaWarga'
      }
    ]
  };

  tickets.unshift(newTicket);
  saveTickets(tickets);

  res.status(201).json({
    message: 'Laporan berhasil dibuat',
    ticket: newTicket
  });
});

// 5. Update Ticket Status (for Admin / Petugas)
app.patch('/api/tickets/:id', (req, res) => {
  const idToFind = req.params.id.trim().toUpperCase();
  const { status, note, by = 'Petugas Layanan', assignedDinas } = req.body;

  const tickets = getTickets();
  const index = tickets.findIndex(t => t.id.toUpperCase() === idToFind);

  if (index === -1) {
    return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  }

  const now = new Date().toISOString();
  const target = tickets[index];

  if (status) {
    target.status = status;
  }
  if (assignedDinas) {
    target.assignedDinas = assignedDinas;
  }
  target.updatedAt = now;

  target.timeline.push({
    status: target.status,
    timestamp: now,
    note: note || `Status tiket diperbarui menjadi ${target.status}.`,
    by
  });

  saveTickets(tickets);

  res.json({
    message: 'Status tiket berhasil diperbarui',
    ticket: target
  });
});

// 6. Get Stats for Dashboard
app.get('/api/stats', (req, res) => {
  const tickets = getTickets();

  const total = tickets.length;
  const menunggu = tickets.filter(t => t.status === 'MENUNGGU').length;
  const diproses = tickets.filter(t => t.status === 'DIPROSES').length;
  const selesai = tickets.filter(t => t.status === 'SELESAI').length;
  const ditolak = tickets.filter(t => t.status === 'DITOLAK').length;

  // Breakdown by Category
  const byCategory = {};
  tickets.forEach(t => {
    const cat = t.categoryName || t.category;
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  // Recent 5 activities
  const recentTickets = tickets.slice(0, 5);

  res.json({
    total,
    menunggu,
    diproses,
    selesai,
    ditolak,
    byCategory,
    recentTickets
  });
});

// ===== AI CHAT ENGINE =====

app.post('/api/chat', async (req, res) => {
  const { message, history = [], context = {} } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
  }

  const cleanMsg = message.trim();
  const lowerMsg = cleanMsg.toLowerCase();

  const knowledge = getKnowledge();
  const tickets = getTickets();

  // 1. Detect Ticket Tracking Intent
  const ticketRegex = /(?:LAPOR-2026-\d{4}|#LAPOR-2026-\d{4})/i;
  const matchTicket = cleanMsg.match(ticketRegex);

  if (matchTicket || (lowerMsg.includes('cek status') && cleanMsg.match(/\d{4}/))) {
    const rawId = matchTicket ? matchTicket[0].replace('#', '').toUpperCase() : null;
    const ticket = rawId ? tickets.find(t => t.id.toUpperCase() === rawId) : null;

    if (ticket) {
      const statusBadge = 
        ticket.status === 'SELESAI' ? '✅ **SELESAI**' :
        ticket.status === 'DIPROSES' ? '🔄 **SEDANG DIPROSES**' :
        ticket.status === 'MENUNGGU' ? '⏳ **MENUNGGU VERIFIKASI**' : '❌ **DITOLAK**';

      const lastTimeline = ticket.timeline[ticket.timeline.length - 1];

      const reply = `### 📋 Informasi Tiket Pengaduan\n\n` +
        `* **Nomor Tiket**: \`${ticket.id}\`\n` +
        `* **Pelapor**: ${ticket.reporterName}\n` +
        `* **Kategori**: ${ticket.categoryName}\n` +
        `* **Judul**: ${ticket.title}\n` +
        `* **Lokasi**: ${ticket.location}\n` +
        `* **Status Terkini**: ${statusBadge}\n` +
        `* **Dinas Penanggung Jawab**: ${ticket.assignedDinas}\n\n` +
        `**Perkembangan Terakhir:**\n> "${lastTimeline ? lastTimeline.note : 'Belum ada catatan tambahan'}" *(Oleh: ${lastTimeline ? lastTimeline.by : 'Sistem'})*\n\n` +
        `💡 Anda dapat terus memantau pembaruan status laporan ini sewaktu-waktu melalui chatbot ini atau halaman Cek Tiket.`;

      return res.json({
        reply,
        intent: 'TRACK_TICKET',
        data: ticket
      });
    } else if (rawId) {
      return res.json({
        reply: `Maaf, tiket dengan nomor **${rawId}** tidak ditemukan dalam database pengaduan kami. Pastikan format nomor laporan sudah benar (contoh: \`LAPOR-2026-0101\`).`,
        intent: 'TRACK_TICKET_NOT_FOUND'
      });
    }
  }

  // 2. Detect Fast-Complaint creation trigger
  const isDirectComplaint = 
    lowerMsg.startsWith('lapor ') || 
    lowerMsg.includes('mau lapor') || 
    lowerMsg.includes('buat pengaduan') || 
    lowerMsg.includes('aduan jalan') || 
    lowerMsg.includes('aduan sampah') ||
    lowerMsg.includes('lapor sampah') ||
    lowerMsg.includes('lapor pju');

  if (isDirectComplaint && cleanMsg.length > 25) {
    let detectedCat = 'pupr';
    let catTitle = 'Infrastruktur & Fasilitas Umum';
    if (lowerMsg.includes('sampah') || lowerMsg.includes('kali') || lowerMsg.includes('sungai') || lowerMsg.includes('pohon')) {
      detectedCat = 'kebersihan';
      catTitle = 'Kebersihan & Lingkungan Hidup';
    } else if (lowerMsg.includes('ktp') || lowerMsg.includes('kk') || lowerMsg.includes('akta')) {
      detectedCat = 'dukcapil';
      catTitle = 'Administrasi Kependudukan';
    } else if (lowerMsg.includes('bansos') || lowerMsg.includes('pkh') || lowerMsg.includes('sembako')) {
      detectedCat = 'bansos';
      catTitle = 'Bantuan Sosial & Kesejahteraan';
    } else if (lowerMsg.includes('puskesmas') || lowerMsg.includes('bpjs') || lowerMsg.includes('dokter')) {
      detectedCat = 'kesehatan';
      catTitle = 'Kesehatan & BPJS';
    }

    const reply = `Halo! Saya dapat langsung mendaftarkan laporan pengaduan Anda ke dinas terkait.\n\n` +
      `📋 **Draf Laporan Otomatis:**\n` +
      `* **Kategori**: ${catTitle}\n` +
      `* **Keluhan**: "${cleanMsg}"\n\n` +
      `Apakah Anda ingin saya terbitkan **Tiket Pengaduan Resmi (#LAPOR)** untuk keluhan ini sekarang juga? Silakan klik tombol **"Terbitkan Tiket Sekarang"** di bawah atau gunakan formulir laporan cepat!`;

    return res.json({
      reply,
      intent: 'OFFER_TICKET_CREATION',
      draftData: {
        category: detectedCat,
        categoryName: catTitle,
        title: cleanMsg.length > 50 ? cleanMsg.substring(0, 47) + '...' : cleanMsg,
        description: cleanMsg,
        urgency: lowerMsg.includes('bahaya') || lowerMsg.includes('darurat') || lowerMsg.includes('parah') ? 'Tinggi' : 'Sedang'
      }
    });
  }

  // 3. Match against Knowledge Base (FAQ & Procedural Guides)
  let bestFaq = null;
  let bestScore = 0;

  for (const faq of knowledge.faqs) {
    let score = 0;
    
    for (const kw of faq.keywords) {
      if (lowerMsg.includes(kw.toLowerCase())) {
        score += 10;
      } else {
        const kwWords = kw.toLowerCase().split(' ');
        const matches = kwWords.filter(w => w.length > 2 && lowerMsg.includes(w));
        score += matches.length * 2.5;
      }
    }

    const titleWords = faq.title.toLowerCase().split(' ');
    titleWords.forEach(w => {
      if (w.length > 3 && lowerMsg.includes(w)) score += 2;
    });

    if (score > bestScore) {
      bestScore = score;
      bestFaq = faq;
    }
  }

  if (bestFaq && bestScore >= 4) {
    const cat = knowledge.categories.find(c => c.id === bestFaq.categoryId);
    
    let reply = `### 📌 ${bestFaq.title}\n\n`;
    reply += `${bestFaq.summary}\n\n`;
    reply += `**Langkah & Persyaratan:**\n`;
    bestFaq.steps.forEach((step, idx) => {
      reply += `${idx + 1}. ${step}\n`;
    });
    reply += `\n💰 **Biaya**: ${bestFaq.biaya}\n`;
    reply += `⏱️ **Estimasi Waktu**: ${bestFaq.waktu}\n`;
    if (cat) {
      reply += `🏢 **Instansi Pembina**: ${cat.dinas}\n`;
    }
    reply += `\n*Apakah ada hal lain terkait layanan ini yang ingin Anda tanyakan?*`;

    return res.json({
      reply,
      intent: 'FAQ_MATCH',
      faqId: bestFaq.id
    });
  }

  // 4. Greetings or General Help
  if (
    lowerMsg.includes('halo') || 
    lowerMsg.includes('hai') || 
    lowerMsg.includes('pagi') || 
    lowerMsg.includes('siang') || 
    lowerMsg.includes('sore') || 
    lowerMsg.includes('malam') ||
    lowerMsg.includes('assalamu') ||
    lowerMsg.includes('bantuan') ||
    lowerMsg === 'menu' ||
    lowerMsg === 'help'
  ) {
    const reply = `Halo! Selamat datang di **SapaWarga AI**, asisten virtual layanan publik terpadu.\n\n` +
      `Saya siap membantu Anda 24 jam sehari untuk keperluan:\n\n` +
      `1. 🆔 **Administrasi Kependudukan**: Syarat KTP hilang/rusak, Kartu Keluarga, Akta Kelahiran, Pindah Domisili, IKD.\n` +
      `2. 🤝 **Bantuan Sosial (Bansos)**: Cara cek status PKH/BPNT, syarat mendaftar DTKS.\n` +
      `3. 🚧 **Pengaduan Fasilitas Publik**: Lapor jalan berlubang, lampu PJU padam, tumpukan sampah liar.\n` +
      `4. 🏥 **Layanan Kesehatan**: Syarat rujukan BPJS, pindah faskes tingkat 1.\n` +
      `5. 💼 **Perizinan UMKM**: Cara membuat NIB gratis via OSS dalam 15 menit.\n` +
      `6. 🔍 **Lacak Pengaduan**: Cek status tiket Anda dengan mengetik nomor tiket (contoh: \`LAPOR-2026-0101\`).\n\n` +
      `*Silakan ketik pertanyaan Anda atau pilih salah satu menu cepat di bawah!*`;

    return res.json({
      reply,
      intent: 'GREETING'
    });
  }

  // 5. Fallback with helpful suggestions
  const reply = `Terima kasih atas pesan Anda. Saya dapat membantu Anda dalam informasi layanan publik dan pengaduan warga.\n\n` +
    `Pertanyaan Anda belum secara spesifik cocok dengan panduan umum kami. Anda dapat:\n` +
    `* Mengetik kata kunci spesifik seperti: *"syarat KTP hilang"*, *"daftar bansos"*, *"lampu jalan mati"*, *"buat NIB"*, atau *"rujukan BPJS"*.\n` +
    `* Jika ingin menyampaikan keluhan fasilitas umum, Anda bisa langsung ketik: *"Lapor jalan berlubang di Jl. Sukamaju"* atau gunakan tab **Formulir Pengaduan** di menu atas.\n` +
    `* Jika ingin cek tindak lanjut laporan sebelumnya, ketikkan nomor tiket seperti \`LAPOR-2026-0101\`.`;

  return res.json({
    reply,
    intent: 'FALLBACK'
  });
});

// Export app for serverless deployment (Vercel)
module.exports = app;

// Only listen if executed directly (e.g. node server.js)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 SI-WARGA AI: Layanan Publik & Pengaduan Warga`);
    console.log(`📡 Server berjalan pada: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}
