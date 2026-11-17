// BioCoach AI - Frontend Engine & Autonomous Mobile PWA Client
// Runs 100% standalone in Safari/Chrome connecting directly to Supabase and Google Gemini.

// Supabase Cloud Configuration (PostgreSQL 24/7)
const SUPABASE_CONFIG = {
  url: "https://elizdnhmmhjrcdfmxxlg.supabase.co",
  publishableKey: "sb_publishable_52J4Pni9JZK-iNcaoznbEg_YHbxCEi5"
};

// Built-in Gemini API Key (stored in localStorage if user updates it)
const DEFAULT_GEMINI_KEY = atob("QVEuQWI4Uk42TE1aT3YxVVVNYWJxa0ZXQVBHSWlSa05jbkVqbVI3azd5dVRsTFNWMmVfcHc=");

// Global State (zero fake defaults; populated dynamically from localStorage + Supabase)
window.currentNutritionState = {
  weight: 75,
  height: 175,
  age: 26,
  gender: 'male',
  activity: 'moderate',
  goal: 'maintain',
  bmr: 0,
  tdee: 0,
  targetKcal: 0,
  consumedToday: 0,
  macros: { protein: 0, carbs: 0, fat: 0 }
};

document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initNavigation();
  initDashboardSubTabs();
  initDiscreetVaultAccess();
  initNutritionTabs();
  initDashboard();
  initNutrition();
  initChat();
  initManualSync();
  initShortcutsModal();
});

// 1. PWA Service Worker Registration (Auto-updates immediately when new deployment lands)
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
  }
}

// 2. Responsive Dual Navigation (Desktop Center Tabs & iPhone Bottom Bar)
function initNavigation() {
  // Mobile navigation buttons
  const mobDashboard = document.getElementById('nav-btn-dashboard');
  const mobNutrition = document.getElementById('nav-btn-nutrition');
  const mobChat = document.getElementById('nav-btn-chat');

  // Desktop navigation buttons
  const deskDashboard = document.getElementById('desk-btn-dashboard');
  const deskNutrition = document.getElementById('desk-btn-nutrition');
  const deskChat = document.getElementById('desk-btn-chat');

  // Main view containers
  const viewDashboard = document.getElementById('view-dashboard');
  const viewNutrition = document.getElementById('view-nutrition');
  const viewChat = document.getElementById('view-chat');

  function switchView(target) {
    [viewDashboard, viewNutrition, viewChat].forEach(v => v && v.classList.add('hidden'));

    // Reset mobile buttons
    [mobDashboard, mobNutrition, mobChat].forEach(b => {
      if (b) b.className = 'flex flex-col items-center gap-1 text-slate-400 hover:text-white py-1 px-4 transition-colors';
    });

    // Reset desktop buttons
    [deskDashboard, deskNutrition, deskChat].forEach(b => {
      if (b) b.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all';
    });

    if (target === 'dashboard') {
      if (viewDashboard) viewDashboard.classList.remove('hidden');
      if (mobDashboard) mobDashboard.className = 'flex flex-col items-center gap-1 text-cyan-400 py-1 px-4 transition-colors';
      if (deskDashboard) deskDashboard.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-cyan-400 bg-cyan-500/10 transition-all';
    } else if (target === 'nutrition') {
      if (viewNutrition) viewNutrition.classList.remove('hidden');
      if (mobNutrition) mobNutrition.className = 'flex flex-col items-center gap-1 text-amber-400 py-1 px-4 transition-colors';
      if (deskNutrition) deskNutrition.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-amber-400 bg-amber-500/10 transition-all';
      updateNutritionDisplay();
    } else if (target === 'chat') {
      if (viewChat) viewChat.classList.remove('hidden');
      if (mobChat) mobChat.className = 'flex flex-col items-center gap-1 text-violet-400 py-1 px-4 transition-colors';
      if (deskChat) deskChat.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-violet-400 bg-violet-500/10 transition-all';
    }
  }

  if (mobDashboard) mobDashboard.addEventListener('click', () => switchView('dashboard'));
  if (deskDashboard) deskDashboard.addEventListener('click', () => switchView('dashboard'));

  if (mobNutrition) mobNutrition.addEventListener('click', () => switchView('nutrition'));
  if (deskNutrition) deskNutrition.addEventListener('click', () => switchView('nutrition'));

  if (mobChat) mobChat.addEventListener('click', () => switchView('chat'));
  if (deskChat) deskChat.addEventListener('click', () => switchView('chat'));
}

// 2b. Dashboard Sub-Tabs (Vitales & Sueño | Ejercicio & Marcha | Alertas Clínicas)
function initDashboardSubTabs() {
  const btnVitals = document.getElementById('dash-subtab-vitals');
  const btnExercise = document.getElementById('dash-subtab-exercise');
  const btnAlerts = document.getElementById('dash-subtab-alerts');
  const btnJumpAlerts = document.getElementById('btn-jump-to-alerts');

  const panelVitals = document.getElementById('dash-panel-vitals');
  const panelExercise = document.getElementById('dash-panel-exercise');
  const panelAlerts = document.getElementById('dash-panel-alerts');
  const strip = document.getElementById('clinical-alerts-strip');

  if (!btnVitals || !btnExercise || !btnAlerts) return;

  const baseInactive = 'flex-1 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold text-slate-400 hover:text-white transition-all';
  const baseInactiveAlerts = `${baseInactive} flex items-center justify-center gap-1.5`;

  function switchSubTab(tab) {
    [panelVitals, panelExercise, panelAlerts].forEach(p => p && p.classList.add('hidden'));
    btnVitals.className = baseInactive;
    btnExercise.className = baseInactive;
    btnAlerts.className = baseInactiveAlerts;

    if (tab === 'vitals') {
      if (panelVitals) panelVitals.classList.remove('hidden');
      btnVitals.className = 'flex-1 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold text-cyan-400 bg-cyan-500/15 transition-all';
      const unread = getUnreadAlerts(window.currentDashboardData?.clinical_alerts || []);
      if (strip && unread.length > 0) strip.classList.remove('hidden');
    } else if (tab === 'exercise') {
      if (panelExercise) panelExercise.classList.remove('hidden');
      btnExercise.className = 'flex-1 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold text-emerald-400 bg-emerald-500/15 transition-all';
      if (strip) strip.classList.add('hidden');
    } else if (tab === 'alerts') {
      if (panelAlerts) panelAlerts.classList.remove('hidden');
      btnAlerts.className = 'flex-1 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold text-rose-400 bg-rose-500/15 transition-all flex items-center justify-center gap-1.5';
      if (strip) strip.classList.add('hidden');
      // Opening Alerts marks current alerts as read (clears notification badge immediately)
      if (window.currentDashboardData?.clinical_alerts) {
        markAlertsAsRead(window.currentDashboardData.clinical_alerts);
        renderClinicalAlerts(window.currentDashboardData.clinical_alerts);
      }
    }
  }

  btnVitals.addEventListener('click', () => switchSubTab('vitals'));
  btnExercise.addEventListener('click', () => switchSubTab('exercise'));
  btnAlerts.addEventListener('click', () => switchSubTab('alerts'));
  if (btnJumpAlerts) btnJumpAlerts.addEventListener('click', () => switchSubTab('alerts'));

  // Range selector buttons (Diario=1, 7 Días=7, 15 Días=15)
  window.activeHistoryRange = 7;
  const rangeButtons = document.querySelectorAll('.range-btn');
  rangeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.getAttribute('data-range') || '7', 10);
      window.activeHistoryRange = days;
      rangeButtons.forEach(b => {
        const active = parseInt(b.getAttribute('data-range'), 10) === days;
        b.className = active
          ? 'range-btn px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-cyan-400 bg-cyan-500/15 transition-all'
          : 'range-btn px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-slate-400 hover:text-white transition-all';
      });
      if (window.currentDashboardData) {
        applyActiveRangeViews(window.currentDashboardData);
      }
    });
  });

  // Manual "Marcar leídas" button inside Alerts tab
  const btnMarkRead = document.getElementById('btn-mark-alerts-read');
  if (btnMarkRead) {
    btnMarkRead.addEventListener('click', () => {
      if (window.currentDashboardData?.clinical_alerts) {
        markAlertsAsRead(window.currentDashboardData.clinical_alerts);
        renderClinicalAlerts(window.currentDashboardData.clinical_alerts);
        showToast('Alertas marcadas como leídas', 'success');
      }
    });
  }
}

// Notification Read/Unread state persisted in localStorage
function getReadAlertIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem('BIOCOACH_READ_ALERTS') || '[]'));
  } catch {
    return new Set();
  }
}

function markAlertsAsRead(alerts) {
  const readSet = getReadAlertIds();
  (alerts || []).forEach(a => { if (a.id) readSet.add(a.id); });
  localStorage.setItem('BIOCOACH_READ_ALERTS', JSON.stringify([...readSet]));
}

function getUnreadAlerts(alerts) {
  const readSet = getReadAlertIds();
  return (alerts || []).filter(a => !readSet.has(a.id));
}

// 3. Nutrition Sub-Tabs (Balance & Calorías vs Metas & Configuración)
function initNutritionTabs() {
  const btnBalance = document.getElementById('nutr-subtab-balance');
  const btnGoals = document.getElementById('nutr-subtab-goals');
  const panelBalance = document.getElementById('nutr-panel-balance');
  const panelGoals = document.getElementById('nutr-panel-goals');

  if (!btnBalance || !btnGoals) return;

  btnBalance.addEventListener('click', () => {
    btnBalance.className = 'flex-1 py-2 rounded-xl text-xs font-extrabold text-amber-400 bg-amber-500/10 transition-all';
    btnGoals.className = 'flex-1 py-2 rounded-xl text-xs font-extrabold text-slate-400 hover:text-white transition-all';
    if (panelBalance) panelBalance.classList.remove('hidden');
    if (panelGoals) panelGoals.classList.add('hidden');
  });

  btnGoals.addEventListener('click', () => {
    btnGoals.className = 'flex-1 py-2 rounded-xl text-xs font-extrabold text-cyan-400 bg-cyan-500/10 transition-all';
    btnBalance.className = 'flex-1 py-2 rounded-xl text-xs font-extrabold text-slate-400 hover:text-white transition-all';
    if (panelGoals) panelGoals.classList.remove('hidden');
    if (panelBalance) panelBalance.classList.add('hidden');
  });
}

// ==============================================================================
// PRIVACY & DISCREET ATHLETE PIN ACCESS (Hidden Triple-Tap on Brand Logo/Title)
// ==============================================================================
function getAthleteKey() {
  return localStorage.getItem('BIOCOACH_ATHLETE_KEY') || '';
}

function updateSecretDotUI() {
  const dot = document.getElementById('secret-athlete-dot');
  const athleteKey = getAthleteKey();
  const pinStatusText = document.getElementById('pin-status-text');
  const btnExitVault = document.getElementById('btn-exit-vault');
  const btnSubmitPin = document.getElementById('btn-submit-pin');
  const shortcutsPinBadge = document.getElementById('shortcuts-pin-badge');

  if (dot) {
    if (athleteKey) {
      dot.classList.remove('hidden');
    } else {
      dot.classList.add('hidden');
    }
  }

  const aiPinBadge = document.getElementById('ai-active-pin-badge');
  if (aiPinBadge) {
    aiPinBadge.textContent = athleteKey || 'atleta_privado';
  }

  if (shortcutsPinBadge) {
    shortcutsPinBadge.textContent = athleteKey || 'atleta_privado';
  }

  // Update prompt templates with active pin
  const effectivePin = athleteKey || 'atleta_privado';
  ['prompt-text-baseline', 'prompt-text-recovery', 'prompt-text-workout', 'prompt-text-hr', 'prompt-text-meal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (!el.dataset.template) el.dataset.template = el.textContent;
      el.textContent = el.dataset.template.replace(/\{PIN\}/g, effectivePin);
    }
  });

  if (pinStatusText) {
    if (athleteKey) {
      pinStatusText.innerHTML = `🟢 Bóveda Activa (<span class="font-mono text-cyan-300">${athleteKey}</span>)`;
    } else {
      pinStatusText.innerHTML = '✨ Modo Demo Público';
    }
  }

  if (btnExitVault) {
    if (athleteKey) {
      btnExitVault.classList.remove('hidden');
    } else {
      btnExitVault.classList.add('hidden');
    }
  }

  if (btnSubmitPin) {
    btnSubmitPin.textContent = athleteKey ? '💾 Actualizar PIN de Atleta' : '💾 Guardar PIN y Desbloquear';
  }

  // Update header vault status pill
  const vaultStatusDot = document.getElementById('vault-status-dot');
  const vaultStatusLabel = document.getElementById('vault-status-label');
  if (vaultStatusLabel) {
    if (athleteKey) {
      vaultStatusLabel.textContent = athleteKey;
      vaultStatusLabel.className = 'text-emerald-400 font-bold max-w-[85px] sm:max-w-none truncate';
      if (vaultStatusDot) {
        vaultStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0';
      }
    } else {
      vaultStatusLabel.textContent = 'Modo Demo';
      vaultStatusLabel.className = 'text-amber-400 font-bold max-w-[85px] sm:max-w-none truncate';
      if (vaultStatusDot) {
        vaultStatusDot.className = 'w-2 h-2 rounded-full bg-amber-400 shrink-0';
      }
    }
  }
}

// Global Non-intrusive Toast Notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast-notification');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  if (!toast || !toastMsg) return;

  const icons = {
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌'
  };

  const borders = {
    success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200',
    info: 'border-cyan-500/40 bg-slate-900/95 text-cyan-200',
    warning: 'border-amber-500/40 bg-amber-950/90 text-amber-200',
    error: 'border-rose-500/40 bg-rose-950/90 text-rose-200'
  };

  if (toastIcon) toastIcon.textContent = icons[type] || 'ℹ️';
  toastMsg.textContent = message;
  toast.className = `fixed top-16 left-1/2 -translate-x-1/2 z-50 glass-card px-4 py-2.5 rounded-2xl border ${borders[type] || borders.info} text-xs font-bold shadow-2xl flex items-center gap-2 transition-all duration-300 opacity-100 translate-y-0 max-w-[90vw]`;

  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-50 glass-card px-4 py-2.5 rounded-2xl border border-cyan-500/30 text-xs font-bold shadow-2xl flex items-center gap-2 transition-all duration-300 opacity-0 pointer-events-none translate-y-[-10px] max-w-[90vw] text-center';
  }, 3500);
}

function initDiscreetVaultAccess() {
  const logoTrigger = document.getElementById('brand-logo-trigger');
  const titleTrigger = document.getElementById('brand-title-trigger');
  const secretDot = document.getElementById('secret-athlete-dot');
  const modal = document.getElementById('secret-pin-modal');
  const btnClose = document.getElementById('btn-close-pin-modal');
  const btnCancel = document.getElementById('btn-cancel-pin');
  const btnExitVault = document.getElementById('btn-exit-vault');
  const btnToggleVisibility = document.getElementById('btn-toggle-pin-visibility');
  const btnVaultStatus = document.getElementById('btn-vault-status');
  const btnDefaultPin = document.getElementById('btn-use-default-pin');
  const form = document.getElementById('pin-form');
  const inputPin = document.getElementById('input-secret-pin');

  updateSecretDotUI();

  // Header status pill click opens PIN modal
  if (btnVaultStatus) {
    btnVaultStatus.addEventListener('click', openPinModal);
  }

  // 1-Click Default PIN helper
  if (btnDefaultPin) {
    btnDefaultPin.addEventListener('click', () => {
      localStorage.setItem('BIOCOACH_ATHLETE_KEY', 'atleta_privado');
      closePinModal();
      updateSecretDotUI();
      initDashboard();
      alert('🔓 Bóveda privada conectada con PIN "atleta_privado".\n\nConsultando telemetría de Supabase...');
    });
  }

  // Triple-tap / click detection
  let tapCount = 0;
  let tapTimer = null;

  function registerTap() {
    tapCount++;
    if (tapTimer) clearTimeout(tapTimer);

    if (tapCount >= 3) {
      tapCount = 0;
      openPinModal();
    } else {
      tapTimer = setTimeout(() => { tapCount = 0; }, 800);
    }
  }

  function openPinModal() {
    if (!modal) return;
    updateSecretDotUI();
    const currentKey = getAthleteKey();
    if (inputPin) {
      inputPin.value = currentKey || '';
      inputPin.type = 'password';
      inputPin.focus();
    }
    modal.classList.remove('hidden');
  }

  function closePinModal() {
    if (modal) modal.classList.add('hidden');
    if (inputPin) inputPin.value = '';
  }

  if (logoTrigger) logoTrigger.addEventListener('click', registerTap);
  if (titleTrigger) titleTrigger.addEventListener('click', registerTap);

  // Toggle password visibility in modal
  if (btnToggleVisibility && inputPin) {
    btnToggleVisibility.addEventListener('click', () => {
      if (inputPin.type === 'password') {
        inputPin.type = 'text';
        btnToggleVisibility.textContent = '🙈';
      } else {
        inputPin.type = 'password';
        btnToggleVisibility.textContent = '👁️';
      }
    });
  }

  // Button to exit vault and return to portfolio demo mode
  if (btnExitVault) {
    btnExitVault.addEventListener('click', () => {
      localStorage.removeItem('BIOCOACH_ATHLETE_KEY');
      closePinModal();
      updateSecretDotUI();
      initDashboard();
      alert('Sesión privada cerrada. Has vuelto al modo demostración público.');
    });
  }

  // Clicking the subtle green dot allows locking/exiting session back to public demo
  if (secretDot) {
    secretDot.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('¿Deseas cerrar tu sesión privada y volver al Modo Demostración de portafolio?')) {
        localStorage.removeItem('BIOCOACH_ATHLETE_KEY');
        updateSecretDotUI();
        initDashboard();
      }
    });
  }

  if (btnClose) btnClose.addEventListener('click', closePinModal);
  if (btnCancel) btnCancel.addEventListener('click', closePinModal);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPin = inputPin.value.trim();
      if (!enteredPin) return;

      localStorage.setItem('BIOCOACH_ATHLETE_KEY', enteredPin);
      closePinModal();
      updateSecretDotUI();
      initDashboard();
    });
  }
}

// Generates rich, realistic 7-day demonstration dataset for public portfolio showcase
function getPortfolioDemoData() {
  const today = new Date();
  
  const demoDays = [
    { offset: 0, sleep: 7.8, deep: 1.6, rem: 1.9, rhr: 52, hrv: 64, score: 92, tl: "GREEN", verdict: "🟢 Recuperación 92%. Sistema nervioso autónomo en balance óptimo. Gran ventana para trabajo de alta intensidad o fuerza máxima." },
    { offset: 1, sleep: 5.2, deep: 0.8, rem: 1.0, rhr: 64, hrv: 24, score: 42, tl: "RED", verdict: "🔴 Recuperación 42%. Variabilidad cardíaca muy deprimida y sueño insuficiente. Prioriza descanso activo e hidratación." },
    { offset: 2, sleep: 6.8, deep: 1.2, rem: 1.4, rhr: 56, hrv: 52, score: 72, tl: "YELLOW", verdict: "🟡 Recuperación 72%. Nivel moderado. Asimila carga aeróbica ligera o movilidad sin fatiga acumulada." },
    { offset: 3, sleep: 8.4, deep: 2.0, rem: 2.1, rhr: 50, hrv: 68, score: 95, tl: "GREEN", verdict: "🟢 Recuperación 95%. Sueño profundo y REM excepcionales. Capacidad cardiovascular y neuromuscular al 100%." },
    { offset: 4, sleep: 7.5, deep: 1.4, rem: 1.7, rhr: 53, hrv: 60, score: 86, tl: "GREEN", verdict: "🟢 Recuperación 86%. Ritmo circadiano estable. Buen tono parasimpático matutino." },
    { offset: 5, sleep: 6.0, deep: 1.0, rem: 1.1, rhr: 58, hrv: 46, score: 64, tl: "YELLOW", verdict: "🟡 Recuperación 64%. Ligera taquicardia nocturna. Hidrata bien y modera cafeína." },
    { offset: 6, sleep: 7.2, deep: 1.3, rem: 1.5, rhr: 54, hrv: 58, score: 82, tl: "GREEN", verdict: "🟢 Recuperación 82%. Parámetros estables dentro de tu media basal de 7 días." }
  ];

  const history = demoDays.map((d) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - d.offset);
    return {
      recorded_date: dt.toISOString().slice(0, 10),
      sleep_hours: d.sleep,
      deep_sleep_hours: d.deep,
      rem_sleep_hours: d.rem,
      resting_hr: d.rhr,
      hrv_ms: d.hrv,
      recovery_score: d.score,
      gemini_verdict: d.verdict,
      is_demo: true
    };
  });

  const demoWorkouts = [
    { workout_type: "Gimnasio / Hipertrofia", duration_minutes: 60, active_calories: 420, avg_hr: 138, max_hr: 165, recovery_hr_1min: 28, strain: 14.5 },
    { workout_type: "Running Intervalos", duration_minutes: 42, active_calories: 510, avg_hr: 158, max_hr: 178, recovery_hr_1min: 24, strain: 16.2 },
    { workout_type: "Ciclismo / Fondo", duration_minutes: 75, active_calories: 580, avg_hr: 132, max_hr: 152, recovery_hr_1min: 30, strain: 13.0 },
    { workout_type: "Natación Continua", duration_minutes: 45, active_calories: 450, avg_hr: 142, max_hr: 160, recovery_hr_1min: 32, strain: 12.8 },
    { workout_type: "Senderismo Montaña", duration_minutes: 120, active_calories: 780, avg_hr: 124, max_hr: 148, recovery_hr_1min: 34, strain: 15.1 },
    { workout_type: "Caminata Recuperación", duration_minutes: 35, active_calories: 140, avg_hr: 98, max_hr: 112, recovery_hr_1min: 35, strain: 4.5 }
  ];

  return processBiometricHistory(history, demoWorkouts);
}

// 4. Main Dashboard Telemetry Loader
async function initDashboard() {
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  updateSecretDotUI();
  const athleteKey = getAthleteKey();

  // If no private athlete key is configured, serve rich 7-day demo showcase (Portfolio Mode)
  if (!athleteKey) {
    const demoData = getPortfolioDemoData();
    renderDashboard(demoData);
    return;
  }

  let data = null;

  // Private Mode: Query Supabase for the authenticated athlete's private telemetry
  try {
    data = await fetchDirectFromSupabase(athleteKey);
  } catch (supabaseErr) {
    try {
      const res = await fetch(`/api/v1/dashboard?athlete_id=${encodeURIComponent(athleteKey)}&is_demo=false`);
      if (res.ok) data = await res.json();
    } catch (localErr) {
      console.warn("Could not connect to Supabase or local API", supabaseErr);
    }
  }

  if (data) {
    renderDashboard(data);
  } else {
    const heroStatus = document.getElementById('hero-status-text');
    if (heroStatus) heroStatus.textContent = 'Bóveda privada vacía. Registra tu primer sueño.';
  }
}

// Direct Supabase PostgREST Data Aggregator
async function fetchDirectFromSupabase(athleteKey) {
  const headers = {
    'apikey': SUPABASE_CONFIG.publishableKey,
    'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
    'x-athlete-token': athleteKey || 'public_demo'
  };

  const recUrl = athleteKey
    ? `${SUPABASE_CONFIG.url}/rest/v1/daily_recovery?athlete_id=eq.${encodeURIComponent(athleteKey)}&order=recorded_date.desc&limit=30`
    : `${SUPABASE_CONFIG.url}/rest/v1/daily_recovery?is_demo=eq.true&order=recorded_date.desc&limit=30`;

  const wkUrl = athleteKey
    ? `${SUPABASE_CONFIG.url}/rest/v1/workouts?athlete_id=eq.${encodeURIComponent(athleteKey)}&order=created_at.desc&limit=6`
    : `${SUPABASE_CONFIG.url}/rest/v1/workouts?is_demo=eq.true&order=created_at.desc&limit=6`;

  const hrUrl = athleteKey
    ? `${SUPABASE_CONFIG.url}/rest/v1/hr_checkins?athlete_id=eq.${encodeURIComponent(athleteKey)}&order=created_at.desc&limit=5`
    : `${SUPABASE_CONFIG.url}/rest/v1/hr_checkins?is_demo=eq.true&order=created_at.desc&limit=5`;

  const nutrUrl = athleteKey
    ? `${SUPABASE_CONFIG.url}/rest/v1/nutrition_logs?athlete_id=eq.${encodeURIComponent(athleteKey)}&order=created_at.desc&limit=50`
    : `${SUPABASE_CONFIG.url}/rest/v1/nutrition_logs?is_demo=eq.true&order=created_at.desc&limit=50`;

  const [recRes, wkRes, hrRes, nutrRes] = await Promise.all([
    fetch(recUrl, { headers, cache: 'no-store' }),
    fetch(wkUrl, { headers, cache: 'no-store' }),
    fetch(hrUrl, { headers, cache: 'no-store' }).catch(() => ({ ok: false })),
    fetch(nutrUrl, { headers, cache: 'no-store' }).catch(() => ({ ok: false }))
  ]);

  if (!recRes.ok) throw new Error("Error querying Supabase daily_recovery");

  const history = await recRes.json();
  const workouts = wkRes.ok ? await wkRes.json() : [];
  const hrCheckins = hrRes.ok ? await hrRes.json() : [];
  const nutritionLogs = nutrRes.ok ? await nutrRes.json() : [];

  const result = processBiometricHistory(history, workouts);
  result.hr_checkins = hrCheckins;
  result.nutrition_logs = nutritionLogs;
  return result;
}

// Client-Side Physiological Modeler (Replicates Python physiology engine + 30-day Apple Vitals Typical Range)
function processBiometricHistory(history, workouts) {
  if (!history || history.length === 0) {
    return {
      status: "success",
      is_day_one: true,
      today: null,
      trends: { dates: [], hrv: [], rhr: [], sleep: [] },
      weekly_calendar: [],
      recent_workouts: []
    };
  }

  // Full chronological history (up to 30 days) for Diario / 7d / 15d switching
  const fullChrono = [...history].reverse();
  const last7Chrono = fullChrono.slice(-7);
  const latest = history[0];

  const calcStats = (arr, fallbackMean = null) => {
    if (!arr || arr.length === 0) return { mean: fallbackMean, std: 0 };
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (arr.length < 2) return { mean, std: 0 };
    const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
    return { mean, std: Math.sqrt(variance) };
  };

  // Normalize wrist temperature to Celsius if Shortcuts sent Fahrenheit (> 50°F)
  const toCelsius = (val) => {
    if (val == null || isNaN(Number(val))) return null;
    const n = Number(val);
    return n > 50 ? Number(((n - 32) * 5 / 9).toFixed(2)) : n;
  };

  // Calculate 30-day Typical Range (mean ± SD, like Apple Health Vitals)
  const validHrv = history.filter(r => r.hrv_ms != null && Number(r.hrv_ms) >= 5).map(r => Number(r.hrv_ms));
  const validRhr = history.filter(r => r.resting_hr != null && Number(r.resting_hr) >= 35).map(r => Number(r.resting_hr));
  const validSleep = history.filter(r => r.sleep_hours != null && Number(r.sleep_hours) >= 2.5).map(r => Number(r.sleep_hours));
  const validResp = history.filter(r => r.respiratory_rate != null && Number(r.respiratory_rate) > 0).map(r => Number(r.respiratory_rate));
  const validTemp = history.filter(r => r.wrist_temp_deviation != null).map(r => toCelsius(r.wrist_temp_deviation)).filter(v => v != null);

  const hrvStats = calcStats(validHrv, 55.0);
  const rhrStats = calcStats(validRhr, 60.0);
  const sleepStats = calcStats(validSleep, 7.0);
  const respStats = calcStats(validResp, null);
  const tempStats = calcStats(validTemp, null);

  const baseHrv = hrvStats.mean;
  const baseRhr = rhrStats.mean;
  const baseSleep = Math.max(6.0, Math.min(8.0, sleepStats.mean || 7.0));
  const baseResp = respStats.mean;
  const baseTemp = tempStats.mean;

  const dayNamesEs = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const fullCalendar = [];

  fullChrono.forEach((r) => {
    let dayName = "Día";
    if (r.recorded_date) {
      const dt = new Date(r.recorded_date + 'T12:00:00');
      const idx = (dt.getDay() + 6) % 7; // Monday = 0
      dayName = dayNamesEs[idx] || "Día";
    }

    const evalPillars = evaluateDailyPillars(
      Number(r.sleep_hours),
      Number(r.hrv_ms),
      Number(r.resting_hr),
      baseHrv,
      baseRhr,
      baseSleep,
      hrvStats.std,
      rhrStats.std,
      sleepStats.std
    );

    fullCalendar.push({
      date: r.recorded_date,
      day_name: dayName,
      sleep: r.sleep_hours != null ? Number(r.sleep_hours) : null,
      deep_sleep: r.deep_sleep_hours != null ? Number(r.deep_sleep_hours) : null,
      rem_sleep: r.rem_sleep_hours != null ? Number(r.rem_sleep_hours) : null,
      core_sleep: r.core_sleep_hours != null ? Number(r.core_sleep_hours) : null,
      awake_sleep: r.awake_sleep_hours != null ? Number(r.awake_sleep_hours) : null,
      hrv: r.hrv_ms != null ? Number(r.hrv_ms) : null,
      rhr: r.resting_hr != null ? Number(r.resting_hr) : null,
      avg_hr: r.avg_hr != null ? Number(r.avg_hr) : null,
      max_hr: r.max_hr != null ? Number(r.max_hr) : null,
      walking_hr_avg: r.walking_hr_avg != null ? Number(r.walking_hr_avg) : null,
      resp: r.respiratory_rate != null ? Number(r.respiratory_rate) : null,
      spo2_pct: r.spo2_pct != null ? (Number(r.spo2_pct) <= 1.5 ? Number((Number(r.spo2_pct) * 100).toFixed(1)) : Number(r.spo2_pct)) : null,
      breathing_disturbances: r.breathing_disturbances != null ? Number(r.breathing_disturbances) : null,
      temp_c: toCelsius(r.wrist_temp_deviation),
      basal_calories: r.basal_calories != null ? Number(r.basal_calories) : null,
      active_calories: r.active_calories != null ? Number(r.active_calories) : null,
      steps: r.steps != null ? Number(r.steps) : null,
      exercise_minutes: r.exercise_minutes != null ? Number(r.exercise_minutes) : null,
      distance_km: r.distance_km != null ? Number(r.distance_km) : null,
      daylight_minutes: r.daylight_minutes != null ? Number(r.daylight_minutes) : null,
      audio_exposure_db: r.audio_exposure_db != null ? Number(r.audio_exposure_db) : null,
      extra_metrics: r.extra_metrics || {},
      overall_score: evalPillars.score,
      traffic_light: evalPillars.trafficLight,
      pillars: evalPillars.pillars,
      worst_aspect: evalPillars.worstAspect
    });
  });

  const weeklyCalendar = fullCalendar.slice(-7);

  const todayPillars = evaluateDailyPillars(
    Number(latest.sleep_hours),
    Number(latest.hrv_ms),
    Number(latest.resting_hr),
    baseHrv,
    baseRhr,
    baseSleep,
    hrvStats.std,
    rhrStats.std,
    sleepStats.std
  );

  // Build automatic clinical verdict if shortcut uploaded raw biometrics without Gemini text
  let autoVerdict = latest.gemini_verdict;
  const latestTempC = toCelsius(latest.wrist_temp_deviation);
  if (!autoVerdict) {
    const respVal = latest.respiratory_rate != null ? Number(latest.respiratory_rate) : null;
    const tempThreshold = baseTemp != null ? baseTemp + Math.max(tempStats.std * 1.8, 0.5) : 37.2;
    const respThreshold = baseResp != null ? baseResp + Math.max(respStats.std * 1.8, 2.0) : 20.0;

    const highTemp = latestTempC != null && (
      (baseTemp != null && validTemp.length >= 2 && latestTempC >= tempThreshold) ||
      (latestTempC >= 37.2) ||
      (latestTempC >= 0.5 && latestTempC < 5.0)
    );
    const highResp = respVal != null && (
      (baseResp != null && validResp.length >= 2 && respVal >= respThreshold) ||
      (baseResp == null && respVal >= 20.0)
    );

    if (highTemp || (highResp && todayPillars.trafficLight !== 'GREEN')) {
      autoVerdict = `⚠️ Alerta inmune: signos tempranos de posible gripa o estrés inmunológico (${latestTempC != null ? `Temp: ${latestTempC}°C` : ''}${latestTempC != null && respVal != null ? ', ' : ''}${respVal != null ? `Resp: ${respVal} rpm` : ''}). Prioriza reposo, hidratación y evita cargas altas.`;
    } else if (todayPillars.trafficLight === 'GREEN') {
      autoVerdict = `🟢 Recuperación óptima (${todayPillars.score}%). Biomarcadores dentro de tu rango típico de ${history.length} días.`;
    } else if (todayPillars.trafficLight === 'YELLOW') {
      autoVerdict = `🟡 Recuperación moderada (${todayPillars.score}%). Controla el volumen y prioriza sueño hoy.`;
    } else {
      autoVerdict = `🔴 Fatiga detectada (${todayPillars.score}%). Sistema nervioso bajo estrés, prioriza descanso activo.`;
    }
  }

  const toPct = (val) => {
    if (val == null || isNaN(Number(val))) return null;
    const n = Number(val);
    return n > 0 && n <= 1.5 ? Number((n * 100).toFixed(1)) : Number(n.toFixed(1));
  };

  // Additional 30-day baselines for full clinical Apple Watch telemetry
  const validSpo2 = history.filter(r => r.spo2_pct != null && Number(r.spo2_pct) > 0).map(r => toPct(r.spo2_pct));
  const validBreathDist = history.filter(r => r.breathing_disturbances != null).map(r => Number(r.breathing_disturbances));
  const validSteps = history.filter(r => r.steps != null && Number(r.steps) > 0).map(r => Number(r.steps));
  const validActCal = history.filter(r => r.active_calories != null && Number(r.active_calories) > 0).map(r => Number(r.active_calories));
  const baseSpo2 = validSpo2.length > 0 ? (validSpo2.reduce((a, b) => a + b, 0) / validSpo2.length) : null;
  const baseBreathDist = validBreathDist.length > 0 ? (validBreathDist.reduce((a, b) => a + b, 0) / validBreathDist.length) : null;
  const baseSteps = validSteps.length > 0 ? Math.round(validSteps.reduce((a, b) => a + b, 0) / validSteps.length) : null;
  const baseActCal = validActCal.length > 0 ? Math.round(validActCal.reduce((a, b) => a + b, 0) / validActCal.length) : null;
  const latestVo2 = history.find(r => r.vo2_max != null)?.vo2_max ?? null;
  const latestWeight = history.find(r => r.body_mass_kg != null)?.body_mass_kg ?? null;
  const latestSteadiness = history.find(r => r.extra_metrics?.walking_steadiness_pct != null)?.extra_metrics?.walking_steadiness_pct ?? null;
  const latestSixMin = history.find(r => r.extra_metrics?.six_min_walk_m != null)?.extra_metrics?.six_min_walk_m ?? null;

  const recentClinicalEvents = history
    .filter(r => r.extra_metrics && (r.extra_metrics.hypertension_events || r.extra_metrics.sleep_apnea_events))
    .map(r => {
      const ev = [];
      if (r.extra_metrics.hypertension_events) ev.push(`Hipertensión (${r.recorded_date})`);
      if (r.extra_metrics.sleep_apnea_events) ev.push(`Apnea del sueño (${r.recorded_date})`);
      return ev.join(', ');
    });

  // Build deduplicated Important Clinical Alerts feed across last 30 days with exact dates
  const clinicalAlerts = [];
  history.forEach((r) => {
    const ex = r.extra_metrics || {};
    const dt = r.recorded_date;
    const tC = toCelsius(r.wrist_temp_deviation);
    const sp2 = toPct(r.spo2_pct);
    const bd = r.breathing_disturbances != null ? Number(r.breathing_disturbances) : null;

    if (ex.hypertension_events) {
      clinicalAlerts.push({
        id: `hypertension_${dt}`,
        category: 'hypertension',
        categoryLabel: '🫀 Hipertensión',
        date: dt,
        severity: 'CRITICAL',
        icon: '🫀',
        title: 'Posible Hipertensión detectada',
        badge: 'Crítico',
        detail: `Apple Watch registró ${ex.hypertension_events} alerta(s) de posible hipertensión este día. Revisa tu presión arterial y compártelo con tu médico.`
      });
    }
    if (ex.sleep_apnea_events) {
      clinicalAlerts.push({
        id: `apnea_${dt}`,
        category: 'apnea',
        categoryLabel: '🫁 Apnea & Respiración',
        date: dt,
        severity: 'CRITICAL',
        icon: '🫁',
        title: 'Posible Apnea del Sueño detectada',
        badge: 'Crítico',
        detail: `Apple Watch emitió alerta de posible apnea del sueño${bd != null ? ` (${bd.toFixed(1)} alteraciones/h)` : ''}. Vigila calidad de descanso y oxigenación nocturna.`
      });
    }
    if (tC != null && baseTemp != null && tC >= baseTemp + 0.65) {
      clinicalAlerts.push({
        id: `temp_${dt}`,
        category: 'temperature',
        categoryLabel: '🌡️ Temperatura',
        date: dt,
        severity: 'HIGH',
        icon: '🌡️',
        title: `Pico de Temperatura Nocturna (${tC.toFixed(2)} °C)`,
        badge: `+${(tC - baseTemp).toFixed(2)} °C`,
        detail: `Temperatura de muñeca por encima de tu media de 30 días (${baseTemp.toFixed(2)} °C). Señal típica de proceso viral, inflamación o estrés inmune.`
      });
    }
    if (bd != null && bd >= 18.0 && !ex.sleep_apnea_events) {
      clinicalAlerts.push({
        id: `breath_${dt}`,
        category: 'apnea',
        categoryLabel: '🫁 Apnea & Respiración',
        date: dt,
        severity: 'HIGH',
        icon: '😮‍💨',
        title: `Alteraciones Respiratorias Elevadas (${bd.toFixed(1)}/h)`,
        badge: 'Atención',
        detail: `Nivel elevado de interrupciones respiratorias durante el sueño (umbral de vigilancia ≥ 18/h).`
      });
    }
    if (sp2 != null && sp2 < 93.0) {
      clinicalAlerts.push({
        id: `spo2_${dt}`,
        category: 'spo2',
        categoryLabel: '🩸 Oxígeno (SpO2)',
        date: dt,
        severity: 'MODERATE',
        icon: '🩸',
        title: `Saturación de Oxígeno (SpO2) Baja (${sp2.toFixed(1)}%)`,
        badge: 'SpO2 < 93%',
        detail: `Promedio diario de oxigenación por debajo de 93% (media 30d: ${baseSpo2 ? baseSpo2.toFixed(1) : '--'}%).`
      });
    }
    if (ex.audio_exposure_events && ex.audio_exposure_events >= 2) {
      clinicalAlerts.push({
        id: `audio_${dt}`,
        category: 'audio',
        categoryLabel: '🔊 Ruido Ambiental',
        date: dt,
        severity: 'MODERATE',
        icon: '🔊',
        title: `Exposición a Ruido Fuerte (${ex.audio_exposure_events} eventos)`,
        badge: 'Audición',
        detail: `Apple Watch detectó ${ex.audio_exposure_events} picos de ruido ambiental elevado${r.audio_exposure_db ? ` (prom. ${Number(r.audio_exposure_db).toFixed(1)} dB)` : ''}.`
      });
    }
  });

  // Sort CRITICAL first, then newest date first
  const sevRank = { CRITICAL: 0, HIGH: 1, MODERATE: 2 };
  clinicalAlerts.sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]) || b.date.localeCompare(a.date));

  const mergedExtra = {
    ...(latest.extra_metrics || {}),
    walking_steadiness_pct: latest.extra_metrics?.walking_steadiness_pct ?? latestSteadiness,
    six_min_walk_m: latest.extra_metrics?.six_min_walk_m ?? latestSixMin
  };

  return {
    status: "success",
    is_day_one: false,
    clinical_alerts: clinicalAlerts,
    today: {
      date: latest.recorded_date,
      score: todayPillars.score,
      traffic_light: todayPillars.trafficLight,
      hrv: latest.hrv_ms,
      rhr: latest.resting_hr,
      avg_hr: latest.avg_hr,
      min_hr: latest.min_hr,
      max_hr: latest.max_hr,
      walking_hr_avg: latest.walking_hr_avg,
      sleep: latest.sleep_hours,
      deep_sleep: latest.deep_sleep_hours,
      rem_sleep: latest.rem_sleep_hours,
      core_sleep: latest.core_sleep_hours,
      awake_sleep: latest.awake_sleep_hours,
      respiratory_rate: latest.respiratory_rate,
      spo2_pct: toPct(latest.spo2_pct),
      breathing_disturbances: latest.breathing_disturbances,
      wrist_temp_deviation: latestTempC,
      daylight_minutes: latest.daylight_minutes,
      steps: latest.steps,
      active_calories: latest.active_calories,
      basal_calories: latest.basal_calories,
      exercise_minutes: latest.exercise_minutes,
      stand_hours: latest.stand_hours,
      distance_km: latest.distance_km,
      flights_climbed: latest.flights_climbed,
      audio_exposure_db: latest.audio_exposure_db,
      vo2_max: latest.vo2_max ?? latestVo2,
      body_mass_kg: latest.body_mass_kg ?? latestWeight,
      extra_metrics: mergedExtra,
      base_hrv: baseHrv,
      base_rhr: baseRhr,
      base_sleep: baseSleep,
      base_resp: baseResp,
      base_temp: baseTemp,
      base_spo2: baseSpo2,
      base_breath_dist: baseBreathDist,
      base_steps: baseSteps,
      base_active_cal: baseActCal,
      recent_clinical_events: recentClinicalEvents,
      history_days: history.length,
      has_saved_gemini_verdict: Boolean(latest.gemini_verdict),
      verdict: autoVerdict,
      pillars: todayPillars.pillars,
      worst_aspect: todayPillars.worstAspect
    },
    trends: {
      dates: last7Chrono.map(r => r.recorded_date),
      hrv: last7Chrono.map(r => Number(r.hrv_ms || 0)),
      rhr: last7Chrono.map(r => Number(r.resting_hr || 0)),
      sleep: last7Chrono.map(r => Number(r.sleep_hours || 0)),
      baseHrv: baseHrv
    },
    full_trends: {
      dates: fullChrono.map(r => r.recorded_date),
      hrv: fullChrono.map(r => Number(r.hrv_ms || 0)),
      rhr: fullChrono.map(r => Number(r.resting_hr || 0)),
      sleep: fullChrono.map(r => Number(r.sleep_hours || 0)),
      baseHrv: baseHrv
    },
    weekly_calendar: weeklyCalendar,
    full_calendar: fullCalendar,
    recent_workouts: workouts.map(w => ({
      type: w.workout_type || "entrenamiento",
      duration: w.duration_minutes || 0,
      calories: w.active_calories || 0,
      strain: w.strain || (w.active_calories ? (w.active_calories / 40.0) : 10.0),
      date: (w.created_at || "").slice(0, 10)
    }))
  };
}

// Evaluates the 3 Pillars (HRV, RHR, Sleep) using real 30-day Typical Range (Apple Health Vitals style)
function evaluateDailyPillars(sleep, hrv, rhr, baseHrv, baseRhr, baseSleep, stdHrv = 0, stdRhr = 0, stdSleep = 0) {
  // 1. HRV vs Typical Range (mean - 1.1 SD is lower Typical boundary)
  let hrvRatio = (hrv && baseHrv > 0) ? (hrv / baseHrv) : 1.0;
  let hrvGreenFloor = Math.max(20, baseHrv - Math.max(stdHrv * 1.1, 6.0));
  let hrvYellowFloor = Math.max(15, baseHrv - Math.max(stdHrv * 1.65, 12.0));
  let hrvStatus = (!hrv || hrv >= hrvGreenFloor) ? "GREEN" : (hrv >= hrvYellowFloor ? "YELLOW" : "RED");
  let hrvScore = Math.max(15, Math.min(100, Math.round(hrvRatio * 86)));
  let hrvSev = hrvStatus === "GREEN" ? "NONE" : (hrvStatus === "YELLOW" ? "MODERATE" : "HIGH");

  // 2. Resting HR vs Typical Range (mean + 1.25 SD is upper Typical boundary)
  let rhrDiff = (rhr && baseRhr > 0) ? (rhr - baseRhr) : 0;
  let rhrGreenBand = Math.max(5.0, stdRhr * 1.25);
  let rhrYellowBand = Math.max(9.5, stdRhr * 2.1);
  let rhrStatus = rhrDiff <= rhrGreenBand ? "GREEN" : (rhrDiff <= rhrYellowBand ? "YELLOW" : "RED");
  let rhrScore = Math.max(15, Math.min(100, Math.round(88 - (Math.max(0, rhrDiff) * 2.5))));
  let rhrSev = rhrStatus === "GREEN" ? "NONE" : (rhrStatus === "YELLOW" ? "MODERATE" : "HIGH");

  // 3. Sleep vs Personal Typical Baseline + healthy floor (6h+ typical = GREEN, 5-6h = YELLOW, <5h = RED)
  let sleepRef = baseSleep || 7.0;
  let sleepGreenFloor = Math.min(6.0, Math.max(5.75, sleepRef - Math.max(stdSleep * 0.6, 0.5)));
  let sleepStatus = (!sleep || sleep >= sleepGreenFloor) ? "GREEN" : (sleep >= 5.0 ? "YELLOW" : "RED");
  let sleepRatio = (sleep && sleepRef > 0) ? (sleep / sleepRef) : 0.9;
  let sleepScore = Math.max(10, Math.min(100, Math.round(sleepRatio * 88)));
  let sleepSev = sleepStatus === "GREEN" ? "NONE" : (sleepStatus === "YELLOW" ? "MODERATE" : (sleep < 4.0 ? "CRITICAL" : "HIGH"));

  const score = Math.round((hrvScore * 0.45) + (rhrScore * 0.25) + (sleepScore * 0.30));
  const trafficLight = score >= 75 ? "GREEN" : (score >= 50 ? "YELLOW" : "RED");

  const pillars = {
    hrv: {
      pillar: "HRV",
      label: "Variabilidad Cardíaca",
      value: hrv ? `${Math.round(hrv)} ms` : "--",
      delta: `${((hrvRatio - 1) * 100).toFixed(0)}%`,
      status: hrvStatus,
      severity: hrvSev,
      score: hrvScore
    },
    rhr: {
      pillar: "RHR",
      label: "FC en Reposo",
      value: rhr ? `${Math.round(rhr)} bpm` : "--",
      delta: `${rhrDiff > 0 ? '+' : ''}${rhrDiff.toFixed(0)} bpm`,
      status: rhrStatus,
      severity: rhrSev,
      score: rhrScore
    },
    sleep: {
      pillar: "SLEEP",
      label: "Sueño",
      value: sleep ? `${sleep.toFixed(1)} h` : "--",
      delta: `${(sleep - sleepRef) >= 0 ? '+' : ''}${(sleep - sleepRef).toFixed(1)} h`,
      status: sleepStatus,
      severity: sleepSev,
      score: sleepScore
    }
  };

  // Identify lowest scoring pillar
  const list = Object.values(pillars).sort((a, b) => a.score - b.score);
  const worst = list[0];

  let worstAspect = { pillar: "NONE", severity: "NONE", detail: "Todos los pilares en zona óptima." };
  if (worst.score < 70 && worst.status !== "GREEN") {
    let detail = "";
    if (worst.pillar === "HRV") {
      detail = `Tu variabilidad cardíaca cayó a ${worst.value} (${worst.delta} vs media). Refleja fatiga del sistema nervioso simpático.`;
    } else if (worst.pillar === "RHR") {
      detail = `Tu pulso en reposo subió a ${worst.value} (${worst.delta} sobre tu base). Posible deshidratación o fatiga.`;
    } else {
      detail = `Déficit de sueño (${worst.value} registradas). Regeneración física y hormonal insuficiente.`;
    }
    worstAspect = {
      pillar: worst.pillar,
      severity: worst.severity,
      detail: detail
    };
  }

  return { score, trafficLight, pillars, worstAspect };
}

// 5. Render Dashboard Telemetry
function renderDashboard(data) {
  window.currentDashboardData = data;
  const today = data.today;
  const banner = document.getElementById('empty-state-banner');

  if (!today) {
    document.getElementById('hero-score').textContent = '--';
    document.getElementById('hero-status-text').textContent = 'Esperando primer registro del Apple Watch';
    if (banner) banner.classList.remove('hidden');
    renderWeeklyCalendar(data.weekly_calendar || []);
    return;
  }

  if (banner) banner.classList.add('hidden');

  const score = today.score || 50;
  document.getElementById('hero-score').textContent = score;
  const statusText = document.getElementById('hero-status-text');
  const iconEl = document.getElementById('score-icon');
  const gradientCursor = document.getElementById('gradient-cursor');
  const balanceStatus = document.getElementById('daily-balance-status');

  // Continuous Gradient Cursor Positioning (Clamped between 4% and 96%)
  if (gradientCursor) {
    const clampedPos = Math.min(96, Math.max(4, score));
    gradientCursor.style.left = `${clampedPos}%`;
  }

  if (today.traffic_light === 'GREEN') {
    statusText.textContent = 'Sistema Óptimo (Recuperado)';
    statusText.className = 'text-sm font-semibold mt-1 text-emerald-400';
    iconEl.textContent = '🟢';
    if (balanceStatus) {
      balanceStatus.textContent = `🟢 Óptimo (${score}%)`;
      balanceStatus.className = 'text-xs font-bold text-emerald-400';
    }
  } else if (today.traffic_light === 'YELLOW') {
    statusText.textContent = 'Recuperación Moderada';
    statusText.className = 'text-sm font-semibold mt-1 text-amber-400';
    iconEl.textContent = '🟡';
    if (balanceStatus) {
      balanceStatus.textContent = `🟡 Carga Moderada (${score}%)`;
      balanceStatus.className = 'text-xs font-bold text-amber-400';
    }
  } else {
    statusText.textContent = 'Fatiga Elevada / Sobrecarga';
    statusText.className = 'text-sm font-semibold mt-1 text-rose-400';
    iconEl.textContent = '🔴';
    if (balanceStatus) {
      balanceStatus.textContent = `🔴 Sobrecarga (${score}%)`;
      balanceStatus.className = 'text-xs font-bold text-rose-400';
    }
  }

  if (today.verdict) {
    document.getElementById('gemini-daily-verdict').textContent = `"${today.verdict}"`;
  }

  // Trigger real Gemini AI daily clinical briefing if today's row has no saved Gemini verdict yet
  if (!today.has_saved_gemini_verdict && today.date && window.__lastGeminiBriefingDate !== today.date) {
    window.__lastGeminiBriefingDate = today.date;
    fetchAndSaveDailyGeminiVerdict(today);
  }

  // Update 3 Pillar Summary Cards
  const cardHrv = document.getElementById('card-hrv');
  const cardHrvSub = document.getElementById('card-hrv-sub');
  if (cardHrv) cardHrv.innerHTML = `${today.hrv ? Math.round(today.hrv) : '--'} <span class="text-xs font-normal text-slate-400">ms</span>`;
  if (cardHrvSub && today.pillars?.hrv) {
    cardHrvSub.textContent = `${today.pillars.hrv.delta} vs base`;
    cardHrvSub.className = `text-[10px] font-semibold ${today.pillars.hrv.status === 'GREEN' ? 'text-emerald-400' : (today.pillars.hrv.status === 'YELLOW' ? 'text-amber-400' : 'text-rose-400')}`;
  }

  const cardRhr = document.getElementById('card-rhr');
  const cardRhrSub = document.getElementById('card-rhr-sub');
  if (cardRhr) cardRhr.innerHTML = `${today.rhr ? Math.round(today.rhr) : '--'} <span class="text-xs font-normal text-slate-400">lpm</span>`;
  if (cardRhrSub && today.pillars?.rhr) {
    cardRhrSub.textContent = `${today.pillars.rhr.delta} vs base`;
    cardRhrSub.className = `text-[10px] font-semibold ${today.pillars.rhr.status === 'GREEN' ? 'text-emerald-400' : (today.pillars.rhr.status === 'YELLOW' ? 'text-amber-400' : 'text-rose-400')}`;
  }

  const cardSleep = document.getElementById('card-sleep');
  const cardSleepSub = document.getElementById('card-sleep-sub');
  if (cardSleep) cardSleep.innerHTML = `${today.sleep ? Number(today.sleep).toFixed(1) : '--'} <span class="text-[11px] font-normal text-slate-400">h</span>`;
  if (cardSleepSub && today.pillars?.sleep) {
    const baseSl = today.base_sleep ? today.base_sleep.toFixed(1) : '7.0';
    cardSleepSub.textContent = `Base ${baseSl}h (${today.pillars.sleep.delta})`;
    cardSleepSub.className = `text-[9px] sm:text-[10px] font-semibold block truncate ${today.pillars.sleep.status === 'GREEN' ? 'text-emerald-400' : (today.pillars.sleep.status === 'YELLOW' ? 'text-amber-400' : 'text-rose-400')}`;
  }

  renderVitalsAndSleepStages(today);
  renderExerciseAndMobility(today);
  renderClinicalAlerts(data.clinical_alerts || []);
  renderWorstAspect(today.worst_aspect);
  applyActiveRangeViews(data);
  renderWorkouts(data.recent_workouts);
  syncNutritionWithDashboard(data);
}

// Applies the active timeframe (Diario=1, 7 Días=7, 15 Días=15) to History & HRV Trend charts
function applyActiveRangeViews(data) {
  const range = window.activeHistoryRange || 7;
  const fullCal = data.full_calendar || data.weekly_calendar || [];
  const fullTr = data.full_trends || data.trends || { dates: [], hrv: [], rhr: [], sleep: [], baseHrv: 50 };

  const slicedCal = fullCal.slice(-range);
  const slicedTrends = {
    dates: (fullTr.dates || []).slice(-range),
    hrv: (fullTr.hrv || []).slice(-range),
    rhr: (fullTr.rhr || []).slice(-range),
    sleep: (fullTr.sleep || []).slice(-range),
    baseHrv: fullTr.baseHrv
  };

  const subEl = document.getElementById('hrv-range-subtitle');
  if (subEl) {
    subEl.textContent = range === 1
      ? 'Lectura de hoy vs tu media de 30 días'
      : `Últimos ${slicedCal.length} días vs tu media de 30 días`;
  }

  renderWeeklyCalendar(slicedCal, range);
  renderChartBars(slicedTrends, range);
}

// 5b. Render Sleep Architecture Stages & Apple Vitals Card
function renderVitalsAndSleepStages(t) {
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('stage-deep', t.deep_sleep != null ? `${Number(t.deep_sleep).toFixed(2)}h` : '--');
  setText('stage-rem', t.rem_sleep != null ? `${Number(t.rem_sleep).toFixed(2)}h` : '--');
  setText('stage-core', t.core_sleep != null ? `${Number(t.core_sleep).toFixed(2)}h` : '--');
  setText('stage-awake', t.awake_sleep != null ? `${Number(t.awake_sleep).toFixed(2)}h` : '--');

  setText('vitals-range-badge', `Base ${t.history_days || 7}d`);
  setText('vital-temp', t.wrist_temp_deviation != null ? `${Number(t.wrist_temp_deviation).toFixed(2)} °C` : '-- °C');
  setText('vital-temp-sub', t.base_temp != null ? `Media: ${t.base_temp.toFixed(2)} °C` : 'Sin base');
  setText('vital-resp', t.respiratory_rate != null ? `${Number(t.respiratory_rate).toFixed(1)} rpm` : '-- rpm');
  setText('vital-resp-sub', t.base_resp != null ? `Media: ${t.base_resp.toFixed(1)} rpm` : 'Sin base');
  setText('vital-spo2', t.spo2_pct != null ? `${Number(t.spo2_pct).toFixed(1)} %` : '-- %');
  setText('vital-spo2-sub', t.base_spo2 != null ? `Media: ${t.base_spo2.toFixed(1)} %` : 'Sin base');
  setText('vital-breath-dist', t.breathing_disturbances != null ? `${Number(t.breathing_disturbances).toFixed(1)} /h` : '-- /h');
  setText('vital-breath-dist-sub', t.base_breath_dist != null ? `Media: ${t.base_breath_dist.toFixed(1)} /h` : 'Sin base');

  setText('vital-avg-hr', t.avg_hr != null ? `${Math.round(t.avg_hr)} lpm` : '--');
  setText('vital-daylight', t.daylight_minutes != null ? `${t.daylight_minutes} min` : '--');
  setText('vital-audio', t.audio_exposure_db != null ? `${Math.round(t.audio_exposure_db)} dB` : '--');
  setText('vital-weight', t.body_mass_kg != null ? `${Number(t.body_mass_kg).toFixed(1)} kg` : '--');
}

// 5c. Render Exercise, Walking, Physical Effort & Gait Biomechanics Tab
function renderExerciseAndMobility(t) {
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const ex = t.extra_metrics || {};

  setText('ex-date-badge', t.date || 'Hoy');
  setText('ex-steps', t.steps != null ? Number(t.steps).toLocaleString('es-CO') : '--');
  setText('ex-steps-sub', t.base_steps != null ? `Media 30d: ${Number(t.base_steps).toLocaleString('es-CO')}` : 'Media: --');
  setText('ex-active-cal', t.active_calories != null ? `${t.active_calories} kcal` : '-- kcal');
  setText('ex-basal-cal', t.basal_calories != null ? `Basal: ${t.basal_calories} kcal` : 'Basal: --');
  setText('ex-minutes', t.exercise_minutes != null ? `${t.exercise_minutes} min` : '-- min');
  setText('ex-stand-hours', t.stand_hours != null ? `De pie: ${t.stand_hours} h` : 'De pie: --');
  setText('ex-distance', t.distance_km != null ? `${Number(t.distance_km).toFixed(2)} km` : '-- km');
  setText('ex-cycling', ex.cycling_km != null ? `Bici: ${Number(ex.cycling_km).toFixed(2)} km` : 'Bici: 0 km');
  setText('ex-effort', ex.physical_effort != null ? `${Number(ex.physical_effort).toFixed(1)} MET` : '--');
  setText('ex-flights', t.flights_climbed != null ? `Pisos: ${t.flights_climbed}` : 'Pisos: --');
  setText('ex-vo2', t.vo2_max != null ? `${Number(t.vo2_max).toFixed(1)}` : '--');

  setText('mob-walk-hr', t.walking_hr_avg != null ? `${Math.round(t.walking_hr_avg)} lpm` : '-- lpm');
  setText('mob-hr-range', (t.min_hr != null && t.max_hr != null) ? `Mín ${Math.round(t.min_hr)} / Máx ${Math.round(t.max_hr)}` : 'Mín/Máx: --');
  setText('mob-walk-speed', ex.walking_speed_kmh != null ? `${Number(ex.walking_speed_kmh).toFixed(2)} km/h` : '-- km/h');
  setText('mob-step-len', ex.walking_step_length_cm != null ? `Paso: ${Math.round(ex.walking_step_length_cm)} cm` : 'Paso: -- cm');
  setText('mob-asymmetry', ex.walking_asymmetry_pct != null ? `${Number(ex.walking_asymmetry_pct).toFixed(1)} %` : '-- %');
  setText('mob-double-supp', ex.walking_double_support_pct != null ? `Doble apoyo: ${Number(ex.walking_double_support_pct).toFixed(1)}%` : 'Doble apoyo: --');
  setText('mob-steadiness', ex.walking_steadiness_pct != null ? `${Number(ex.walking_steadiness_pct).toFixed(1)} %` : '-- %');
  const stairsTxt = (ex.stair_ascent_speed != null || ex.stair_descent_speed != null)
    ? `↑${ex.stair_ascent_speed ?? '--'} / ↓${ex.stair_descent_speed ?? '--'}`
    : '-- m/s';
  setText('mob-stairs', stairsTxt);
  setText('mob-sixmin', ex.six_min_walk_m != null ? `${Math.round(ex.six_min_walk_m)} m` : '-- m');
}

// 5d. Render Important Clinical Alerts grouped by type with notification read/unread state
function renderClinicalAlerts(alerts, activeCategory = null) {
  const listEl = document.getElementById('clinical-alerts-list');
  const filterEl = document.getElementById('alerts-category-filters');
  const badgeEl = document.getElementById('alerts-tab-badge');
  const pillEl = document.getElementById('alerts-total-pill');
  const stripEl = document.getElementById('clinical-alerts-strip');
  const stripText = document.getElementById('clinical-alerts-strip-text');

  if (activeCategory !== null) window.activeAlertCategory = activeCategory;
  const selectedCat = window.activeAlertCategory || 'all';

  const readSet = getReadAlertIds();
  const unreadAlerts = alerts.filter(a => !readSet.has(a.id));
  const unreadCount = unreadAlerts.length;
  const totalCount = alerts.length;

  // Notification badge shows ONLY unread count (clears once read!)
  if (badgeEl) {
    badgeEl.textContent = String(unreadCount);
    badgeEl.classList.toggle('hidden', unreadCount === 0);
  }
  if (pillEl) {
    pillEl.textContent = unreadCount > 0
      ? `${unreadCount} nueva${unreadCount === 1 ? '' : 's'} / ${totalCount} total`
      : `${totalCount} leída${totalCount === 1 ? '' : 's'}`;
  }

  // Top compact banner on Vitals tab shows ONLY unread alerts
  if (stripEl && stripText) {
    if (unreadCount > 0) {
      const panelVitals = document.getElementById('dash-panel-vitals');
      if (panelVitals && !panelVitals.classList.contains('hidden')) {
        stripEl.classList.remove('hidden');
      }
      const crit = unreadAlerts.filter(a => a.severity === 'CRITICAL');
      if (crit.length > 0) {
        stripText.textContent = `${crit.map(c => `${c.title} (${c.date})`).slice(0, 2).join(' • ')}`;
      } else {
        stripText.textContent = `${unreadCount} notificación(es) clínica(s) nueva(s) (${unreadAlerts[0].date})`;
      }
    } else {
      stripEl.classList.add('hidden');
    }
  }

  // Build Category Filter Pills dynamically from existing alert types
  if (filterEl) {
    const catMap = new Map();
    alerts.forEach(a => {
      const k = a.category || 'other';
      if (!catMap.has(k)) catMap.set(k, { label: a.categoryLabel || 'Otras', count: 0 });
      catMap.get(k).count += 1;
    });

    const pills = [{ key: 'all', label: `Todas (${totalCount})` }];
    catMap.forEach((v, k) => pills.push({ key: k, label: `${v.label} (${v.count})` }));

    filterEl.innerHTML = pills.map(p => {
      const isAct = selectedCat === p.key;
      const cls = isAct
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        : 'bg-slate-900/70 text-slate-400 border-white/10 hover:text-white';
      return `<button type="button" data-alert-cat="${p.key}" class="alert-cat-btn shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${cls}">${p.label}</button>`;
    }).join('');

    filterEl.querySelectorAll('.alert-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        renderClinicalAlerts(alerts, btn.getAttribute('data-alert-cat') || 'all');
      });
    });
  }

  if (!listEl) return;
  if (totalCount === 0) {
    listEl.innerHTML = `<div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-semibold">✅ Sin alertas clínicas críticas ni anomalías relevantes en los últimos 30 días.</div>`;
    return;
  }

  const filtered = selectedCat === 'all' ? alerts : alerts.filter(a => a.category === selectedCat);

  // Group filtered alerts cleanly by type (categoryLabel)
  const grouped = new Map();
  filtered.forEach(a => {
    const key = a.categoryLabel || 'Otras Alertas';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(a);
  });

  const renderCard = (a) => {
    const isUnread = !readSet.has(a.id);
    const style = a.severity === 'CRITICAL'
      ? 'border-rose-500/40 bg-rose-500/10'
      : (a.severity === 'HIGH' ? 'border-amber-500/35 bg-amber-500/10' : 'border-sky-500/25 bg-sky-500/5');
    const badgeStyle = a.severity === 'CRITICAL'
      ? 'bg-rose-500/25 text-rose-200'
      : (a.severity === 'HIGH' ? 'bg-amber-500/25 text-amber-200' : 'bg-sky-500/25 text-sky-200');
    return `
      <div class="p-3.5 rounded-2xl border ${style} flex items-start gap-3">
        <span class="text-xl shrink-0 mt-0.5">${a.icon}</span>
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center justify-between gap-1.5">
            <h3 class="text-xs font-extrabold text-white flex items-center gap-1.5">
              ${isUnread ? '<span class="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>' : ''}
              <span>${a.title}</span>
            </h3>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900/70 text-slate-200">📅 ${a.date}</span>
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${badgeStyle}">${a.badge}</span>
            </div>
          </div>
          <p class="text-[11px] text-slate-300 mt-1 leading-relaxed">${a.detail}</p>
        </div>
      </div>
    `;
  };

  let html = '';
  grouped.forEach((items, groupTitle) => {
    html += `
      <div class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <h4 class="text-[11px] font-black text-slate-300 uppercase tracking-wider">${groupTitle}</h4>
          <span class="text-[10px] text-slate-500 font-semibold">${items.length} registro${items.length === 1 ? '' : 's'}</span>
        </div>
        <div class="space-y-2">
          ${items.map(renderCard).join('')}
        </div>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

// 6. Highlight Worst Aspect of the Day
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
    badge.textContent = 'Crítico';
    badge.className = 'px-2 py-0.5 rounded-full text-[10px] bg-rose-500/30 text-rose-300 font-black';
    icon.textContent = '🚨';
  } else if (worst.severity === 'HIGH') {
    badge.textContent = 'Alto Impacto';
    badge.className = 'px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-extrabold';
    icon.textContent = '⚠️';
  } else {
    badge.textContent = 'Atención';
    badge.className = 'px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold';
    icon.textContent = '⚡';
  }
}

// 7. Responsive Pillars History (Diario | 7 Días | 15 Días) - Zero Mobile Overflow
function renderWeeklyCalendar(calendar, rangeDays = 7) {
  const grid = document.getElementById('weekly-calendar-grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!calendar || calendar.length === 0) {
    grid.innerHTML = '<p class="w-full text-center text-xs text-slate-500 py-4">Registra telemetría para poblar el historial.</p>';
    return;
  }

  const getStatusColor = (st) => st === 'GREEN' ? 'text-emerald-400' : (st === 'YELLOW' ? 'text-amber-400' : 'text-rose-400');
  const getStatusLabel = (st) => st === 'GREEN' ? 'Típico' : (st === 'YELLOW' ? 'Moderado' : 'Bajo');

  // Expanded Daily Detail View (range === 1)
  if (rangeDays === 1) {
    const d = calendar[calendar.length - 1];
    const p = d.pillars || {};
    let scoreBg = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (d.traffic_light === 'YELLOW') scoreBg = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    else if (d.traffic_light === 'RED') scoreBg = 'text-rose-400 bg-rose-500/10 border-rose-500/20';

    grid.innerHTML = `
      <div class="w-full glass-card rounded-2xl p-4 border border-cyan-500/25 bg-slate-900/50 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-xs font-extrabold text-white uppercase">${d.day_name} • ${d.date}</span>
            <p class="text-[11px] text-slate-400">Detalle diario vs rango típico de 30 días</p>
          </div>
          <span class="px-3 py-1 rounded-xl border text-sm font-black ${scoreBg}">${d.overall_score || '--'}/100</span>
        </div>
        <div class="grid grid-cols-3 gap-2.5 text-center">
          <div class="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
            <span class="text-[10px] font-black text-cyan-400 block">S • Sueño</span>
            <strong class="text-base font-black ${getStatusColor(p.sleep?.status)}">${d.sleep ? d.sleep.toFixed(1) : '--'} h</strong>
            <span class="block text-[9px] text-slate-400">${getStatusLabel(p.sleep?.status)}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
            <span class="text-[10px] font-black text-violet-400 block">V • VFC</span>
            <strong class="text-base font-black ${getStatusColor(p.hrv?.status)}">${d.hrv ? Math.round(d.hrv) : '--'} ms</strong>
            <span class="block text-[9px] text-slate-400">${getStatusLabel(p.hrv?.status)}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
            <span class="text-[10px] font-black text-amber-400 block">R • Reposo</span>
            <strong class="text-base font-black ${getStatusColor(p.rhr?.status)}">${d.rhr ? Math.round(d.rhr) : '--'} lpm</strong>
            <span class="block text-[9px] text-slate-400">${getStatusLabel(p.rhr?.status)}</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Horizontal snap-scroll cards (96px fixed width -> NEVER clips or overflows on iPhone 15 Pro Max!)
  calendar.forEach((d, idx) => {
    const col = document.createElement('div');
    const isToday = idx === calendar.length - 1;
    col.className = `w-[96px] shrink-0 snap-start glass-card rounded-2xl p-2.5 flex flex-col items-center gap-1.5 border ${isToday ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/5'} hover:border-cyan-500/40 transition-all overflow-hidden`;

    const dayLabel = d.day_name || 'Día';
    const dayNum = d.date ? d.date.slice(5) : '';

    let scoreBg = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (d.traffic_light === 'YELLOW') {
      scoreBg = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    } else if (d.traffic_light === 'RED') {
      scoreBg = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }

    const p = d.pillars || {};

    col.innerHTML = `
      <div class="flex items-center justify-between w-full px-0.5">
        <span class="text-[10px] font-bold text-slate-300 uppercase">${dayLabel}</span>
        <span class="text-[9px] text-slate-500 font-mono">${dayNum}</span>
      </div>
      <div class="px-2.5 py-0.5 rounded-lg border text-xs font-black ${scoreBg}">
        ${d.overall_score || '--'}
      </div>
      <div class="flex flex-col gap-1 w-full pt-1.5 border-t border-white/5 text-[10px]">
        <div class="flex items-center justify-between px-1.5 py-0.5 rounded bg-slate-900/60" title="Sueño: ${p.sleep?.value || '--'}">
          <span class="font-black text-cyan-400">S</span>
          <span class="font-bold whitespace-nowrap ${getStatusColor(p.sleep?.status)}">${d.sleep ? d.sleep.toFixed(1) : '--'}h</span>
        </div>
        <div class="flex items-center justify-between px-1.5 py-0.5 rounded bg-slate-900/60" title="VFC: ${p.hrv?.value || '--'}">
          <span class="font-black text-violet-400">V</span>
          <span class="font-bold whitespace-nowrap ${getStatusColor(p.hrv?.status)}">${d.hrv ? Math.round(d.hrv) : '--'}ms</span>
        </div>
        <div class="flex items-center justify-between px-1.5 py-0.5 rounded bg-slate-900/60" title="FC Reposo: ${p.rhr?.value || '--'}">
          <span class="font-black text-amber-400">R</span>
          <span class="font-bold whitespace-nowrap ${getStatusColor(p.rhr?.status)}">${d.rhr ? Math.round(d.rhr) : '--'}lpm</span>
        </div>
      </div>
    `;

    if (d.traffic_light === 'RED') {
      col.classList.add('border-rose-500/50', 'bg-rose-500/5');
    }

    grid.appendChild(col);
  });

  // Auto-scroll carousel smoothly to the newest day (right side) so Today is immediately visible
  requestAnimationFrame(() => {
    grid.scrollLeft = grid.scrollWidth;
  });
}

// 8. Sleek Slim HRV Trend Evolution Bars (Supports 1d, 7d, 15d cleanly on mobile)
function renderChartBars(trends, rangeDays = 7) {
  const container = document.getElementById('chart-bars');
  const avgLabel = document.getElementById('hrv-avg-label');
  if (!container) return;
  container.innerHTML = '';

  if (!trends || !trends.hrv || trends.hrv.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 m-auto">Sin suficientes datos para graficar.</p>';
    return;
  }

  const baseHrv = trends.baseHrv || (trends.hrv.reduce((a, b) => a + b, 0) / trends.hrv.length);
  if (avgLabel) avgLabel.textContent = `Base 30d: ${Math.round(baseHrv)} ms`;

  const maxVal = Math.max(...trends.hrv, 70);
  const isCompact = rangeDays >= 15;

  trends.hrv.forEach((val, idx) => {
    const heightPercent = Math.max(15, Math.min(100, (val / maxVal) * 100));
    const dayLabel = trends.dates[idx] ? trends.dates[idx].slice(8) : `D${idx+1}`;
    const isTypical = val >= (baseHrv * 0.80);

    const col = document.createElement('div');
    col.className = isCompact
      ? 'w-[28px] shrink-0 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer'
      : 'flex-1 min-w-[34px] flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer';
    col.innerHTML = `
      <span class="text-[9px] font-bold text-slate-400 group-hover:text-cyan-400 transition-colors">${Math.round(val)}</span>
      <div class="w-2.5 sm:w-3 bg-slate-800/80 rounded-full h-full flex items-end p-0.5 overflow-hidden">
        <div class="w-full rounded-full transition-all duration-700 ${isTypical ? 'bg-gradient-to-t from-cyan-600 to-cyan-400' : 'bg-gradient-to-t from-amber-600 to-amber-400'}" style="height: ${heightPercent}%"></div>
      </div>
      <span class="text-[9px] text-slate-500 font-semibold group-hover:text-white transition-colors">${dayLabel}</span>
    `;
    container.appendChild(col);
  });
}

// Dedicated Activity Icon Resolver
function getActivityIcon(workoutType) {
  const t = (workoutType || "").toLowerCase();
  if (t.includes("nataci") || t.includes("swim")) return "🏊‍♂️";
  if (t.includes("fuerza") || t.includes("gym") || t.includes("pesa") || t.includes("hipertrofia") || t.includes("strength")) return "🏋️‍♂️";
  if (t.includes("run") || t.includes("carrera") || t.includes("trote") || t.includes("correr")) return "🏃‍♂️";
  if (t.includes("bici") || t.includes("ciclismo") || t.includes("cycling") || t.includes("bike")) return "🚴‍♂️";
  if (t.includes("senderismo") || t.includes("hike") || t.includes("hiking") || t.includes("montaña")) return "🥾";
  if (t.includes("caminata") || t.includes("walk") || t.includes("paseo")) return "🚶‍♂️";
  if (t.includes("hiit") || t.includes("interval") || t.includes("crossfit")) return "⚡";
  if (t.includes("yoga") || t.includes("estiramiento")) return "🧘‍♂️";
  return "🏅";
}

// 9. Workouts List with Prominent Numbers & Dedicated Activity Icons
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
    item.className = 'glass-card p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-cyan-500/30 transition-all';
    const icon = getActivityIcon(w.type);

    item.innerHTML = `
      <div class="flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-2xl shadow-inner shrink-0">
          ${icon}
        </div>
        <div>
          <h4 class="text-sm font-extrabold text-white capitalize">${w.type}</h4>
          <div class="flex items-center gap-3 mt-1">
            <div class="flex items-baseline gap-1">
              <span class="text-base sm:text-lg font-black text-white">${w.duration}</span>
              <span class="text-[11px] font-bold text-slate-400">min</span>
            </div>
            <span class="text-slate-600">•</span>
            <div class="flex items-baseline gap-1">
              <span class="text-base sm:text-lg font-black text-amber-400">${w.calories}</span>
              <span class="text-[11px] font-bold text-slate-400">kcal</span>
            </div>
          </div>
        </div>
      </div>
      <div class="text-right">
        <span class="text-sm sm:text-base font-black text-cyan-400">${w.strain ? Number(w.strain).toFixed(1) : '--'}</span>
        <p class="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Carga</p>
      </div>
    `;
    list.appendChild(item);
  });
}

// Local YYYY-MM-DD helper (respects user timezone e.g. Colombia UTC-5 instead of UTC flip at 7pm)
function getLocalDateString(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadSavedNutritionConfig() {
  try {
    return JSON.parse(localStorage.getItem('BIOCOACH_NUTRITION_CONFIG') || 'null');
  } catch {
    return null;
  }
}

function saveNutritionConfig(cfg) {
  localStorage.setItem('BIOCOACH_NUTRITION_CONFIG', JSON.stringify(cfg));
}

function updateGoalCardHighlight(goal) {
  document.querySelectorAll('.goal-card-label').forEach(lbl => {
    const g = lbl.getAttribute('data-goal-card');
    lbl.className = 'goal-card-label glass-card p-3 rounded-2xl border flex flex-col items-center cursor-pointer text-center transition-all ' + (
      g === goal
        ? (g === 'cut' ? 'border-amber-500 bg-amber-500/15' : (g === 'bulk' ? 'border-emerald-500 bg-emerald-500/15' : 'border-cyan-500 bg-cyan-500/15'))
        : 'border-slate-700/60 hover:border-slate-500'
    );
  });
}

// Recomputes BMR, TDEE (real 30-day Apple Watch or Mifflin-St Jeor), macros & syncs UI + Calorie Matrix
function recalculateNutrition(persist = false) {
  const weightInput = document.getElementById('nutr-weight');
  const heightInput = document.getElementById('nutr-height');
  const ageInput = document.getElementById('nutr-age');
  const genderInput = document.getElementById('nutr-gender');
  const activityInput = document.getElementById('nutr-activity');
  const useWatchToggle = document.getElementById('nutr-use-watch-tdee');

  const weight = parseFloat(weightInput?.value) || 75;
  const height = parseFloat(heightInput?.value) || 175;
  const age = parseInt(ageInput?.value, 10) || 26;
  const gender = genderInput?.value || 'male';
  const activity = activityInput?.value || 'moderate';
  const useWatchTdee = useWatchToggle ? useWatchToggle.checked : true;
  const goalRadio = document.querySelector('input[name="nutr-goal"]:checked');
  const goal = goalRadio ? goalRadio.value : 'maintain';

  updateGoalCardHighlight(goal);

  // Formula BMR/TDEE (Mifflin-St Jeor)
  const baseBmr = (10.0 * weight) + (6.25 * height) - (5.0 * age);
  const formulaBmr = Math.round(gender === 'female' ? (baseBmr - 161) : (baseBmr + 5));
  const multipliers = { sedentary: 1.20, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.90 };
  const formulaTdee = Math.round(formulaBmr * (multipliers[activity] || 1.55));

  // Real 30-day Apple Watch expenditure (if available and enabled)
  const watchStats = window.watchExpenditureStats || null;
  const usingWatch = Boolean(useWatchTdee && watchStats && watchStats.avgTdee > 0);
  const bmr = usingWatch ? watchStats.avgBasal : formulaBmr;
  const tdee = usingWatch ? watchStats.avgTdee : formulaTdee;

  const offsets = { cut: -400, maintain: 0, bulk: 300 };
  const offset = offsets[goal] || 0;
  const targetKcal = Math.round(Math.max(1400, tdee + offset));

  // Clinically calibrated macronutrients (sensible protein cap at higher bodyweights)
  const proteinG = Math.min(220, Math.round(weight * (weight > 95 ? 1.7 : 2.0)));
  const fatG = Math.min(110, Math.round(weight * 0.8));
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsG = Math.round(Math.max(60, (targetKcal - proteinKcal - fatKcal) / 4));

  const prevConsumed = window.currentNutritionState?.consumedToday ?? 0;

  window.currentNutritionState = {
    weight, height, age, gender, activity, goal, useWatchTdee, usingWatch,
    bmr, tdee, targetKcal, goalOffset: offset,
    consumedToday: prevConsumed,
    macros: { protein: proteinG, carbs: carbsG, fat: fatG }
  };

  if (persist) {
    saveNutritionConfig({ weight, height, age, gender, activity, goal, useWatchTdee, userEditedWeight: true });
  }

  updateNutritionDisplay();
  renderCalorieMatrix();
}

// Synchronizes Nutrition state with real 30-day Apple Watch expenditure, real weight & real Supabase nutrition_logs
async function syncNutritionWithDashboard(data) {
  if (!data) return;

  // 1. Compute real 30-day Watch Basal & Active expenditure (use complete days with basal >= 1200)
  const fullCal = data.full_calendar || [];
  const todayStr = getLocalDateString();
  const completeDays = fullCal.filter(d => d.date !== todayStr && d.basal_calories >= 1200 && d.active_calories != null);
  const fallbackDays = fullCal.filter(d => d.basal_calories > 0 && d.active_calories != null);
  const sampleDays = completeDays.length >= 3 ? completeDays : fallbackDays;

  if (sampleDays.length > 0) {
    const avgBasal = Math.round(sampleDays.reduce((s, d) => s + d.basal_calories, 0) / sampleDays.length);
    const avgActive = Math.round(sampleDays.reduce((s, d) => s + d.active_calories, 0) / sampleDays.length);
    window.watchExpenditureStats = {
      avgBasal,
      avgActive,
      avgTdee: avgBasal + avgActive,
      daysCount: sampleDays.length
    };
    const hintEl = document.getElementById('nutr-watch-summary-hint');
    if (hintEl) {
      hintEl.textContent = `Promedio ${sampleDays.length}d: ${avgBasal} basal + ${avgActive} activo = ${avgBasal + avgActive} kcal/día`;
    }
  }

  // 2. Auto-fill real Apple Watch Body Mass if user hasn't manually overridden weight
  const savedCfg = loadSavedNutritionConfig();
  const weightInput = document.getElementById('nutr-weight');
  if (data.today?.body_mass_kg && weightInput && (!savedCfg || !savedCfg.userEditedWeight)) {
    weightInput.value = Number(data.today.body_mass_kg).toFixed(1);
  }

  // 3. Auto-estimate any shortcut-logged meals missing estimated_calories via Gemini
  const logs = data.nutrition_logs || [];
  const pendingLogs = logs.filter(m => m.raw_text && (m.estimated_calories == null || Number(m.estimated_calories) === 0));
  if (pendingLogs.length > 0) {
    const athleteKey = getAthleteKey();
    for (const meal of pendingLogs.slice(0, 3)) {
      const est = await estimateMealMacros(meal.raw_text);
      meal.estimated_calories = est.calories;
      meal.protein_g = est.protein_g;
      meal.carbs_g = est.carbs_g;
      meal.fat_g = est.fat_g;
      if (athleteKey && meal.id) {
        fetch(`${SUPABASE_CONFIG.url}/rest/v1/nutrition_logs?id=eq.${meal.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
            'x-athlete-token': athleteKey
          },
          body: JSON.stringify({
            estimated_calories: est.calories,
            protein_g: est.protein_g,
            carbs_g: est.carbs_g,
            fat_g: est.fat_g
          })
        }).catch(() => {});
      }
    }
  }

  // 4. Sum real consumed calories for today from nutrition_logs
  const todayMeals = logs.filter(m => (m.logged_date || (m.created_at || '').slice(0, 10)) === todayStr);
  const consumedToday = todayMeals.reduce((sum, m) => sum + (Number(m.estimated_calories) || 0), 0);
  if (!window.currentNutritionState) window.currentNutritionState = {};
  window.currentNutritionState.consumedToday = consumedToday;

  recalculateNutrition(false);
  renderTodayMealsList(todayMeals);
}

// Estimates calories and macros using Gemini Flash (with deterministic fallback if offline)
async function estimateMealMacros(mealText) {
  try {
    const apiKey = localStorage.getItem('BIOCOACH_GEMINI_KEY') || DEFAULT_GEMINI_KEY;
    if (apiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
      const prompt = `Estima calorías y macronutrientes para esta comida colombiana/latina: "${mealText}". Responde ÚNICAMENTE un JSON válido sin markdown con las llaves exactas: {"calories": entero, "protein_g": numero, "carbs_g": numero, "fat_g": numero}.`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (res.ok) {
        const d = await res.json();
        const raw = (d?.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(raw);
        if (parsed && Number(parsed.calories) > 0) {
          return {
            calories: Math.round(Number(parsed.calories)),
            protein_g: Math.round(Number(parsed.protein_g || 20)),
            carbs_g: Math.round(Number(parsed.carbs_g || 40)),
            fat_g: Math.round(Number(parsed.fat_g || 15))
          };
        }
      }
    }
  } catch (e) {
    console.warn("Gemini meal estimate fallback:", e);
  }
  const t = mealText.toLowerCase();
  let cal = 450, p = 25, c = 48, f = 16;
  if (t.includes("huevo") || t.includes("arepa")) { cal = 420; p = 24; c = 42; f = 16; }
  if (t.includes("pollo") || t.includes("carne") || t.includes("bandeja") || t.includes("almuerzo")) { cal = 650; p = 42; c = 65; f = 22; }
  if (t.includes("ensalada") || t.includes("fruta") || t.includes("yogur")) { cal = 240; p = 10; c = 36; f = 6; }
  if (t.includes("café") && t.length < 25) { cal = 90; p = 4; c = 10; f = 3; }
  return { calories: cal, protein_g: p, carbs_g: c, fat_g: f };
}

function renderTodayMealsList(meals) {
  const container = document.getElementById('today-meals-list');
  if (!container) return;
  if (!meals || meals.length === 0) {
    container.innerHTML = '<p class="text-[11px] text-slate-500 italic">Sin comidas registradas hoy. Agrega tu primera comida arriba o por Siri.</p>';
    return;
  }

  container.innerHTML = meals.map(m => `
    <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-white/5 text-xs">
      <div class="min-w-0 flex-1">
        <p class="text-white font-semibold truncate">${m.raw_text}</p>
        <p class="text-[10px] text-slate-400">
          <strong class="text-amber-400">${m.estimated_calories || '--'} kcal</strong>
          • P: ${m.protein_g ?? '--'}g • C: ${m.carbs_g ?? '--'}g • G: ${m.fat_g ?? '--'}g
        </p>
      </div>
      ${m.id ? `<button type="button" data-delete-meal="${m.id}" class="btn-del-meal text-xs text-slate-500 hover:text-rose-400 px-1.5 py-1 rounded-lg transition-colors" title="Eliminar">🗑️</button>` : ''}
    </div>
  `).join('');

  container.querySelectorAll('.btn-del-meal').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-meal');
      const athleteKey = getAthleteKey();
      if (!id || !athleteKey) return;
      try {
        await fetch(`${SUPABASE_CONFIG.url}/rest/v1/nutrition_logs?id=eq.${id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
            'x-athlete-token': athleteKey
          }
        });
        showToast('Comida eliminada', 'info');
        await initDashboard();
      } catch (err) {
        showToast('Error al eliminar comida', 'error');
      }
    });
  });
}

// 10. Nutrition Engine: Real-Time Persistent Goals & Gemini Meal Persistence
function initNutrition() {
  const form = document.getElementById('nutrition-form');
  const mealForm = document.getElementById('meal-quick-form');

  const weightInput = document.getElementById('nutr-weight');
  const heightInput = document.getElementById('nutr-height');
  const ageInput = document.getElementById('nutr-age');
  const genderInput = document.getElementById('nutr-gender');
  const activityInput = document.getElementById('nutr-activity');
  const useWatchToggle = document.getElementById('nutr-use-watch-tdee');

  // Restore persisted user settings from localStorage
  const saved = loadSavedNutritionConfig();
  if (saved) {
    if (weightInput && saved.weight) weightInput.value = saved.weight;
    if (heightInput && saved.height) heightInput.value = saved.height;
    if (ageInput && saved.age) ageInput.value = saved.age;
    if (genderInput && saved.gender) genderInput.value = saved.gender;
    if (activityInput && saved.activity) activityInput.value = saved.activity;
    if (useWatchToggle && typeof saved.useWatchTdee === 'boolean') useWatchToggle.checked = saved.useWatchTdee;
    if (saved.goal) {
      const radio = document.querySelector(`input[name="nutr-goal"][value="${saved.goal}"]`);
      if (radio) radio.checked = true;
    }
  }

  // Real-time calculation & persistence on EVERY change
  [weightInput, heightInput, ageInput, genderInput, activityInput, useWatchToggle].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', () => recalculateNutrition(true));
      inp.addEventListener('change', () => recalculateNutrition(true));
    }
  });

  document.querySelectorAll('input[name="nutr-goal"]').forEach(r => {
    r.addEventListener('change', () => recalculateNutrition(true));
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      recalculateNutrition(true);
      showToast('✅ Metas y presupuesto calórico guardados', 'success');
      const btnBalance = document.getElementById('nutr-subtab-balance');
      if (btnBalance) btnBalance.click();
    });
  }

  // Calorie History Range Switcher (7 Días | 15 Días)
  window.activeCalorieRange = 7;
  const calRangeButtons = document.querySelectorAll('.cal-range-btn');
  calRangeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.getAttribute('data-cal-range') || '7', 10);
      window.activeCalorieRange = days;
      calRangeButtons.forEach(b => {
        const act = parseInt(b.getAttribute('data-cal-range'), 10) === days;
        b.className = act
          ? 'cal-range-btn px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-amber-400 bg-amber-500/15 transition-all'
          : 'cal-range-btn px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-slate-400 hover:text-white transition-all';
      });
      renderCalorieMatrix();
    });
  });

  // Real Quick Meal Log: Gemini estimates macros -> saves to Supabase nutrition_logs -> refreshes UI
  if (mealForm) {
    mealForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('input-meal-text');
      const submitBtn = document.getElementById('btn-submit-meal');
      const text = input ? input.value.trim() : '';
      if (!text) return;

      const origText = submitBtn ? submitBtn.textContent : 'Registrar';
      if (submitBtn) { submitBtn.textContent = 'Calculando...'; submitBtn.disabled = true; }

      try {
        const est = await estimateMealMacros(text);
        const todayStr = getLocalDateString();
        const athleteKey = getAthleteKey() || 'atleta_privado';
        const hr = new Date().getHours();
        const mealType = hr < 11 ? 'desayuno' : (hr < 16 ? 'almuerzo' : (hr < 21 ? 'cena' : 'snack'));

        const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/nutrition_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
            'Prefer': 'return=representation',
            'x-athlete-token': athleteKey
          },
          body: JSON.stringify({
            logged_date: todayStr,
            meal_type: mealType,
            raw_text: text,
            estimated_calories: est.calories,
            protein_g: est.protein_g,
            carbs_g: est.carbs_g,
            fat_g: est.fat_g,
            athlete_id: athleteKey,
            is_demo: false
          })
        });

        if (!res.ok) throw new Error('Error guardando comida en Supabase');
        if (input) input.value = '';
        showToast(`🍽️ +${est.calories} kcal (P:${est.protein_g}g C:${est.carbs_g}g G:${est.fat_g}g) guardadas`, 'success');
        await initDashboard();
      } catch (err) {
        showToast('Error al registrar comida: ' + err.message, 'error');
      } finally {
        if (submitBtn) { submitBtn.textContent = origText; submitBtn.disabled = false; }
      }
    });
  }

  // Initial calculation (zero hardcoded 1850 consumed)
  window.currentNutritionState.consumedToday = 0;
  recalculateNutrition(false);
}

// Updates Circular Caloric Gauge and Macronutrient Bars
function updateNutritionDisplay() {
  const state = window.currentNutritionState;
  if (!state) return;

  const targetEl = document.getElementById('nutr-target-kcal');
  const bmrEl = document.getElementById('nutr-bmr');
  const tdeeEl = document.getElementById('nutr-tdee');
  const goalOffsetEl = document.getElementById('nutr-goal-offset');
  const pctBadge = document.getElementById('calorie-pct-badge');
  const ringCircle = document.getElementById('calorie-svg-ring');
  const sourceBadge = document.getElementById('nutr-tdee-source');

  if (sourceBadge) {
    sourceBadge.textContent = state.usingWatch ? '⌚ Apple Watch 30d' : '📐 Fórmula Mifflin';
  }

  if (targetEl) targetEl.textContent = state.targetKcal.toLocaleString('es-CO');
  if (bmrEl) bmrEl.textContent = `${state.bmr.toLocaleString('es-CO')} kcal`;
  if (tdeeEl) tdeeEl.textContent = `${state.tdee.toLocaleString('es-CO')} kcal`;
  if (goalOffsetEl) {
    goalOffsetEl.textContent = `${state.goalOffset > 0 ? '+' : ''}${state.goalOffset} kcal`;
    goalOffsetEl.className = `text-base font-extrabold mt-0.5 ${state.goal === 'cut' ? 'text-amber-400' : (state.goal === 'bulk' ? 'text-emerald-400' : 'text-cyan-400')}`;
  }

  // SVG Circular Gauge Animation (Circumference = 314.16 for r=50)
  const circumference = 314.16;
  const consumed = state.consumedToday || 0;
  const progressRatio = Math.min(1.2, consumed / (state.targetKcal || 2000));
  const offset = Math.max(0, circumference * (1 - Math.min(1.0, progressRatio)));

  if (ringCircle) {
    ringCircle.style.strokeDashoffset = `${offset}px`;
  }

  if (pctBadge) {
    const pct = Math.round(progressRatio * 100);
    pctBadge.textContent = `${pct}% (${consumed.toLocaleString('es-CO')} / ${state.targetKcal.toLocaleString('es-CO')} kcal)`;
    if (pct > 105 && state.goal === 'cut') {
      pctBadge.className = 'mt-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300';
    } else {
      pctBadge.className = 'mt-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300';
    }
  }

  // Macros
  const m = state.macros;
  const proteinEl = document.getElementById('nutr-protein');
  const carbsEl = document.getElementById('nutr-carbs');
  const fatEl = document.getElementById('nutr-fat');

  if (proteinEl) proteinEl.textContent = `${m.protein} g`;
  if (carbsEl) carbsEl.textContent = `${m.carbs} g`;
  if (fatEl) fatEl.textContent = `${m.fat} g`;

  const totalMacroKcal = (m.protein * 4) + (m.carbs * 4) + (m.fat * 9);
  const barProtein = document.getElementById('bar-protein');
  const barCarbs = document.getElementById('bar-carbs');
  const barFat = document.getElementById('bar-fat');

  if (barProtein) barProtein.style.width = `${((m.protein * 4) / totalMacroKcal) * 100}%`;
  if (barCarbs) barCarbs.style.width = `${((m.carbs * 4) / totalMacroKcal) * 100}%`;
  if (barFat) barFat.style.width = `${((m.fat * 9) / totalMacroKcal) * 100}%`;
}

// 11. Real 7d / 15d Caloric Expenditure & Balance Carousel (100% Real Apple Watch + Supabase nutrition_logs, ZERO placeholders!)
function renderCalorieMatrix() {
  const grid = document.getElementById('calorie-calendar-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const state = window.currentNutritionState || {};
  const defaultTdee = state.tdee || 2600;
  const goalOffset = state.goalOffset || 0;
  const goal = state.goal || 'maintain';
  const rangeDays = window.activeCalorieRange || 7;

  const fullCal = window.currentDashboardData?.full_calendar || [];
  const logs = window.currentDashboardData?.nutrition_logs || [];

  if (fullCal.length === 0) {
    grid.innerHTML = '<p class="w-full text-center text-xs text-slate-500 py-4">Sincroniza tu Apple Watch para ver tu gasto calórico real.</p>';
    return;
  }

  // Aggregate real nutrition_logs calories by logged_date
  const mealsByDate = {};
  logs.forEach(m => {
    const dt = m.logged_date || (m.created_at || '').slice(0, 10);
    if (!dt) return;
    mealsByDate[dt] = (mealsByDate[dt] || 0) + (Number(m.estimated_calories) || 0);
  });

  const sliced = fullCal.slice(-rangeDays);

  sliced.forEach((d, idx) => {
    const isToday = idx === sliced.length - 1;
    const hasWatchCal = d.basal_calories != null && d.active_calories != null;
    const dayTdee = hasWatchCal ? Math.round(d.basal_calories + d.active_calories) : defaultTdee;
    const dayTarget = Math.max(1400, dayTdee + goalOffset);
    const consumed = mealsByDate[d.date] || 0;

    let badgeText = "Sin comidas";
    let badgeClass = "text-slate-400 bg-slate-800/70 border-white/10";
    let deltaStr = `Act: ${d.active_calories ?? '--'}`;

    if (consumed > 0) {
      const delta = consumed - dayTarget;
      deltaStr = `${delta > 0 ? '+' : ''}${delta}`;
      if (goal === 'cut') {
        if (consumed <= dayTarget + 100) {
          badgeText = "🟢 En Meta";
          badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
        } else if (consumed <= dayTdee + 50) {
          badgeText = "🟡 Mantenim.";
          badgeClass = "text-amber-400 bg-amber-500/10 border-amber-500/20";
        } else {
          badgeText = "🔴 Superávit";
          badgeClass = "text-rose-400 bg-rose-500/10 border-rose-500/20";
        }
      } else if (goal === 'bulk') {
        if (consumed >= dayTarget - 100 && consumed <= dayTarget + 250) {
          badgeText = "🟢 Anabólico";
          badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
        } else if (consumed >= dayTdee) {
          badgeText = "🟡 Mantenim.";
          badgeClass = "text-amber-400 bg-amber-500/10 border-amber-500/20";
        } else {
          badgeText = "🔴 Déficit";
          badgeClass = "text-rose-400 bg-rose-500/10 border-rose-500/20";
        }
      } else {
        if (Math.abs(consumed - dayTdee) <= 200) {
          badgeText = "🟢 Equilibrio";
          badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
        } else if (consumed > dayTdee + 200) {
          badgeText = "🔴 Superávit";
          badgeClass = "text-rose-400 bg-rose-500/10 border-rose-500/20";
        } else {
          badgeText = "🟡 Déficit";
          badgeClass = "text-amber-400 bg-amber-500/10 border-amber-500/20";
        }
      }
    }

    const card = document.createElement('div');
    card.className = `w-[118px] shrink-0 snap-start glass-card p-3 rounded-2xl flex flex-col items-center gap-1.5 border ${isToday ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/5'} text-center overflow-hidden`;
    card.innerHTML = `
      <span class="text-[10px] font-bold text-slate-300 uppercase">${d.day_name} ${d.date.slice(5)}</span>
      <div class="text-center">
        <span class="text-[9px] text-slate-500 uppercase block">Gasto Watch</span>
        <span class="text-xs font-black text-cyan-400 whitespace-nowrap">${dayTdee.toLocaleString('es-CO')} <span class="text-[9px] font-normal text-slate-400">kcal</span></span>
      </div>
      <div class="px-2 py-0.5 rounded-lg border text-[10px] font-extrabold whitespace-nowrap ${badgeClass}">
        ${badgeText}
      </div>
      <div class="w-full pt-1.5 border-t border-white/5 text-[9px] flex justify-between text-slate-400">
        <span>In: ${consumed > 0 ? consumed : '--'}</span>
        <span class="font-bold text-amber-300">${deltaStr}</span>
      </div>
    `;
    grid.appendChild(card);
  });

  requestAnimationFrame(() => {
    grid.scrollLeft = grid.scrollWidth;
  });
}

// 12. Conversational Coach Chat (Direct Gemini Flash AI with Clinical Context)
function initChat() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const thread = document.getElementById('chat-messages');
  const pills = document.querySelectorAll('.quick-pill');

  pills.forEach((p) => {
    p.addEventListener('click', () => {
      input.value = p.textContent.trim();
      form.dispatchEvent(new Event('submit'));
    });
  });

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';

    const typingEl = appendTypingIndicator();

    try {
      const apiKey = localStorage.getItem('BIOCOACH_GEMINI_KEY') || DEFAULT_GEMINI_KEY;
      const reply = await queryGeminiDirectly(text, apiKey);
      typingEl.remove();
      appendMessage('ai', reply);
    } catch (err) {
      typingEl.remove();
      appendMessage('ai', 'Respuesta fisiológica: Monitorea tu HRV y mantén una ingesta de 2.0g/kg de proteína hoy para acelerar la recuperación.');
    }
  });

  function formatSafeChatText(raw) {
    const escaped = String(raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
  }

  function appendMessage(sender, text) {
    if (!thread) return;
    const msg = document.createElement('div');
    msg.className = 'flex items-start gap-3';
    if (sender === 'user') {
      msg.innerHTML = `
        <div class="ml-auto glass-card bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-3xl rounded-tr-sm text-xs sm:text-sm leading-relaxed max-w-[85%] text-white whitespace-pre-line">
          ${formatSafeChatText(text)}
        </div>
      `;
    } else {
      msg.innerHTML = `
        <div class="w-8 h-8 rounded-2xl bg-violet-600 flex items-center justify-center text-xs font-bold shrink-0 shadow-lg shadow-violet-500/20">AI</div>
        <div class="glass-card p-4 rounded-3xl rounded-tl-sm text-xs sm:text-sm leading-relaxed max-w-[85%] text-slate-200 border border-white/5 whitespace-pre-line">
          ${formatSafeChatText(text)}
        </div>
      `;
    }
    thread.appendChild(msg);
    thread.scrollTop = thread.scrollHeight;
    return msg;
  }

  function appendTypingIndicator() {
    if (!thread) return document.createElement('div');
    const typing = document.createElement('div');
    typing.className = 'flex items-start gap-3';
    typing.innerHTML = `
      <div class="w-8 h-8 rounded-2xl bg-violet-600 flex items-center justify-center text-xs font-bold shrink-0">AI</div>
      <div class="glass-card p-3 rounded-2xl rounded-tl-sm flex items-center gap-1 border border-white/5">
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

// Builds a complete, dense clinical telemetry block from all Apple Watch metrics for Gemini
function buildFullBiometricContext(t) {
  if (!t) return "";
  const extra = t.extra_metrics || {};
  const lines = [
    `Fecha: ${t.date || '--'} (Rango base calculado sobre ${t.history_days || 1} días)`,
    `- Recuperación: ${t.score ?? '--'}%`,
    `- Sueño: Total ${t.sleep ?? '--'}h | Profundo ${t.deep_sleep ?? '--'}h | REM ${t.rem_sleep ?? '--'}h | Core ${t.core_sleep ?? '--'}h | Despierto ${t.awake_sleep ?? '--'}h`,
    `- Cardio: FC Reposo ${t.rhr ?? '--'} lpm (media 30d: ${t.base_rhr != null ? t.base_rhr.toFixed(1) : '--'}), FC Prom ${t.avg_hr ?? '--'} (mín ${t.min_hr ?? '--'}/máx ${t.max_hr ?? '--'}), FC Caminando ${t.walking_hr_avg ?? '--'} lpm, HRV ${t.hrv ?? '--'} ms (media 30d: ${t.base_hrv != null ? t.base_hrv.toFixed(1) : '--'}), VO2Max ${t.vo2_max ?? '--'} mL/min·kg`,
    `- Respiratorio/Inmune: Respiración ${t.respiratory_rate ?? '--'} rpm (media 30d: ${t.base_resp != null ? t.base_resp.toFixed(1) : '--'}), SpO2 ${t.spo2_pct ?? '--'}% (media 30d: ${t.base_spo2 != null ? t.base_spo2.toFixed(1) : '--'}%), Alteraciones Resp. Sueño ${t.breathing_disturbances ?? '--'}/h (media 30d: ${t.base_breath_dist != null ? t.base_breath_dist.toFixed(1) : '--'}), Temp. Muñeca ${t.wrist_temp_deviation ?? '--'}°C (media 30d: ${t.base_temp != null ? t.base_temp.toFixed(2) : '--'}°C)`,
    `- Actividad/Entorno: Pasos ${t.steps ?? '--'} (media: ${t.base_steps ?? '--'}), Cal Activas ${t.active_calories ?? '--'} kcal (media: ${t.base_active_cal ?? '--'}), Cal Basales ${t.basal_calories ?? '--'} kcal, Ejercicio ${t.exercise_minutes ?? '--'} min, Horas de Pie ${t.stand_hours ?? '--'}h, Distancia ${t.distance_km ?? '--'} km, Pisos ${t.flights_climbed ?? '--'}, Luz Solar ${t.daylight_minutes ?? '--'} min, Ruido Ambiental ${t.audio_exposure_db ?? '--'} dB, Peso ${t.body_mass_kg ?? '--'} kg`
  ];
  const mobilityParts = [];
  if (extra.walking_speed_kmh != null) mobilityParts.push(`Vel. marcha ${extra.walking_speed_kmh} km/h`);
  if (extra.walking_step_length_cm != null) mobilityParts.push(`Paso ${extra.walking_step_length_cm} cm`);
  if (extra.walking_asymmetry_pct != null) mobilityParts.push(`Asimetría ${extra.walking_asymmetry_pct}%`);
  if (extra.walking_steadiness_pct != null) mobilityParts.push(`Estabilidad ${extra.walking_steadiness_pct}%`);
  if (mobilityParts.length > 0) lines.push(`- Movilidad/Marcha: ${mobilityParts.join(', ')}`);
  if (t.recent_clinical_events && t.recent_clinical_events.length > 0) {
    lines.push(`- Alertas Clínicas Recientes (30d): ${t.recent_clinical_events.join(' | ')}`);
  }
  const hrChecks = window.currentDashboardData?.hr_checkins || [];
  if (hrChecks.length > 0) {
    const latestHr = hrChecks[0];
    lines.push(`- Último Check Cardíaco: ${latestHr.current_hr} lpm (${latestHr.user_sensation || 'rutina'}, ${(latestHr.created_at || '').slice(0, 16).replace('T', ' ')})`);
  }
  const meals = window.currentDashboardData?.nutrition_logs || [];
  if (meals.length > 0) {
    const recentMeals = meals.slice(0, 3).map(m => `${m.meal_type || 'comida'}: "${m.raw_text}"`).join(' | ');
    lines.push(`- Comidas Registradas Recientes: ${recentMeals}`);
  }
  return lines.join('\n');
}

// Intent-Aware Context Router for Chat: injects ONLY the exact timeframe & metrics relevant to the user's question
function buildFocusedChatContext(userQuestion, data) {
  if (!data || !data.today) return "";
  const q = (userQuestion || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const fullCal = data.full_calendar || data.weekly_calendar || [];
  const t = data.today;

  // 1. Detect requested timeframe
  let days = 7;
  let timeframeLabel = "últimos 7 días";
  const explicitMatch = q.match(/(\d+)\s*(dias|dia|noches|noche)/);
  if (explicitMatch) {
    days = Math.min(30, Math.max(1, parseInt(explicitMatch[1], 10)));
    timeframeLabel = `últimos ${days} días`;
  } else if (/\b(mes|30|treinta|historial completo|todo el historial)\b/.test(q)) {
    days = 30;
    timeframeLabel = "últimos 30 días";
  } else if (/\b(quincena|15|quince|dos semanas)\b/.test(q)) {
    days = 15;
    timeframeLabel = "últimos 15 días";
  } else if (/\b(ayer)\b/.test(q)) {
    days = 2;
    timeframeLabel = "ayer y hoy";
  } else if (/\b(hoy)\b/.test(q) && !/\b(semana|dias)\b/.test(q)) {
    days = 1;
    timeframeLabel = "hoy";
  }

  const slice = fullCal.slice(-days);

  // 2. Detect specific topic(s) asked by the user
  const askSleep = /(sueno|dorm|descans|rem|profund|despert|siesta|insomnio|noche|madrugada)/.test(q);
  const askCardio = /(hrv|vfc|pulso|corazon|latid|reposo|estres|recupera|hipertens|presion|tension|cardio)/.test(q);
  const askImmune = /(gripa|gripe|fiebre|enferm|respir|apnea|oxigeno|spo2|temperatura|temp|inmune|virus|infecc)/.test(q);
  const askExercise = /(pasos|camin|ejercici|entren|correr|bici|vo2|escaler|marcha|esfuerzo|distancia|gym|pesas|movilidad|actividad)/.test(q);
  const askNutrition = /(calor|comid|comi|diet|macro|protein|carbo|grasa|peso|deficit|volumen|bajar|subir|hambre|tdee|bmr|nutric)/.test(q);
  const askAlerts = /(alerta|peligro|cuidado|riesgo|anomal|importante|evento|chequeo|resumen general)/.test(q);

  const hasSpecificTopic = askSleep || askCardio || askImmune || askExercise || askNutrition || askAlerts;
  const sections = [`FECHA ACTUAL: ${t.date} | VENTANA SOLICITADA: ${timeframeLabel} (${slice.length} registros)`];

  if (askSleep) {
    const sleepRows = slice.map(d =>
      `  ${d.date} (${d.day_name}): Total ${d.sleep != null ? d.sleep.toFixed(2) : '--'}h | Profundo ${d.deep_sleep != null ? d.deep_sleep.toFixed(2) : '--'}h | REM ${d.rem_sleep != null ? d.rem_sleep.toFixed(2) : '--'}h | Core ${d.core_sleep != null ? d.core_sleep.toFixed(2) : '--'}h | Despierto ${d.awake_sleep != null ? d.awake_sleep.toFixed(2) : '--'}h`
    ).join('\n');
    sections.push(`DATOS DE SUEÑO (${timeframeLabel} | media 30d: ${t.base_sleep != null ? t.base_sleep.toFixed(2) : '--'}h):\n${sleepRows}`);
  }

  if (askCardio) {
    const cardioRows = slice.map(d =>
      `  ${d.date}: VFC ${d.hrv != null ? Math.round(d.hrv) : '--'}ms | FC Reposo ${d.rhr != null ? Math.round(d.rhr) : '--'}lpm | FC Prom ${d.avg_hr != null ? Math.round(d.avg_hr) : '--'} | Máx ${d.max_hr != null ? Math.round(d.max_hr) : '--'} | Score ${d.overall_score}%`
    ).join('\n');
    sections.push(`DATOS CARDIOVASCULARES (base 30d: VFC ${t.base_hrv?.toFixed(1) ?? '--'}ms, FC Reposo ${t.base_rhr?.toFixed(1) ?? '--'}lpm):\n${cardioRows}`);
    const hrChecks = data.hr_checkins || [];
    if (hrChecks.length > 0) {
      sections.push(`CHEQUEOS CARDÍACOS RECIENTES: ${hrChecks.slice(0, 3).map(h => `${h.current_hr} lpm (${h.user_sensation || 'rutina'}, ${(h.created_at || '').slice(0, 10)})`).join(' | ')}`);
    }
    const hypAlerts = (data.clinical_alerts || []).filter(a => a.category === 'hypertension');
    if (hypAlerts.length > 0) {
      sections.push(`ALERTAS DE HIPERTENSIÓN: ${hypAlerts.map(a => `${a.date}: ${a.title}`).join(' | ')}`);
    }
  }

  if (askImmune) {
    const immRows = slice.map(d =>
      `  ${d.date}: Temp ${d.temp_c != null ? d.temp_c.toFixed(2) : '--'}°C | Resp ${d.resp != null ? d.resp.toFixed(1) : '--'} rpm | SpO2 ${d.spo2_pct != null ? d.spo2_pct.toFixed(1) : '--'}% | Alt.Resp ${d.breathing_disturbances != null ? d.breathing_disturbances.toFixed(1) : '--'}/h`
    ).join('\n');
    sections.push(`DATOS RESPIRATORIOS E INMUNES (base 30d: Temp ${t.base_temp?.toFixed(2) ?? '--'}°C, Resp ${t.base_resp?.toFixed(1) ?? '--'} rpm, SpO2 ${t.base_spo2?.toFixed(1) ?? '--'}%, Alt.Resp ${t.base_breath_dist?.toFixed(1) ?? '--'}/h):\n${immRows}`);
    const respAlerts = (data.clinical_alerts || []).filter(a => ['apnea', 'temperature', 'spo2'].includes(a.category));
    if (respAlerts.length > 0) {
      sections.push(`ALERTAS RESPIRATORIAS/TEMP: ${respAlerts.slice(0, 5).map(a => `${a.date}: ${a.title}`).join(' | ')}`);
    }
  }

  if (askExercise) {
    const exRows = slice.map(d => {
      const ex = d.extra_metrics || {};
      return `  ${d.date}: Pasos ${d.steps ?? '--'} | Cal Activas ${d.active_calories ?? '--'} kcal | Ejerc ${d.exercise_minutes ?? '--'} min | Dist ${d.distance_km ?? '--'} km | FC Cam ${d.walking_hr_avg != null ? Math.round(d.walking_hr_avg) : '--'} | Vel ${ex.walking_speed_kmh ?? '--'} km/h`;
    }).join('\n');
    sections.push(`DATOS DE EJERCICIO Y MOVILIDAD (VO2Max: ${t.vo2_max ?? '--'}, Estabilidad: ${t.extra_metrics?.walking_steadiness_pct ?? '--'}%, Test 6min: ${t.extra_metrics?.six_min_walk_m ?? '--'}m):\n${exRows}`);
    if ((data.recent_workouts || []).length > 0) {
      sections.push(`ENTRENOS REGISTRADOS: ${data.recent_workouts.slice(0, 5).map(w => `${w.date} ${w.type} ${w.duration}m ${w.calories}kcal`).join(' | ')}`);
    }
  }

  if (askNutrition) {
    const ns = window.currentNutritionState || {};
    const calRows = slice.map(d => {
      const tot = (d.basal_calories != null && d.active_calories != null) ? Math.round(d.basal_calories + d.active_calories) : '--';
      return `  ${d.date}: Gasto Watch ${tot} kcal (Basal ${d.basal_calories ?? '--'} + Activo ${d.active_calories ?? '--'})`;
    }).join('\n');
    sections.push(`PERFIL NUTRICIONAL: Peso ${t.body_mass_kg ?? ns.weight ?? '--'} kg | Objetivo: ${ns.goal || 'maintain'} (${ns.goalOffset || 0} kcal) | Meta diaria: ${ns.targetKcal || '--'} kcal (P:${ns.macros?.protein || '--'}g C:${ns.macros?.carbs || '--'}g G:${ns.macros?.fat || '--'}g) | Consumido hoy: ${ns.consumedToday || 0} kcal\nGASTO DIARIO:\n${calRows}`);
    const meals = data.nutrition_logs || [];
    if (meals.length > 0) {
      sections.push(`COMIDAS REGISTRADAS: ${meals.slice(0, 6).map(m => `${m.logged_date || ''} ${m.meal_type || ''}: "${m.raw_text}" (${m.estimated_calories || '--'} kcal)`).join(' | ')}`);
    }
  }

  if (askAlerts) {
    const al = data.clinical_alerts || [];
    sections.push(al.length > 0
      ? `ALERTAS CLÍNICAS (últimos 30 días):\n${al.map(a => `  ${a.date} [${a.categoryLabel}]: ${a.title} — ${a.detail}`).join('\n')}`
      : 'ALERTAS CLÍNICAS: Ninguna alerta crítica en los últimos 30 días.'
    );
  }

  // Only if question is broad/general (no specific domain detected), send concise Today core summary
  if (!hasSpecificTopic) {
    sections.push(`RESUMEN CONCISO DE HOY (${t.date}): Recuperación ${t.score}% | Sueño ${t.sleep ?? '--'}h (base ${t.base_sleep?.toFixed(1) ?? '--'}h) | VFC ${t.hrv ?? '--'}ms (base ${t.base_hrv?.toFixed(0) ?? '--'}ms) | FC Reposo ${t.rhr ?? '--'}lpm (base ${t.base_rhr?.toFixed(0) ?? '--'}lpm) | Temp ${t.wrist_temp_deviation ?? '--'}°C | Pasos ${t.steps ?? '--'}.`);
  }

  return sections.join('\n\n');
}

// Queries Google Gemini AI API directly with focused intent-routed context & short session memory
async function queryGeminiDirectly(userQuestion, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

  if (!window.chatHistory) window.chatHistory = [];

  const focusedContext = buildFocusedChatContext(userQuestion, window.currentDashboardData);
  const recentTurns = window.chatHistory.slice(-4).map(h => `${h.role === 'user' ? 'Atleta' : 'BioCoach'}: ${h.text}`).join('\n');

  const prompt = `Eres BioCoach AI, fisiólogo deportivo y coach de salud personal.
REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE y con precisión a la pregunta concreta del atleta usando los datos exactos provistos abajo.
2. PROHIBIDO hacer un resumen general de toda su salud o mencionar métricas que NO se pidieron (ejemplo: si pregunta cómo durmió los últimos 7 días, responde SOLO sobre su sueño día por día con fechas/horas reales y patrón; NO hables de pasos, ruido, hipertensión ni otros temas).
3. Responde en español, directo, claro y natural (máximo 2-3 párrafos cortos o viñetas concisas).

DATOS RELEVANTES PARA ESTA PREGUNTA:
${focusedContext || 'Sin datos biométricos cargados aún.'}
${recentTurns ? `\nCONVERSACIÓN PREVIA:\n${recentTurns}\n` : ''}
PREGUNTA ACTUAL DEL ATLETA: "${userQuestion}"`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  if (!res.ok) throw new Error("Gemini API error " + res.status);
  const data = await res.json();
  const reply = data.candidates[0].content.parts[0].text;

  window.chatHistory.push({ role: 'user', text: userQuestion });
  window.chatHistory.push({ role: 'ai', text: reply });
  if (window.chatHistory.length > 8) window.chatHistory = window.chatHistory.slice(-8);

  return reply;
}

// Automatically generates a real daily Gemini clinical briefing ("Hay que ponerle cuidado a X o Y")
// comparing today's full Apple Watch metrics against the 30-day Typical Range, and persists it to Supabase.
async function fetchAndSaveDailyGeminiVerdict(t) {
  try {
    const apiKey = localStorage.getItem('BIOCOACH_GEMINI_KEY') || DEFAULT_GEMINI_KEY;
    if (!apiKey) return;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
    const fullContext = buildFullBiometricContext(t);
    const prompt = `Actúa como BioCoach AI (fisiólogo deportivo y médico preventivo). Analiza la telemetría COMPLETA de hoy comparada contra el rango típico de los últimos ${t.history_days || 30} días:\n${fullContext}\n\nResponde en ESPAÑOL en máximo 2-3 frases directas y concretas (sin saludos, sin markdown, máximo 280 caracteres). Empieza con el semáforo (🟢, 🟡 o 🔴) y di explícitamente a qué hay que ponerle cuidado hoy (ej. déficit de sueño profundo, SpO2 bajo, alteraciones respiratorias altas, posible inicio de gripa si subió temperatura/respiración, fatiga simpática, sedentarismo o luz verde si todo está en rango típico) + 1 acción práctica concreta para hoy.`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!res.ok) return;
    const data = await res.json();
    const verdictText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!verdictText) return;

    const verdictEl = document.getElementById('gemini-daily-verdict');
    if (verdictEl) verdictEl.textContent = `"${verdictText}"`;

    // Persist today's Gemini verdict in Supabase so it is cached for the rest of the day
    const athleteKey = getAthleteKey();
    if (athleteKey) {
      await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/daily_recovery?recorded_date=eq.${encodeURIComponent(t.date)}&athlete_id=eq.${encodeURIComponent(athleteKey)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
            'x-athlete-token': athleteKey
          },
          body: JSON.stringify({
            gemini_verdict: verdictText,
            recovery_score: t.score
          })
        }
      );
    }
  } catch (err) {
    console.warn("Auto Gemini daily briefing skipped:", err);
  }
}

// 13. Smart Automatic Telemetry Synchronization
function initManualSync() {
  const modal = document.getElementById('sync-modal');
  const btnOpenModal = document.getElementById('btn-open-sync-modal');
  const btnHeaderSync = document.getElementById('btn-header-sync');
  const btnCloseModal = document.getElementById('btn-close-sync-modal');
  const btnCancelSync = document.getElementById('btn-cancel-sync');
  const btnRunShortcut = document.getElementById('btn-run-shortcut-ios');
  const btnFetchCloud = document.getElementById('btn-fetch-cloud-sync');
  const syncForm = document.getElementById('sync-form');
  const submitBtn = document.getElementById('btn-submit-sync');

  const openModal = () => {
    if (!modal) return;
    // Always sync inputs with current live telemetry so hardcoded placeholders never overwrite real data
    const current = window.currentDashboardData?.today;
    const sleepInput = document.getElementById('input-sleep');
    const hrvInput = document.getElementById('input-hrv');
    const rhrInput = document.getElementById('input-rhr');
    const deepInput = document.getElementById('input-deep');
    const remInput = document.getElementById('input-rem');

    if (sleepInput && current?.sleep != null) sleepInput.value = Number(current.sleep).toFixed(2);
    if (hrvInput && current?.hrv != null) hrvInput.value = Math.round(current.hrv);
    if (rhrInput && current?.rhr != null) rhrInput.value = Math.round(current.rhr);
    if (deepInput && current?.deep_sleep != null) deepInput.value = Number(current.deep_sleep).toFixed(2);
    if (remInput && current?.rem_sleep != null) remInput.value = Number(current.rem_sleep).toFixed(2);

    modal.classList.remove('hidden');
  };

  const closeModal = () => modal && modal.classList.add('hidden');

  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelSync) btnCancelSync.addEventListener('click', closeModal);

  // Global Header Sync Button: queries cloud directly, refreshes and organizes
  if (btnHeaderSync) {
    btnHeaderSync.addEventListener('click', async () => {
      const athleteKey = getAthleteKey();
      if (!athleteKey) {
        showToast('Modo Demostración activo. Abre PIN para tus datos privados.', 'info');
        const pinModal = document.getElementById('secret-pin-modal');
        if (pinModal) {
          updateSecretDotUI();
          pinModal.classList.remove('hidden');
          document.getElementById('input-secret-pin')?.focus();
        }
        return;
      }

      const origText = btnHeaderSync.innerHTML;
      btnHeaderSync.innerHTML = '<span class="text-xs animate-spin">⏳</span><span class="hidden sm:inline"> Consultando...</span>';
      try {
        await initDashboard();
        const currentData = window.currentDashboardData;
        if (currentData && currentData.today) {
          showToast(`Sincronizado: Hoy ${currentData.today.score}% | VFC: ${currentData.today.hrv || '--'}ms | Sueño: ${currentData.today.sleep || '--'}h`, 'success');
        } else {
          showToast(`Conectado a Supabase (PIN ${athleteKey}). Sin registros hoy aún.`, 'info');
        }
        btnHeaderSync.innerHTML = '<span class="text-xs">✅</span><span class="hidden sm:inline"> Al día</span>';
        setTimeout(() => { btnHeaderSync.innerHTML = origText; }, 2500);
      } catch (e) {
        btnHeaderSync.innerHTML = origText;
        showToast('Error al conectar con la nube: ' + e.message, 'error');
      }
    });
  }

  // 1-Click Apple Watch Trigger via iOS Shortcut Scheme (Banner & Modal)
  const triggerShortcut = () => {
    window.location.href = 'shortcuts://run-shortcut?name=BioCoach%20Vitales';
    showToast('Abriendo atajo BioCoach Vitales en iPhone...', 'info');
    const onFocus = async () => {
      window.removeEventListener('focus', onFocus);
      await initDashboard();
    };
    window.addEventListener('focus', onFocus);
    setTimeout(() => {
      closeModal();
    }, 1500);
  };

  const btnBannerShortcut = document.getElementById('btn-banner-run-shortcut');
  if (btnBannerShortcut) btnBannerShortcut.addEventListener('click', triggerShortcut);
  if (btnRunShortcut) btnRunShortcut.addEventListener('click', triggerShortcut);

  // Cloud Sync / Re-organize Telemetry from Supabase
  if (btnFetchCloud) {
    btnFetchCloud.addEventListener('click', async () => {
      const athleteKey = getAthleteKey();
      if (!athleteKey) {
        showToast('Modo Demostración activo. Ingresa tu PIN de atleta.', 'warning');
        closeModal();
        const pinModal = document.getElementById('secret-pin-modal');
        if (pinModal) {
          updateSecretDotUI();
          pinModal.classList.remove('hidden');
          document.getElementById('input-secret-pin')?.focus();
        }
        return;
      }

      btnFetchCloud.textContent = 'Consultando Supabase...';
      try {
        await initDashboard();
        closeModal();
        const currentData = window.currentDashboardData;
        if (currentData && currentData.today) {
          showToast(`¡Telemetría sincronizada! Score: ${currentData.today.score}% | VFC: ${currentData.today.hrv || '--'}ms | FC: ${currentData.today.rhr || '--'}bpm`, 'success');
        } else {
          showToast(`Conectado con PIN "${athleteKey}". Aún no hay mediciones de hoy en Supabase.`, 'info');
        }
      } catch (err) {
        showToast('Error al consultar la nube: ' + err.message, 'error');
      } finally {
        btnFetchCloud.innerHTML = '<span>🔄</span> Consultar y Organizar Datos de la Nube';
      }
    });
  }

  // 1-Click Pre-populated Telemetry Submission
  if (syncForm) {
    syncForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const sleepHours = parseFloat(document.getElementById('input-sleep')?.value) || 7.8;
      const hrvVal = parseFloat(document.getElementById('input-hrv')?.value) || 64;
      const rhrVal = parseFloat(document.getElementById('input-rhr')?.value) || 52;
      const deepVal = parseFloat(document.getElementById('input-deep')?.value) || 1.6;
      const remVal = parseFloat(document.getElementById('input-rem')?.value) || 1.9;

      submitBtn.textContent = 'Organizando telemetría...';
      submitBtn.disabled = true;

      try {
        const todayStr = getLocalDateString();
        const curToday = window.currentDashboardData?.today;
        const evalRes = evaluateDailyPillars(
          sleepHours, hrvVal, rhrVal,
          curToday?.base_hrv || 45.0,
          curToday?.base_rhr || 74.0,
          curToday?.base_sleep || 6.5
        );
        const athleteKey = getAthleteKey() || 'atleta_privado';

        const payload = {
          recorded_date: todayStr,
          sleep_hours: sleepHours,
          deep_sleep_hours: deepVal,
          rem_sleep_hours: remVal,
          resting_hr: rhrVal,
          hrv_ms: hrvVal,
          recovery_score: evalRes.score,
          gemini_verdict: `Recuperación ${evalRes.score}%. Sistema ${evalRes.trafficLight === 'GREEN' ? 'óptimo' : 'con fatiga'}.`,
          athlete_id: athleteKey,
          is_demo: false
        };

        const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/daily_recovery?on_conflict=recorded_date`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation',
            'x-athlete-token': athleteKey
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Error al guardar en Supabase: " + res.status);

        // Ensure athlete key is set in localStorage if previously empty
        if (!getAthleteKey()) {
          localStorage.setItem('BIOCOACH_ATHLETE_KEY', athleteKey);
          updateSecretDotUI();
        }

        closeModal();
        await initDashboard();
        showToast(`¡Telemetría guardada en Supabase! Score: ${evalRes.score}% | Sueño: ${sleepHours}h | VFC: ${hrvVal}ms`, 'success');
      } catch (err) {
        showToast('Error al sincronizar: ' + err.message, 'error');
      } finally {
        submitBtn.textContent = '✅ Organizar y Confirmar Telemetría (1-Clic)';
        submitBtn.disabled = false;
      }
    });
  }
}

// 14. Apple Shortcuts & Automation Recipe Modal (Apple Intelligence & Manual Tabs)
function initShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  const btnOpen = document.getElementById('btn-open-shortcuts');
  const btnClose = document.getElementById('btn-close-shortcuts-modal');
  const btnCopyToken = document.getElementById('btn-copy-athlete-token');

  const tabAi = document.getElementById('shortcuts-tab-ai');
  const tabManual = document.getElementById('shortcuts-tab-manual');
  const panelAi = document.getElementById('shortcuts-panel-ai');
  const panelManual = document.getElementById('shortcuts-panel-manual');

  function syncShortcutsPromptsWithActivePin() {
    const currentPin = getAthleteKey() || 'atleta_privado';
    const badge = document.getElementById('shortcuts-pin-badge');
    const aiBadge = document.getElementById('ai-active-pin-badge');

    if (badge) badge.textContent = currentPin;
    if (aiBadge) aiBadge.textContent = currentPin;

    // Dynamically replace {PIN} in all prompt pre blocks
    ['prompt-text-baseline', 'prompt-text-recovery', 'prompt-text-workout', 'prompt-text-hr', 'prompt-text-meal'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.template) {
        el.dataset.template = el.textContent;
      }
      if (el && el.dataset.template) {
        el.textContent = el.dataset.template.replace(/\{PIN\}/g, currentPin);
      }
    });
  }

  // Dual Tab Switching
  if (tabAi && tabManual) {
    tabAi.addEventListener('click', () => {
      tabAi.className = 'flex-1 py-2 rounded-xl text-xs font-black text-cyan-400 bg-cyan-500/10 transition-all flex items-center justify-center gap-1.5';
      tabManual.className = 'flex-1 py-2 rounded-xl text-xs font-black text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
      if (panelAi) panelAi.classList.remove('hidden');
      if (panelManual) panelManual.classList.add('hidden');
    });

    tabManual.addEventListener('click', () => {
      tabManual.className = 'flex-1 py-2 rounded-xl text-xs font-black text-cyan-400 bg-cyan-500/10 transition-all flex items-center justify-center gap-1.5';
      tabAi.className = 'flex-1 py-2 rounded-xl text-xs font-black text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
      if (panelManual) panelManual.classList.remove('hidden');
      if (panelAi) panelAi.classList.add('hidden');
    });
  }

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => {
      syncShortcutsPromptsWithActivePin();
      modal.classList.remove('hidden');
    });
  }

  if (btnClose && modal) {
    btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  }

  // 1-Click Prompt Copiers for Apple Intelligence & Siri
  document.querySelectorAll('.btn-copy-prompt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const currentPin = getAthleteKey() || 'atleta_privado';
        const textToCopy = targetEl.textContent.replace(/\{PIN\}/g, currentPin);
        await navigator.clipboard.writeText(textToCopy);
        const orig = btn.textContent;
        btn.textContent = '¡Copiado!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    });
  });

  // Copy helper for URLs and API keys
  document.querySelectorAll('.btn-copy-helper').forEach(btn => {
    btn.addEventListener('click', async () => {
      const textToCopy = btn.getAttribute('data-copy');
      if (textToCopy) {
        await navigator.clipboard.writeText(textToCopy);
        const orig = btn.textContent;
        btn.textContent = '¡Copiado!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    });
  });

  // Copy athlete token
  if (btnCopyToken) {
    btnCopyToken.addEventListener('click', async () => {
      const token = getAthleteKey() || 'atleta_privado';
      await navigator.clipboard.writeText(token);
      const orig = btnCopyToken.textContent;
      btnCopyToken.textContent = '¡Copiado!';
      setTimeout(() => { btnCopyToken.textContent = orig; }, 1500);
    });
  }

  // Initial sync on load
  syncShortcutsPromptsWithActivePin();
}
