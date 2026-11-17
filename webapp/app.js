// BioCoach AI - Frontend Logic & Mobile PWA Client

document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initNavigation();
  initDashboard();
  initNutrition();
  initChat();
  initManualSync();
  initShortcutsModal();
});

// 1. PWA Service Worker Registration
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// 2. Three-Tab Navigation (iOS Native Look and Feel)
function initNavigation() {
  const btnDashboard = document.getElementById('nav-btn-dashboard');
  const btnNutrition = document.getElementById('nav-btn-nutrition');
  const btnChat = document.getElementById('nav-btn-chat');

  const viewDashboard = document.getElementById('view-dashboard');
  const viewNutrition = document.getElementById('view-nutrition');
  const viewChat = document.getElementById('view-chat');

  function setActiveTab(activeBtn, activeView) {
    [viewDashboard, viewNutrition, viewChat].forEach((v) => v.classList.add('hidden'));
    activeView.classList.remove('hidden');

    [btnDashboard, btnNutrition, btnChat].forEach((b) => {
      b.className = 'flex flex-col items-center gap-1 text-slate-400 hover:text-white py-1 px-4 transition-colors';
    });

    if (activeBtn === btnDashboard) {
      activeBtn.className = 'flex flex-col items-center gap-1 text-emerald-400 py-1 px-4 transition-colors';
    } else if (activeBtn === btnNutrition) {
      activeBtn.className = 'flex flex-col items-center gap-1 text-teal-300 py-1 px-4 transition-colors';
    } else {
      activeBtn.className = 'flex flex-col items-center gap-1 text-indigo-400 py-1 px-4 transition-colors';
    }
  }

  btnDashboard.addEventListener('click', () => setActiveTab(btnDashboard, viewDashboard));
  btnNutrition.addEventListener('click', () => {
    setActiveTab(btnNutrition, viewNutrition);
    // Auto-calculate on first visit if not yet populated
    if (document.getElementById('nutr-target-kcal').textContent === '--') {
      document.getElementById('nutrition-form').dispatchEvent(new Event('submit'));
    }
  });
  btnChat.addEventListener('click', () => setActiveTab(btnChat, viewChat));
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
    const heroStatus = document.getElementById('hero-status-text');
    if (heroStatus) heroStatus.textContent = 'Modo sin conexión o primer inicio';
  }
}

function renderDashboard(data) {
  const today = data.today;
  const banner = document.getElementById('empty-state-banner');

  if (!today) {
    document.getElementById('hero-score').textContent = '--';
    document.getElementById('hero-status-text').textContent = 'Esperando primer registro del Apple Watch';
    if (banner) banner.classList.remove('hidden');
    renderWeeklyCalendar(data.weekly_calendar || []);
    return;
  }

  // Hide empty state banner when telemetry is present
  if (banner) banner.classList.add('hidden');

  // Hero Score Card
  const score = today.score || 50;
  document.getElementById('hero-score').textContent = score;
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

  // Key biometric cards
  document.getElementById('card-hrv').innerHTML = `${today.hrv ? Math.round(today.hrv) : '--'} <span class="text-xs font-normal text-slate-400">ms</span>`;
  document.getElementById('card-rhr').innerHTML = `${today.rhr ? Math.round(today.rhr) : '--'} <span class="text-xs font-normal text-slate-400">bpm</span>`;
  document.getElementById('card-sleep').innerHTML = `${today.sleep ? Number(today.sleep).toFixed(1) : '--'} <span class="text-xs font-normal text-slate-400">h</span>`;

  // Render Daily Balance / Progress Bar
  renderDailyBalance(score, data.recent_workouts);

  // Render Worst Aspect Callout if flagged
  renderWorstAspect(today.worst_aspect);

  // Render 7-day Weekly Calendar Matrix with 3 Pillars
  renderWeeklyCalendar(data.weekly_calendar || []);

  // Render 7-day trend bars
  renderChartBars(data.trends);

  // Render recent workouts
  renderWorkouts(data.recent_workouts);
}

// 4. Daily Progress / Strain Balance Bar
function renderDailyBalance(recoveryScore, recentWorkouts) {
  const bar = document.getElementById('daily-strain-progress');
  const capLabel = document.getElementById('balance-cap-val');
  const strainLabel = document.getElementById('balance-strain-val');
  const statusBadge = document.getElementById('daily-balance-status');

  if (!bar) return;

  capLabel.textContent = `${recoveryScore}%`;

  // Check today's workout strain
  let todayStrain = 0;
  if (recentWorkouts && recentWorkouts.length > 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayW = recentWorkouts.find(w => w.date === todayStr);
    if (todayW) todayStrain = todayW.strain || 8.0;
  }

  // Compute balance percentage: recovery vs strain
  const pct = Math.min(100, Math.max(15, Math.round((recoveryScore / 100) * 80 + (todayStrain * 1.5))));
  bar.style.width = `${pct}%`;

  if (recoveryScore >= 75) {
    statusBadge.textContent = '🟢 En Balance Óptimo';
    statusBadge.className = 'text-xs font-bold text-emerald-400';
    strainLabel.textContent = todayStrain > 0 ? `${todayStrain.toFixed(1)}/21 Asimilado` : 'Margen para entrenar';
    strainLabel.className = 'text-emerald-400 font-bold';
  } else if (recoveryScore >= 50) {
    statusBadge.textContent = '🟡 Carga Moderada Aconsejada';
    statusBadge.className = 'text-xs font-bold text-amber-400';
    strainLabel.textContent = todayStrain > 0 ? `${todayStrain.toFixed(1)}/21 Moderada` : 'Carga moderada';
    strainLabel.className = 'text-amber-400 font-bold';
  } else {
    statusBadge.textContent = '🔴 Priorizar Descanso Activo';
    statusBadge.className = 'text-xs font-bold text-rose-400';
    strainLabel.textContent = 'Fatiga acumulada';
    strainLabel.className = 'text-rose-400 font-bold';
  }
}

// 5. Highlight Worst Aspect of the Day
function renderWorstAspect(worst) {
  const card = document.getElementById('worst-aspect-card');
  const badge = document.getElementById('worst-aspect-badge');
  const detail = document.getElementById('worst-aspect-detail');
  const icon = document.getElementById('worst-aspect-icon');

  if (!card) return;

  if (!worst || worst.severity === 'NONE') {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  detail.textContent = worst.detail || 'Monitorea tus señales fisiológicas hoy.';

  if (worst.severity === 'CRITICAL') {
    card.className = 'glass rounded-3xl p-4 my-3 border border-rose-500/40 bg-rose-500/10 relative';
    badge.textContent = 'Crítico';
    badge.className = 'px-2 py-0.5 rounded-full text-[10px] bg-rose-500/30 text-rose-300 font-black';
    icon.textContent = '🚨';
  } else if (worst.severity === 'HIGH') {
    card.className = 'glass rounded-3xl p-4 my-3 border border-rose-500/30 bg-rose-500/5 relative';
    badge.textContent = 'Alto Impacto';
    badge.className = 'px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-extrabold';
    icon.textContent = '⚠️';
  } else {
    card.className = 'glass rounded-3xl p-4 my-3 border border-amber-500/30 bg-amber-500/5 relative';
    badge.textContent = 'Atención';
    badge.className = 'px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold';
    icon.textContent = '⚡';
  }
}

// 6. Weekly Calendar Matrix with 3 Health Pillars
function renderWeeklyCalendar(calendar) {
  const grid = document.getElementById('weekly-calendar-grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!calendar || calendar.length === 0) {
    grid.innerHTML = '<p class="col-span-7 text-center text-xs text-slate-500 py-3">Registra telemetría para poblar la semana.</p>';
    return;
  }

  calendar.forEach((d) => {
    const col = document.createElement('div');
    col.className = 'glass rounded-2xl p-2 flex flex-col items-center gap-1.5 border border-slate-700/40 hover:border-slate-500 transition-all';

    // Day name and date
    const dayLabel = d.day_name || 'Día';
    const dayNum = d.date ? d.date.slice(8) : '';

    // Overall traffic light badge
    let scoreBg = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    let dotIcon = '🟢';
    if (d.traffic_light === 'YELLOW') {
      scoreBg = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      dotIcon = '🟡';
    } else if (d.traffic_light === 'RED') {
      scoreBg = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      dotIcon = '🔴';
    }

    // Pillars extraction
    const p = d.pillars || {};
    const hrvStatus = p.hrv ? p.hrv.status : 'YELLOW';
    const rhrStatus = p.rhr ? p.rhr.status : 'YELLOW';
    const sleepStatus = p.sleep ? p.sleep.status : 'YELLOW';

    const getDot = (st) => st === 'GREEN' ? '🟢' : (st === 'YELLOW' ? '🟡' : '🔴');

    col.innerHTML = `
      <span class="text-[10px] font-bold text-slate-400">${dayLabel}</span>
      <span class="text-[9px] text-slate-500 font-semibold">${dayNum}</span>
      <div class="px-1.5 py-0.5 rounded-md border text-[10px] font-extrabold ${scoreBg}">
        ${d.overall_score || '--'}
      </div>
      <div class="flex flex-col gap-1 w-full pt-1 border-t border-slate-700/50 text-[9px] text-center">
        <span title="HRV: ${p.hrv?.value || '--'}">${getDot(hrvStatus)}</span>
        <span title="FC Reposo: ${p.rhr?.value || '--'}">${getDot(rhrStatus)}</span>
        <span title="Sueño: ${p.sleep?.value || '--'}">${getDot(sleepStatus)}</span>
      </div>
    `;

    // Highlight border if severe bottleneck was present
    if (d.worst_aspect && (d.worst_aspect.severity === 'HIGH' || d.worst_aspect.severity === 'CRITICAL')) {
      col.classList.add('border-rose-500/50', 'bg-rose-500/5');
    }

    grid.appendChild(col);
  });
}

// 7. Evolution Bars (HRV Trends)
function renderChartBars(trends) {
  const container = document.getElementById('chart-bars');
  if (!container) return;
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

// 8. Workouts List
function renderWorkouts(workouts) {
  const list = document.getElementById('workouts-list');
  if (!list) return;

  if (!workouts || workouts.length === 0) {
    list.innerHTML = '<p class="text-xs text-slate-400 italic">No hay entrenamientos registrados aún.</p>';
    return;
  }

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
        <span class="text-xs font-extrabold text-emerald-400">${w.strain ? w.strain.toFixed(1) : '--'}</span>
        <p class="text-[9px] text-slate-500 uppercase">Impacto</p>
      </div>
    `;
    list.appendChild(item);
  });
}

// 9. Nutrition & Metabolism Calculator Logic
function initNutrition() {
  const form = document.getElementById('nutrition-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const weight = parseFloat(document.getElementById('nutr-weight').value);
    const height = parseFloat(document.getElementById('nutr-height').value);
    const age = parseInt(document.getElementById('nutr-age').value);
    const gender = document.getElementById('nutr-gender').value;
    const activity = document.getElementById('nutr-activity').value;
    const goalRadio = document.querySelector('input[name="nutr-goal"]:checked');
    const goal = goalRadio ? goalRadio.value : 'maintain';

    const btn = document.getElementById('btn-calc-nutrition');
    btn.textContent = 'Calculando...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/v1/metabolism', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_kg: weight,
          height_cm: height,
          age: age,
          gender: gender,
          activity_level: activity,
          goal: goal
        })
      });

      if (!res.ok) throw new Error('Error al calcular presupuesto metabólico.');
      const data = await res.json();
      renderNutritionResults(data);
    } catch (err) {
      alert('Error en el cálculo nutricional: ' + err.message);
    } finally {
      btn.textContent = 'Calcular Calorías & Macronutrientes';
      btn.disabled = false;
    }
  });
}

function renderNutritionResults(data) {
  document.getElementById('nutr-target-kcal').textContent = data.target_calories;
  document.getElementById('nutr-bmr-val').textContent = `${data.bmr} kcal`;
  document.getElementById('nutr-tdee-val').textContent = `${data.tdee} kcal`;

  const sourceBadge = document.getElementById('nutr-source-badge');
  if (data.active_calories_source === 'apple_watch') {
    sourceBadge.textContent = '🔥 Incluye entreno Apple Watch hoy';
    sourceBadge.className = 'text-[9px] text-emerald-400 font-bold';
  } else {
    sourceBadge.textContent = 'Factor de actividad estimado';
    sourceBadge.className = 'text-[9px] text-slate-400';
  }

  const goalBadge = document.getElementById('nutr-goal-badge');
  if (data.goal === 'cut') {
    goalBadge.textContent = `Déficit de ${Math.abs(data.goal_offset)} kcal para pérdida de grasa`;
    goalBadge.className = 'text-xs font-semibold text-rose-400 mt-1';
  } else if (data.goal === 'bulk') {
    goalBadge.textContent = `Superávit de +${data.goal_offset} kcal para hipertrofia limpia`;
    goalBadge.className = 'text-xs font-semibold text-teal-400 mt-1';
  } else {
    goalBadge.textContent = 'Mantenimiento del peso actual y recuperación';
    goalBadge.className = 'text-xs font-semibold text-indigo-400 mt-1';
  }

  // Macros
  const m = data.macros;
  document.getElementById('nutr-protein-g').innerHTML = `${m.protein_g} <span class="text-xs font-normal">g</span>`;
  document.getElementById('nutr-protein-kcal').textContent = `${m.protein_g * 4} kcal`;

  document.getElementById('nutr-carbs-g').innerHTML = `${m.carbs_g} <span class="text-xs font-normal">g</span>`;
  document.getElementById('nutr-carbs-kcal').textContent = `${m.carbs_g * 4} kcal`;

  document.getElementById('nutr-fat-g').innerHTML = `${m.fat_g} <span class="text-xs font-normal">g</span>`;
  document.getElementById('nutr-fat-kcal').textContent = `${m.fat_g * 9} kcal`;

  // Macro proportion visual bar
  const totalKcal = data.target_calories || 2000;
  const pKcal = m.protein_g * 4;
  const cKcal = m.carbs_g * 4;
  const fKcal = m.fat_g * 9;

  document.getElementById('bar-protein').style.width = `${(pKcal / totalKcal) * 100}%`;
  document.getElementById('bar-carbs').style.width = `${(cKcal / totalKcal) * 100}%`;
  document.getElementById('bar-fat').style.width = `${(fKcal / totalKcal) * 100}%`;

  if (data.summary) {
    document.getElementById('nutr-summary-text').textContent = `"${data.summary}"`;
  }
}

// 10. Gemini Coach Conversational Chat
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

// 11. Manual Sleep Sync Modal
function initManualSync() {
  const modal = document.getElementById('sync-modal');
  const btnOpenModal = document.getElementById('btn-open-sync-modal');
  const btnHeaderSync = document.getElementById('btn-header-sync');
  const btnCloseModal = document.getElementById('btn-close-sync-modal');
  const btnCancelSync = document.getElementById('btn-cancel-sync');
  const btnRunShortcut = document.getElementById('btn-run-shortcut-ios');
  const btnLoadDemo = document.getElementById('btn-load-demo');
  const syncForm = document.getElementById('sync-form');
  const submitBtn = document.getElementById('btn-submit-sync');

  const openModal = () => modal.classList.remove('hidden');
  const closeModal = () => modal.classList.add('hidden');

  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
  if (btnHeaderSync) btnHeaderSync.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelSync) btnCancelSync.addEventListener('click', closeModal);

  // Trigger 7-day demo data population
  if (btnLoadDemo) {
    btnLoadDemo.addEventListener('click', async () => {
      btnLoadDemo.textContent = 'Cargando datos...';
      btnLoadDemo.disabled = true;
      try {
        const res = await fetch('/api/v1/seed-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (!res.ok) throw new Error('Error al cargar datos de prueba.');
        await initDashboard();
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        btnLoadDemo.textContent = '🧪 Cargar 7 Días de Prueba';
        btnLoadDemo.disabled = false;
      }
    });
  }

  if (btnRunShortcut) {
    btnRunShortcut.addEventListener('click', () => {
      window.location.href = 'shortcuts://run-shortcut?name=Recuperaci%C3%B3n%20Matutina';
      setTimeout(() => {
        alert('Si estás en tu iPhone, el atajo se abrirá para leer tu Apple Watch. Tras completarse, refresca esta pantalla.');
      }, 1000);
    });
  }

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
        await initDashboard();
      } catch (err) {
        alert('Error al sincronizar datos: ' + err.message);
      } finally {
        submitBtn.textContent = 'Analizar y Sincronizar';
        submitBtn.disabled = false;
      }
    });
  }
}

// 12. Apple Shortcuts 1-Click Downloader Modal
function initShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  const btnOpen = document.getElementById('btn-open-shortcuts');
  const btnClose = document.getElementById('btn-close-shortcuts-modal');

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
  }
  if (btnClose && modal) {
    btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  }
}
