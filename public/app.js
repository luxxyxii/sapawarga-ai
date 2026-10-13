// SapaWarga AI Client Application Logic
let chatHistory = [];
let allFaqs = [];
let allCategories = [];
let allAdminTickets = [];
let activeAdminStatusFilter = 'SEMUA';
let activeCatalogCategory = 'ALL';
let speechRecognition = null;
let isListening = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  initSpeechRecognition();
  loadKnowledge();
  loadAdminData();
});

// ==========================================
// NAVIGATION & TABS
// ==========================================
function switchTab(tabId) {
  // Hide all panes
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active', 'text-blue-600', 'bg-blue-50');
    btn.classList.add('text-slate-600');
  });

  // Activate chosen pane
  const targetPane = document.getElementById(`tab-${tabId}`);
  if (targetPane) {
    targetPane.classList.remove('hidden');
  }

  const targetBtn = document.getElementById(`nav-${tabId}`);
  if (targetBtn) {
    targetBtn.classList.add('active', 'text-blue-600', 'bg-blue-50');
    targetBtn.classList.remove('text-slate-600');
  }

  if (tabId === 'admin') {
    loadAdminData();
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ==========================================
// CHATBOT ENGINE & MESSAGES
// ==========================================
async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  const inputEl = document.getElementById('chat-input');
  const message = inputEl.value.trim();
  if (!message) return;

  // Clear input
  inputEl.value = '';

  // Render User Message
  appendUserMessage(message);
  chatHistory.push({ role: 'user', content: message });

  // Show Typing Indicator
  const typingIndicator = document.getElementById('typing-indicator');
  typingIndicator.classList.remove('hidden');
  scrollChatToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory })
    });

    const data = await res.json();
    typingIndicator.classList.add('hidden');

    if (data.reply) {
      appendBotMessage(data.reply, data);
      chatHistory.push({ role: 'assistant', content: data.reply });
    } else {
      appendBotMessage('Maaf, terjadi kendala saat memproses permintaan Anda. Silakan coba lagi.');
    }
  } catch (err) {
    console.error('Chat error:', err);
    typingIndicator.classList.add('hidden');
    appendBotMessage('Maaf, terjadi gangguan koneksi ke server. Pastikan server lokal Anda aktif.');
  }

  scrollChatToBottom();
}

function appendUserMessage(text) {
  const container = document.getElementById('chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'flex justify-end gap-3';
  msgDiv.innerHTML = `
    <div class="chat-bubble-user p-4 max-w-[85%] text-sm shadow-sm">
      <p class="whitespace-pre-wrap leading-relaxed">${escapeHtml(text)}</p>
    </div>
  `;
  container.appendChild(msgDiv);
  scrollChatToBottom();
}

function appendBotMessage(markdownText, meta = {}) {
  const container = document.getElementById('chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'flex gap-3 items-start';

  const parsedHtml = renderMarkdown(markdownText);
  const messageId = 'msg-' + Date.now();

  let actionHtml = '';

  // If AI proposed to create a complaint ticket
  if (meta.intent === 'OFFER_TICKET_CREATION' && meta.draftData) {
    const draftJson = encodeURIComponent(JSON.stringify(meta.draftData));
    actionHtml = `
      <div class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
        <button onclick="publishDraftTicket('${draftJson}')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm">
          <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
          Terbitkan Tiket Sekarang
        </button>
        <button onclick="prefillForm('${draftJson}')" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
          <i data-lucide="edit" class="w-3.5 h-3.5"></i>
          Lengkapi di Form
        </button>
      </div>
    `;
  }

  // If tracking info was returned
  if (meta.intent === 'TRACK_TICKET' && meta.data) {
    actionHtml = `
      <div class="mt-3 pt-3 border-t border-slate-100">
        <button onclick="setAndTrack('${meta.data.id}')" class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
          <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
          Lihat Riwayat Lengkap di Tab Lacak
        </button>
      </div>
    `;
  }

  msgDiv.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-sm font-semibold shadow-sm">
      AI
    </div>
    <div class="chat-bubble-bot p-4 max-w-[85%] text-sm">
      <div id="${messageId}" class="markdown-content text-slate-800 leading-relaxed">
        ${parsedHtml}
      </div>
      ${actionHtml}
      <div class="flex items-center justify-end gap-2 mt-2 pt-1 text-slate-400 text-xs">
        <button onclick="speakChatMessage('${messageId}')" title="Dengarkan Suara (Text-to-Speech)" class="hover:text-blue-600 p-1 rounded transition">
          <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>
  `;

  container.appendChild(msgDiv);
  if (window.lucide) lucide.createIcons();
  scrollChatToBottom();
}

function sendQuickPrompt(promptText) {
  const inputEl = document.getElementById('chat-input');
  inputEl.value = promptText;
  handleChatSubmit();
}

function clearChat() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = `
    <div class="flex gap-3">
      <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-sm font-semibold shadow-sm">
        AI
      </div>
      <div class="chat-bubble-bot p-4 max-w-[85%]">
        <div class="markdown-content">
          <p class="font-semibold text-slate-900 mb-1">Percakapan telah diperbarui. Silakan ajukan pertanyaan atau keluhan layanan publik Anda.</p>
        </div>
      </div>
    </div>
  `;
  chatHistory = [];
  if (window.lucide) lucide.createIcons();
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

// Convert draft from chat into official ticket immediately
async function publishDraftTicket(encodedDraft) {
  try {
    const draft = JSON.parse(decodeURIComponent(encodedDraft));
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterName: 'Warga (via Chat AI)',
        phone: 'Melalui Chatbot',
        category: draft.category,
        categoryName: draft.categoryName,
        title: draft.title,
        description: draft.description,
        location: 'Tercatat dalam percakapan chat',
        urgency: draft.urgency || 'Sedang',
        source: 'Chatbot AI'
      })
    });

    const data = await res.json();
    if (data.ticket) {
      showToast(`Tiket resmi ${data.ticket.id} berhasil diterbitkan!`);
      appendBotMessage(`🎉 **Tiket Berhasil Diterbitkan!**\n\nNomor Laporan Anda: \`${data.ticket.id}\`\n\nLaporan ini sudah diteruskan ke **${data.ticket.assignedDinas}** untuk segera ditindaklanjuti. Anda dapat mengecek status perkembangan laporan kapan saja dengan mengetik nomor tiket ini.`);
      loadAdminData();
    }
  } catch (err) {
    console.error('Error creating ticket from draft:', err);
    showToast('Gagal membuat tiket otomatis.');
  }
}

// Prefill form from chat suggestion
function prefillForm(encodedDraft) {
  const draft = JSON.parse(decodeURIComponent(encodedDraft));
  switchTab('form');
  document.getElementById('form-category').value = draft.category || 'pupr';
  document.getElementById('form-title').value = draft.title || '';
  document.getElementById('form-desc').value = draft.description || '';
  document.getElementById('form-urgency').value = draft.urgency || 'Sedang';
  showToast('Draf keluhan telah dimuat ke formulir!');
}

// ==========================================
// SPEECH RECOGNITION & TTS
// ==========================================
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('Web Speech API not supported in this browser');
    return;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.lang = 'id-ID';
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;

  speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('chat-input').value = transcript;
    toggleVoiceRecognition();
    showToast('Suara terdeteksi: ' + transcript);
  };

  speechRecognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    toggleVoiceRecognition();
  };

  speechRecognition.onend = () => {
    isListening = false;
    updateMicButtonUI();
  };
}

function toggleVoiceRecognition() {
  if (!speechRecognition) {
    alert('Browser Anda belum mendukung input suara. Silakan gunakan Google Chrome atau Edge.');
    return;
  }

  if (isListening) {
    speechRecognition.stop();
    isListening = false;
  } else {
    try {
      speechRecognition.start();
      isListening = true;
    } catch (e) {
      console.warn('Voice restart error', e);
    }
  }
  updateMicButtonUI();
}

function updateMicButtonUI() {
  const btn = document.getElementById('btn-mic');
  const status = document.getElementById('speech-status');
  if (isListening) {
    btn.classList.add('text-red-600', 'animate-pulse');
    status.classList.remove('hidden');
  } else {
    btn.classList.remove('text-red-600', 'animate-pulse');
    status.classList.add('hidden');
  }
}

function speakChatMessage(elementId) {
  const el = document.getElementById(elementId);
  if (!el || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const text = el.innerText || el.textContent;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'id-ID';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ==========================================
// TICKET TRACKING
// ==========================================
async function handleTrackSearch(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('track-search-input');
  const ticketId = input.value.trim();
  if (!ticketId) return;
  fetchAndRenderTicket(ticketId);
}

function handleQuickTrack() {
  const input = document.getElementById('quick-track-input');
  const ticketId = input.value.trim();
  if (!ticketId) return;
  setAndTrack(ticketId);
}

function setAndTrack(ticketId) {
  switchTab('track');
  document.getElementById('track-search-input').value = ticketId;
  fetchAndRenderTicket(ticketId);
}

async function fetchAndRenderTicket(ticketId) {
  const container = document.getElementById('track-result-container');
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="p-8 text-center text-slate-500">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-2"></div>
      <p class="text-xs">Mencari data pengaduan ${ticketId}...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`);
    if (!res.ok) {
      container.innerHTML = `
        <div class="p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
          <i data-lucide="alert-circle" class="w-10 h-10 text-red-500 mx-auto mb-2"></i>
          <h4 class="font-bold text-red-900 text-base">Tiket Tidak Ditemukan</h4>
          <p class="text-xs text-red-700 mt-1">Nomor tiket <b>${escapeHtml(ticketId)}</b> tidak terdaftar di sistem. Periksa kembali ejaan nomor tiket Anda.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const ticket = await res.json();
    renderTicketDetail(ticket, container);
  } catch (err) {
    console.error('Tracking error:', err);
    container.innerHTML = `
      <div class="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-xs text-red-700">
        Terjadi kesalahan saat memuat data tiket.
      </div>
    `;
  }
}

function renderTicketDetail(t, container) {
  const statusClasses = {
    'MENUNGGU': 'badge-menunggu',
    'DIPROSES': 'badge-diproses',
    'SELESAI': 'badge-selesai',
    'DITOLAK': 'badge-ditolak'
  };

  const currentBadge = statusClasses[t.status] || 'badge-menunggu';

  // Stepper state
  const isMenungguActive = true;
  const isDiprosesActive = t.status === 'DIPROSES' || t.status === 'SELESAI';
  const isSelesaiActive = t.status === 'SELESAI';

  let timelineHtml = '';
  if (t.timeline && t.timeline.length > 0) {
    timelineHtml = t.timeline.map((item, idx) => `
      <div class="flex gap-4 relative">
        ${idx !== t.timeline.length - 1 ? '<div class="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-200"></div>' : ''}
        <div class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 z-10 text-xs font-bold">
          ${idx + 1}
        </div>
        <div class="pb-4">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-slate-900 text-xs">${item.status}</span>
            <span class="text-[10px] text-slate-400">• ${new Date(item.timestamp).toLocaleString('id-ID')}</span>
          </div>
          <p class="text-xs text-slate-700 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">${escapeHtml(item.note)}</p>
          <span class="text-[10px] text-slate-500 font-medium">Petugas: ${escapeHtml(item.by || 'Sistem')}</span>
        </div>
      </div>
    `).join('');
  }

  container.innerHTML = `
    <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
      
      <!-- Ticket Header -->
      <div class="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-lg font-bold font-mono tracking-wider">${t.id}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${currentBadge}">${t.status}</span>
          </div>
          <p class="text-xs text-blue-200 mt-0.5">Dibuat pada ${new Date(t.createdAt).toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
        </div>
        <div class="text-right">
          <span class="text-xs text-slate-300 block">Urgensi: <b>${t.urgency}</b></span>
          <span class="text-xs text-slate-300 block">Kanal: <b>${t.source}</b></span>
        </div>
      </div>

      <!-- Stepper Progress Bar -->
      <div class="p-5 border-b border-slate-100 bg-slate-50/50">
        <div class="grid grid-cols-3 gap-2 text-center text-xs font-medium">
          <div class="flex flex-col items-center">
            <div class="w-8 h-8 rounded-full ${isMenungguActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center font-bold mb-1 shadow-sm">
              ✓
            </div>
            <span class="text-slate-800">1. Terverifikasi</span>
          </div>
          <div class="flex flex-col items-center">
            <div class="w-8 h-8 rounded-full ${isDiprosesActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center font-bold mb-1 shadow-sm">
              ${isDiprosesActive ? '✓' : '2'}
            </div>
            <span class="${isDiprosesActive ? 'text-blue-700 font-bold' : 'text-slate-400'}">2. Ditangani Dinas</span>
          </div>
          <div class="flex flex-col items-center">
            <div class="w-8 h-8 rounded-full ${isSelesaiActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center font-bold mb-1 shadow-sm">
              ${isSelesaiActive ? '✓' : '3'}
            </div>
            <span class="${isSelesaiActive ? 'text-emerald-700 font-bold' : 'text-slate-400'}">3. Tuntas / Selesai</span>
          </div>
        </div>
      </div>

      <!-- Ticket Main Information -->
      <div class="p-5 space-y-4">
        <div>
          <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Judul Aduan</span>
          <h3 class="text-base font-bold text-slate-900 mt-0.5">${escapeHtml(t.title)}</h3>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <span class="text-slate-400 block">Dinas Penanggung Jawab:</span>
            <span class="font-semibold text-slate-800">${escapeHtml(t.assignedDinas)}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Kategori Layanan:</span>
            <span class="font-semibold text-slate-800">${escapeHtml(t.categoryName || t.category)}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Nama Pelapor:</span>
            <span class="font-semibold text-slate-800">${escapeHtml(t.reporterName)}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Lokasi Kejadian:</span>
            <span class="font-semibold text-slate-800">${escapeHtml(t.location)}</span>
          </div>
        </div>

        <div>
          <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi Rinci</span>
          <p class="text-xs text-slate-700 leading-relaxed mt-1 p-3 bg-white border border-slate-200 rounded-xl whitespace-pre-wrap">${escapeHtml(t.description)}</p>
        </div>

        <!-- Timeline Log -->
        <div class="pt-2">
          <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Histori Tindak Lanjut Petugas</span>
          <div class="space-y-1">
            ${timelineHtml}
          </div>
        </div>

      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// FORMULIR PENGADUAN MANDIRI
// ==========================================
async function handlePublicReportSubmit(e) {
  e.preventDefault();
  const reporterName = document.getElementById('form-reporter').value.trim();
  const phone = document.getElementById('form-phone').value.trim();
  const category = document.getElementById('form-category').value;
  const urgency = document.getElementById('form-urgency').value;
  const title = document.getElementById('form-title').value.trim();
  const location = document.getElementById('form-location').value.trim();
  const description = document.getElementById('form-desc').value.trim();

  const btnSubmit = document.getElementById('btn-submit-form');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span>Mengirimkan Laporan...</span>';

  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterName,
        phone,
        category,
        urgency,
        title,
        location,
        description,
        source: 'Form Pengaduan Portal'
      })
    });

    const data = await res.json();
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `
      <i data-lucide="check-circle" class="w-4 h-4"></i>
      <span>Kirimkan Pengaduan & Dapatkan Tiket</span>
    `;

    if (data.ticket) {
      showToast(`Laporan berhasil dikirim! Nomor Tiket: ${data.ticket.id}`);
      document.getElementById('public-report-form').reset();
      removeUploadedImage();

      // Switch to tracking tab to show user their new ticket!
      setAndTrack(data.ticket.id);
      loadAdminData();
    }
  } catch (err) {
    console.error('Error submitting form:', err);
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<span>Kirimkan Pengaduan</span>';
    alert('Terjadi kesalahan saat mengirim pengaduan.');
  }

  if (window.lucide) lucide.createIcons();
}

function previewUploadedImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('upload-preview').src = e.target.result;
    document.getElementById('upload-placeholder').classList.add('hidden');
    document.getElementById('upload-preview-container').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeUploadedImage() {
  document.getElementById('form-file').value = '';
  document.getElementById('upload-preview').src = '';
  document.getElementById('upload-placeholder').classList.remove('hidden');
  document.getElementById('upload-preview-container').classList.add('hidden');
}

// ==========================================
// KATALOG & SYARAT LAYANAN
// ==========================================
async function loadKnowledge() {
  try {
    const res = await fetch('/api/knowledge');
    const data = await res.json();
    allCategories = data.categories || [];
    allFaqs = data.faqs || [];

    renderCatalogCategoryPills();
    renderCatalogFaqs();
  } catch (err) {
    console.error('Error loading knowledge:', err);
  }
}

function renderCatalogCategoryPills() {
  const container = document.getElementById('catalog-category-pills');
  if (!container) return;

  let html = `
    <button onclick="filterCatalogByCategory('ALL')" class="cat-pill px-3 py-1.5 rounded-full text-xs font-semibold ${activeCatalogCategory === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'} transition">
      Semua Kategori
    </button>
  `;

  allCategories.forEach(cat => {
    const isActive = activeCatalogCategory === cat.id;
    html += `
      <button onclick="filterCatalogByCategory('${cat.id}')" class="cat-pill px-3 py-1.5 rounded-full text-xs font-semibold ${isActive ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'} transition">
        ${escapeHtml(cat.name)}
      </button>
    `;
  });

  container.innerHTML = html;
}

function filterCatalogByCategory(catId) {
  activeCatalogCategory = catId;
  renderCatalogCategoryPills();
  renderCatalogFaqs();
}

function filterCatalog(keyword) {
  renderCatalogFaqs(keyword);
}

function renderCatalogFaqs(filterKeyword = '') {
  const container = document.getElementById('catalog-faq-list');
  if (!container) return;

  let filtered = allFaqs;

  if (activeCatalogCategory !== 'ALL') {
    filtered = filtered.filter(f => f.categoryId === activeCatalogCategory);
  }

  if (filterKeyword.trim()) {
    const kw = filterKeyword.toLowerCase();
    filtered = filtered.filter(f =>
      f.title.toLowerCase().includes(kw) ||
      f.summary.toLowerCase().includes(kw) ||
      f.keywords.some(k => k.toLowerCase().includes(kw))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
        Tidak ditemukan panduan layanan dengan kata kunci tersebut.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((faq, index) => {
    const cat = allCategories.find(c => c.id === faq.categoryId);
    return `
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <button onclick="toggleFaqAccordion('faq-body-${index}')" class="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50/50 transition">
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
              ${index + 1}
            </span>
            <div>
              <h4 class="font-bold text-slate-900 text-sm">${escapeHtml(faq.title)}</h4>
              <p class="text-xs text-slate-500">${cat ? cat.name : ''} • Biaya: <b class="text-emerald-600">${faq.biaya}</b></p>
            </div>
          </div>
          <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400"></i>
        </button>

        <div id="faq-body-${index}" class="hidden p-4 pt-1 border-t border-slate-100 bg-slate-50/30 text-xs space-y-3">
          <p class="text-slate-700">${escapeHtml(faq.summary)}</p>
          
          <div>
            <span class="font-semibold text-slate-800 block mb-1">Syarat & Alur Pelayanan:</span>
            <ol class="list-decimal pl-4 space-y-1 text-slate-600">
              ${faq.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ol>
          </div>

          <div class="flex flex-wrap gap-4 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>⏱️ Waktu Proses: <b>${faq.waktu}</b></span>
            <span>💰 Biaya Retribusi: <b>${faq.biaya}</b></span>
            <span>🏢 Instansi: <b>${cat ? cat.dinas : '-'}</b></span>
          </div>

          <div class="pt-1">
            <button onclick="askFaqToChat('${escapeHtml(faq.title)}')" class="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold rounded-lg text-xs transition flex items-center gap-1">
              <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
              Tanyakan Lebih Detail ke AI
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function toggleFaqAccordion(bodyId) {
  const el = document.getElementById(bodyId);
  if (el) el.classList.toggle('hidden');
}

function askFaqToChat(faqTitle) {
  switchTab('chat');
  sendQuickPrompt(faqTitle);
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================
async function loadAdminData() {
  try {
    // 1. Fetch Stats
    const statsRes = await fetch('/api/stats');
    const stats = await statsRes.json();
    document.getElementById('stat-total').textContent = stats.total || 0;
    document.getElementById('stat-menunggu').textContent = stats.menunggu || 0;
    document.getElementById('stat-diproses').textContent = stats.diproses || 0;
    document.getElementById('stat-selesai').textContent = stats.selesai || 0;

    // 2. Fetch Tickets
    const ticketsRes = await fetch('/api/tickets');
    allAdminTickets = await ticketsRes.json();
    renderAdminTable();
  } catch (err) {
    console.error('Error loading admin data:', err);
  }
}

function filterAdminTickets(status) {
  activeAdminStatusFilter = status;
  document.querySelectorAll('.filter-status-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-blue-600', 'text-white');
    btn.classList.add('bg-slate-100', 'text-slate-600');
  });

  const activeBtn = document.getElementById(`filter-${status}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-blue-600', 'text-white');
    activeBtn.classList.remove('bg-slate-100', 'text-slate-600');
  }

  renderAdminTable();
}

function handleAdminSearch(val) {
  renderAdminTable(val);
}

function renderAdminTable(searchQuery = '') {
  const tbody = document.getElementById('admin-tickets-tbody');
  if (!tbody) return;

  let filtered = allAdminTickets;
  if (activeAdminStatusFilter !== 'SEMUA') {
    filtered = filtered.filter(t => t.status === activeAdminStatusFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      (t.reporterName && t.reporterName.toLowerCase().includes(q)) ||
      (t.location && t.location.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-slate-400">Tidak ada laporan dengan filter saat ini.</td>
      </tr>
    `;
    return;
  }

  const badgeClasses = {
    'MENUNGGU': 'badge-menunggu',
    'DIPROSES': 'badge-diproses',
    'SELESAI': 'badge-selesai',
    'DITOLAK': 'badge-ditolak'
  };

  tbody.innerHTML = filtered.map(t => `
    <tr class="hover:bg-slate-50/70 transition">
      <td class="px-4 py-3 font-mono font-bold text-blue-600 whitespace-nowrap cursor-pointer hover:underline" onclick="setAndTrack('${t.id}')">
        ${t.id}
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        <div class="font-semibold text-slate-800">${escapeHtml(t.reporterName)}</div>
        <div class="text-[10px] text-slate-400">${escapeHtml(t.phone)}</div>
      </td>
      <td class="px-4 py-3">
        <div class="font-medium text-slate-900 max-w-xs truncate" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
        <div class="text-[10px] text-slate-500">${escapeHtml(t.categoryName || t.category)}</div>
      </td>
      <td class="px-4 py-3 max-w-xs truncate text-slate-600" title="${escapeHtml(t.location)}">
        ${escapeHtml(t.location)}
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${t.urgency === 'Tinggi' || t.urgency === 'Darurat' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}">
          ${t.urgency}
        </span>
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${badgeClasses[t.status] || 'badge-menunggu'}">
          ${t.status}
        </span>
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        <button onclick="openStatusModal('${t.id}', '${t.status}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition">
          <i data-lucide="edit-2" class="w-3 h-3"></i>
          Update
        </button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

// Modal handling
function openStatusModal(ticketId, currentStatus) {
  document.getElementById('modal-ticket-id').value = ticketId;
  document.getElementById('modal-ticket-status').value = currentStatus;
  document.getElementById('modal-ticket-note').value = '';
  document.getElementById('status-modal').classList.remove('hidden');
}

function closeStatusModal() {
  document.getElementById('status-modal').classList.add('hidden');
}

async function submitStatusUpdate() {
  const ticketId = document.getElementById('modal-ticket-id').value;
  const status = document.getElementById('modal-ticket-status').value;
  const note = document.getElementById('modal-ticket-note').value.trim();
  const by = document.getElementById('modal-ticket-by').value.trim();

  try {
    const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note, by })
    });

    const data = await res.json();
    if (data.ticket) {
      showToast(`Status tiket ${ticketId} berhasil diperbarui!`);
      closeStatusModal();
      loadAdminData();
    }
  } catch (err) {
    console.error('Error updating status:', err);
    alert('Gagal memperbarui status tiket.');
  }
}

// ==========================================
// UTILITIES: TOAST & MARKDOWN PARSER
// ==========================================
function showToast(message) {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toast-text');
  text.textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(md) {
  if (!md) return '';
  let html = md;

  // Headers ###
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  // Headers ##
  html = html.replace(/^## (.*$)/gim, '<h3 class="text-base font-bold text-slate-900 mb-2">$1</h3>');

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italics *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline code `code`
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Blockquotes > quote
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Lists: unordered * or -
  html = html.replace(/^\s*[\-\*]\s+(.*)$/gim, '<li>$1</li>');

  // Lists: ordered 1. 2.
  html = html.replace(/^\s*\d+\.\s+(.*)$/gim, '<li>$1</li>');

  // Wrap lists
  html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');

  // Line breaks to <p>
  const paragraphs = html.split('\n\n');
  return paragraphs.map(p => {
    if (p.startsWith('<h3>') || p.startsWith('<ul>') || p.startsWith('<blockquote>')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}
