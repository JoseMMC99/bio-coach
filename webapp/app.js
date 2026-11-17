// BioCoach AI - Frontend Logic & PWA Client

document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initNavigation();
  initDashboard();
  initChat();
  initManualSync();
});

// 1. PWA Service Worker Registration
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// 2. Tab Navigation (iOS Native Style)
function initNavigation() {
  const btnDashboard = document.getElementById('nav-btn-dashboard');
  const btnChat = document.getElementById('nav-btn-chat');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewChat = document.getElementById('view-chat');

  btnDashboard.addEventListener('click', () => {
    viewDashboard.classList.remove('hidden');
    viewChat.classList.add('hidden');
    btnDashboard.className = 'flex flex-col items-center gap-1 text-emerald-400 py-1 px-6 transition-colors';
    btnChat.className = 'flex flex-col items-center gap-1 text-slate-400 hover:text-white py-1 px-6 transition-colors';
  });

  btnChat.addEventListener('click', () => {
    viewChat.classList.remove('hidden');
    viewDashboard.classList.add('hidden');
    btnChat.className = 'flex flex-col items-center gap-1 text-indigo-400 py-1 px-6 transition-colors';
    btnDashboard.className = 'flex flex-col items-center gap-1 text-slate-400 hover:text-white py-1 px-6 transition-colors';
  });
}

// 3. Dashboard Data Fetching and Rendering
async function initDashboard() {
  const dateEl = document.getElementById('current-date');
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'short' };
  dateEl.textContent = now.toLocaleDateString('es-ES', options);

  try {
    const res = await fetch('/api/v1/dashboard');
    if (!res.ok) throw new Error('Error al cargar métricas');
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    document.getElementById('hero-status-text').textContent = 'Modo sin conexión o primer inicio';
  }
}

function renderDashboard(data) {
  const today = data.today;
  const banner = document.getElementById('empty-state-banner');

  if (!today) {
    document.getElementById('hero-score').textContent = '--';
    document.getElementById('hero-status-text').textContent = 'Esperando primer registro del Apple Watch';
    if (banner) banner.classList.remove('hidden');
    return;
  }

  // If data exists, hide empty state banner
  if (banner) banner.classList.add('hidden');

  // Hero Score Card
  document.getElementById('hero-score').textContent = today.score || '--';
  const statusText = document.getElementById('hero-status-text');
  const iconEl = document.getElementById('score-icon');

  if (today.traffic_light === 'GREEN') {
    statusText.textContent = 'Sistema Óptimo (Recuperado)';
    statusText.className = 'text-sm font-medium mt-1 text-emerald-400';
    iconEl.textContent = '🟢';
  } else if (today.traffic_light === 'YELLOW') {
    statusText.textContent = 'Recuperación Moderada';
    statusText.className = 'text-sm font-medium mt-1 text-amber-400';
    iconEl.textContent = '🟡';
  } else {
    statusText.textContent = 'Fatiga Elevada';
    statusText.className = 'text-sm font-medium mt-1 text-rose-400';
    iconEl.textContent = '🔴';
  }

  if (today.verdict) {
    document.getElementById('gemini-daily-verdict').textContent = `"${today.verdict}"`;
  }

  // Key metric cards
  document.getElementById('card-hrv').innerHTML = `${today.hrv || '--'} <span class="text-xs font-normal text-slate-400">ms</span>`;
  document.getElementById('card-rhr').innerHTML = `${today.rhr || '--'} <span class="text-xs font-normal text-slate-400">bpm</span>`;
  document.getElementById('card-sleep').innerHTML = `${today.sleep || '--'} <span class="text-xs font-normal text-slate-400">h</span>`;

  // Render 7-day trend bars
  renderChartBars(data.trends);

  // Render recent workout cards
  renderWorkouts(data.recent_workouts);
}

function renderChartBars(trends) {
  const container = document.getElementById('chart-bars');
  container.innerHTML = '';

  if (!trends || !trends.hrv || trends.hrv.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 m-auto">Sin suficientes datos para graficar.</p>';
    return;
  }

  const maxVal = Math.max(...trends.hrv, 80);

  trends.hrv.forEach((val, idx) => {
    const heightPercent = Math.max(15, Math.min(100, (val / maxVal) * 100));
    const dayLabel = trends.dates[idx] ? trends.dates[idx].slice(8) : `D${idx+1}`;

    const col = document.createElement('div');
    col.className = 'flex-1 flex flex-col items-center gap-1.5 h-full justify-end';
    col.innerHTML = `
      <span class="text-[9px] font-bold text-slate-400">${Math.round(val)}</span>
      <div class="w-full bg-emerald-500/20 rounded-t-md hover:bg-emerald-500 transition-all cursor-pointer relative group" style="height: ${heightPercent}%">
        <div class="w-full h-full bg-emerald-400 rounded-t-md opacity-75"></div>
      </div>
      <span class="text-[9px] text-slate-500 font-semibold">${dayLabel}</span>
    `;
    container.appendChild(col);
  });
}

function renderWorkouts(workouts) {
  const list = document.getElementById('workouts-list');
  if (!workouts || workouts.length === 0) return;

  list.innerHTML = '';
  workouts.forEach((w) => {
    const item = document.createElement('div');
    item.className = 'glass p-3 rounded-2xl flex items-center justify-between border border-slate-700/30';
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-xl">🏋️</span>
        <div>
          <p class="text-xs font-bold text-white capitalize">${w.type}</p>
          <p class="text-[10px] text-slate-400">${w.duration} min • ${w.calories} kcal</p>
        </div>
      </div>
      <div class="text-right">
        <span class="text-xs font-extrabold text-emerald-400">${w.strain.toFixed(1)}</span>
        <p class="text-[9px] text-slate-500 uppercase">Impacto</p>
      </div>
    `;
    list.appendChild(item);
  });
}

// 4. Conversational Gemini Coach Chat Logic
function initChat() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const thread = document.getElementById('chat-thread');
  const pills = document.querySelectorAll('.quick-pill');

  pills.forEach((p) => {
    p.addEventListener('click', () => {
      input.value = p.textContent.trim();
      form.dispatchEvent(new Event('submit'));
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';

    const typingEl = appendTypingIndicator();

    try {
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      typingEl.remove();
      appendMessage('ai', data.reply || 'No pude procesar la respuesta en este momento.');
    } catch (err) {
      typingEl.remove();
      appendMessage('ai', 'Error de conexión con el coach. Intenta de nuevo en unos segundos.');
    }
  });

  function appendMessage(sender, text) {
    const msg = document.createElement('div');
    msg.className = 'flex items-start gap-2.5';
    if (sender === 'user') {
      msg.innerHTML = `
        <div class="ml-auto glass bg-emerald-500/10 border-emerald-500/20 p-3.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed max-w-[85%] text-white">
          ${text}
        </div>
      `;
    } else {
      msg.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">AI</div>
        <div class="glass p-3.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed max-w-[85%] text-slate-200">
          ${text}
        </div>
      `;
    }
    thread.appendChild(msg);
    thread.scrollTop = thread.scrollHeight;
    return msg;
  }

  function appendTypingIndicator() {
    const typing = document.createElement('div');
    typing.className = 'flex items-start gap-2.5';
    typing.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">AI</div>
      <div class="glass p-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
      </div>
    `;
    thread.appendChild(typing);
    thread.scrollTop = thread.scrollHeight;
    return typing;
  }
}

// 5. Manual Sleep Sync and Shortcuts Triggering
function initManualSync() {
  const modal = document.getElementById('sync-modal');
  const btnOpenModal = document.getElementById('btn-open-sync-modal');
  const btnHeaderSync = document.getElementById('btn-header-sync');
  const btnCloseModal = document.getElementById('btn-close-sync-modal');
  const btnCancelSync = document.getElementById('btn-cancel-sync');
  const btnRunShortcut = document.getElementById('btn-run-shortcut-ios');
  const syncForm = document.getElementById('sync-form');
  const submitBtn = document.getElementById('btn-submit-sync');

  const openModal = () => modal.classList.remove('hidden');
  const closeModal = () => modal.classList.add('hidden');

  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
  if (btnHeaderSync) btnHeaderSync.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelSync) btnCancelSync.addEventListener('click', closeModal);

  // Trigger Apple Shortcut on iOS Safari
  if (btnRunShortcut) {
    btnRunShortcut.addEventListener('click', () => {
      // Shortcuts URL scheme native to iOS
      window.location.href = 'shortcuts://run-shortcut?name=Recuperaci%C3%B3n%20Matutina';
      setTimeout(() => {
        alert('Si estás en tu iPhone, el atajo se abrirá para leer tu Apple Watch. Tras completarse, refresca esta pantalla.');
      }, 1000);
    });
  }

  // Handle Manual Form Submission
  if (syncForm) {
    syncForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const sleepHours = document.getElementById('input-sleep').value;
      const hrvVal = document.getElementById('input-hrv').value;
      const rhrVal = document.getElementById('input-rhr').value;
      const deepVal = document.getElementById('input-deep').value;
      const remVal = document.getElementById('input-rem').value;

      if (!sleepHours) return;

      const payload = {
        sleep_hours: parseFloat(sleepHours),
        hrv_ms: hrvVal ? parseFloat(hrvVal) : null,
        resting_hr: rhrVal ? parseFloat(rhrVal) : null,
        deep_sleep_hours: deepVal ? parseFloat(deepVal) : null,
        rem_sleep_hours: remVal ? parseFloat(remVal) : null
      };

      submitBtn.textContent = 'Analizando con Gemini...';
      submitBtn.disabled = true;

      try {
        const res = await fetch('/api/v1/recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Error al registrar recuperación.');
        
        closeModal();
        syncForm.reset();
        await initDashboard(); // Refresh metrics with the new calculation!
      } catch (err) {
        alert('Error al sincronizar datos: ' + err.message);
      } finally {
        submitBtn.textContent = 'Analizar y Sincronizar';
        submitBtn.disabled = false;
      }
    });
  }
}
