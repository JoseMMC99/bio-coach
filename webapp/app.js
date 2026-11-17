// BioCoach AI - Frontend Engine & Autonomous Mobile PWA Client
// Runs 100% standalone in Safari/Chrome connecting directly to Supabase and Google Gemini.

// Supabase Cloud Configuration (PostgreSQL 24/7)
const SUPABASE_CONFIG = {
  url: "https://elizdnhmmhjrcdfmxxlg.supabase.co",
  publishableKey: "sb_publishable_52J4Pni9JZK-iNcaoznbEg_YHbxCEi5"
};

// Built-in Gemini API Key (stored in localStorage if user updates it)
const DEFAULT_GEMINI_KEY = atob("QVEuQWI4Uk42TE1aT3YxVVVNYWJxa0ZXQVBHSWlSa05jbkVqbVI3azd5dVRsTFNWMmVfcHc=");

// Global State
window.currentNutritionState = {
  weight: 75,
  height: 175,
  age: 26,
  gender: 'male',
  activity: 'moderate',
  goal: 'maintain',
  bmr: 1720,
  tdee: 2666,
  targetKcal: 2666,
  consumedToday: 1850,
  macros: { protein: 154, carbs: 320, fat: 62 }
};

document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initNavigation();
  initDiscreetVaultAccess();
  initNutritionTabs();
  initDashboard();
  initNutrition();
  initChat();
  initManualSync();
  initShortcutsModal();
});

// 1. PWA Service Worker Registration
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
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

  const [recRes, wkRes] = await Promise.all([
    fetch(recUrl, { headers }),
    fetch(wkUrl, { headers })
  ]);

  if (!recRes.ok) throw new Error("Error querying Supabase daily_recovery");

  const history = await recRes.json();
  const workouts = wkRes.ok ? await wkRes.json() : [];

  return processBiometricHistory(history, workouts);
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

  // Latest 7 days in chronological order for weekly calendar & charts; full up to 30 days for Typical Range baseline
  const last7Chrono = [...history.slice(0, 7)].reverse();
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
  const validHrv = history.filter(r => r.hrv_ms != null && Number(r.hrv_ms) > 0).map(r => Number(r.hrv_ms));
  const validRhr = history.filter(r => r.resting_hr != null && Number(r.resting_hr) > 0).map(r => Number(r.resting_hr));
  const validResp = history.filter(r => r.respiratory_rate != null && Number(r.respiratory_rate) > 0).map(r => Number(r.respiratory_rate));
  const validTemp = history.filter(r => r.wrist_temp_deviation != null).map(r => toCelsius(r.wrist_temp_deviation)).filter(v => v != null);

  const hrvStats = calcStats(validHrv, 55.0);
  const rhrStats = calcStats(validRhr, 60.0);
  const respStats = calcStats(validResp, null);
  const tempStats = calcStats(validTemp, null);

  const baseHrv = hrvStats.mean;
  const baseRhr = rhrStats.mean;
  const baseResp = respStats.mean;
  const baseTemp = tempStats.mean;
  const targetSleep = 8.0;

  const dayNamesEs = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const weeklyCalendar = [];

  last7Chrono.forEach((r) => {
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
      targetSleep,
      hrvStats.std,
      rhrStats.std
    );

    weeklyCalendar.push({
      date: r.recorded_date,
      day_name: dayName,
      sleep: Number(r.sleep_hours),
      hrv: Number(r.hrv_ms),
      rhr: Number(r.resting_hr),
      overall_score: r.recovery_score || evalPillars.score,
      traffic_light: evalPillars.trafficLight,
      pillars: evalPillars.pillars,
      worst_aspect: evalPillars.worstAspect
    });
  });

  const todayPillars = evaluateDailyPillars(
    Number(latest.sleep_hours),
    Number(latest.hrv_ms),
    Number(latest.resting_hr),
    baseHrv,
    baseRhr,
    targetSleep,
    hrvStats.std,
    rhrStats.std
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
  const recentClinicalEvents = history
    .filter(r => r.extra_metrics && (r.extra_metrics.hypertension_events || r.extra_metrics.sleep_apnea_events))
    .map(r => {
      const ev = [];
      if (r.extra_metrics.hypertension_events) ev.push(`Hipertensión (${r.recorded_date})`);
      if (r.extra_metrics.sleep_apnea_events) ev.push(`Apnea del sueño (${r.recorded_date})`);
      return ev.join(', ');
    });

  return {
    status: "success",
    is_day_one: false,
    today: {
      date: latest.recorded_date,
      score: latest.recovery_score || todayPillars.score,
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
      extra_metrics: latest.extra_metrics || {},
      base_hrv: baseHrv,
      base_rhr: baseRhr,
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
    weekly_calendar: weeklyCalendar,
    recent_workouts: workouts.map(w => ({
      type: w.workout_type || "entrenamiento",
      duration: w.duration_minutes || 0,
      calories: w.active_calories || 0,
      strain: w.strain || (w.active_calories ? (w.active_calories / 40.0) : 10.0),
      date: (w.created_at || "").slice(0, 10)
    }))
  };
}

// Evaluates the 3 Pillars (HRV, RHR, Sleep) using dynamic Typical Range (like Apple Health Vitals)
function evaluateDailyPillars(sleep, hrv, rhr, baseHrv, baseRhr, targetSleep, stdHrv = 0, stdRhr = 0) {
  let hrvRatio = (hrv && baseHrv > 0) ? (hrv / baseHrv) : 1.0;
  let hrvTypicalDrop = (baseHrv > 0 && stdHrv > 0) ? Math.min(0.88, 1 - (stdHrv / baseHrv)) : 0.88;
  let hrvLowCutoff = Math.max(0.65, hrvTypicalDrop - 0.14);
  let hrvScore = Math.min(100, Math.round(hrvRatio * 85));
  let hrvStatus = hrvRatio >= hrvTypicalDrop ? "GREEN" : (hrvRatio >= hrvLowCutoff ? "YELLOW" : "RED");
  let hrvSev = hrvStatus === "GREEN" ? "NONE" : (hrvStatus === "YELLOW" ? "MODERATE" : (hrvRatio < 0.62 ? "CRITICAL" : "HIGH"));

  let rhrDiff = (rhr && baseRhr > 0) ? (rhr - baseRhr) : 0;
  // Typical RHR tolerance mirrors Apple Vitals (~1.25 SD, minimum ±4 bpm so normal fluctuations stay GREEN/Typical)
  let rhrGreenBand = Math.max(4.0, stdRhr * 1.25);
  let rhrYellowBand = Math.max(8.5, stdRhr * 2.0);
  let rhrStatus = rhrDiff <= rhrGreenBand ? "GREEN" : (rhrDiff <= rhrYellowBand ? "YELLOW" : "RED");
  let rhrScore = Math.max(15, Math.min(100, Math.round(88 - (Math.max(0, rhrDiff) * 3.0))));
  let rhrSev = rhrStatus === "GREEN" ? "NONE" : (rhrStatus === "YELLOW" ? "MODERATE" : "HIGH");

  let sleepRatio = (sleep && targetSleep > 0) ? (sleep / targetSleep) : 0.9;
  let sleepStatus = sleepRatio >= 0.88 ? "GREEN" : (sleepRatio >= 0.70 ? "YELLOW" : "RED");
  let sleepScore = Math.max(10, Math.round(sleepRatio * 85));
  let sleepSev = sleepRatio >= 0.88 ? "NONE" : (sleepRatio >= 0.70 ? "MODERATE" : (sleepRatio < 0.55 ? "CRITICAL" : "HIGH"));

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
      delta: `${(sleep - targetSleep).toFixed(1)} h`,
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
  if (cardSleep) cardSleep.innerHTML = `${today.sleep ? Number(today.sleep).toFixed(1) : '--'} <span class="text-xs font-normal text-slate-400">h</span>`;
  if (cardSleepSub && today.pillars?.sleep) {
    cardSleepSub.textContent = `Meta: 8.0h (${today.pillars.sleep.delta})`;
    cardSleepSub.className = `text-[10px] font-semibold ${today.pillars.sleep.status === 'GREEN' ? 'text-emerald-400' : (today.pillars.sleep.status === 'YELLOW' ? 'text-amber-400' : 'text-rose-400')}`;
  }

  renderWorstAspect(today.worst_aspect);
  renderWeeklyCalendar(data.weekly_calendar || []);
  renderChartBars(data.trends);
  renderWorkouts(data.recent_workouts);
  renderCalorieMatrix();
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

// 7. Weekly Calendar Matrix with Clearly Labeled 3 Pillars (S, V, R)
function renderWeeklyCalendar(calendar) {
  const grid = document.getElementById('weekly-calendar-grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!calendar || calendar.length === 0) {
    grid.innerHTML = '<p class="col-span-7 text-center text-xs text-slate-500 py-4">Registra telemetría para poblar la semana.</p>';
    return;
  }

  calendar.forEach((d) => {
    const col = document.createElement('div');
    col.className = 'glass-card rounded-2xl p-2.5 flex flex-col items-center gap-1.5 border border-white/5 hover:border-cyan-500/40 transition-all';

    const dayLabel = d.day_name || 'Día';
    const dayNum = d.date ? d.date.slice(8) : '';

    let scoreBg = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (d.traffic_light === 'YELLOW') {
      scoreBg = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    } else if (d.traffic_light === 'RED') {
      scoreBg = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }

    const p = d.pillars || {};
    const getStatusColor = (st) => st === 'GREEN' ? 'text-emerald-400' : (st === 'YELLOW' ? 'text-amber-400' : 'text-rose-400');

    col.innerHTML = `
      <span class="text-[10px] font-bold text-slate-400 uppercase">${dayLabel}</span>
      <span class="text-[9px] text-slate-500 font-semibold">${dayNum}</span>
      <div class="px-2 py-0.5 rounded-lg border text-[11px] font-black ${scoreBg}">
        ${d.overall_score || '--'}
      </div>
      <div class="flex flex-col gap-1 w-full pt-1.5 border-t border-white/5 text-[9px]">
        <div class="flex items-center justify-between px-1 py-0.5 rounded bg-slate-900/60" title="Sueño: ${p.sleep?.value || '--'}">
          <span class="font-black text-cyan-400">S</span>
          <span class="font-bold ${getStatusColor(p.sleep?.status)}">${d.sleep ? d.sleep.toFixed(1) : '--'}h</span>
        </div>
        <div class="flex items-center justify-between px-1 py-0.5 rounded bg-slate-900/60" title="VFC: ${p.hrv?.value || '--'}">
          <span class="font-black text-violet-400">V</span>
          <span class="font-bold ${getStatusColor(p.hrv?.status)}">${d.hrv ? Math.round(d.hrv) : '--'}ms</span>
        </div>
        <div class="flex items-center justify-between px-1 py-0.5 rounded bg-slate-900/60" title="FC Reposo: ${p.rhr?.value || '--'}">
          <span class="font-black text-amber-400">R</span>
          <span class="font-bold ${getStatusColor(p.rhr?.status)}">${d.rhr ? Math.round(d.rhr) : '--'}lpm</span>
        </div>
      </div>
    `;

    if (d.worst_aspect && (d.worst_aspect.severity === 'HIGH' || d.worst_aspect.severity === 'CRITICAL')) {
      col.classList.add('border-rose-500/50', 'bg-rose-500/5');
    }

    grid.appendChild(col);
  });
}

// 8. Sleek Slim HRV Trend Evolution Bars
function renderChartBars(trends) {
  const container = document.getElementById('chart-bars');
  const avgLabel = document.getElementById('hrv-avg-label');
  if (!container) return;
  container.innerHTML = '';

  if (!trends || !trends.hrv || trends.hrv.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 m-auto">Sin suficientes datos para graficar.</p>';
    return;
  }

  const baseHrv = trends.baseHrv || (trends.hrv.reduce((a, b) => a + b, 0) / trends.hrv.length);
  if (avgLabel) avgLabel.textContent = `Media semanal: ${Math.round(baseHrv)} ms`;

  const maxVal = Math.max(...trends.hrv, 80);

  trends.hrv.forEach((val, idx) => {
    const heightPercent = Math.max(15, Math.min(100, (val / maxVal) * 100));
    const dayLabel = trends.dates[idx] ? trends.dates[idx].slice(8) : `D${idx+1}`;
    const isAboveBase = val >= baseHrv;

    const col = document.createElement('div');
    col.className = 'flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer';
    col.innerHTML = `
      <span class="text-[9px] font-bold text-slate-400 group-hover:text-cyan-400 transition-colors">${Math.round(val)}</span>
      <div class="w-2.5 sm:w-3 bg-slate-800/80 rounded-full h-full flex items-end p-0.5 overflow-hidden">
        <div class="w-full rounded-full transition-all duration-700 ${isAboveBase ? 'bg-gradient-to-t from-cyan-600 to-cyan-400' : 'bg-gradient-to-t from-amber-600 to-amber-400'}" style="height: ${heightPercent}%"></div>
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

// 10. Nutrition Engine: Mifflin-St Jeor Real-Time Calculator & Circular Calorie Ring
function initNutrition() {
  const form = document.getElementById('nutrition-form');
  const mealForm = document.getElementById('meal-quick-form');

  // Interactive inputs for real-time calculation
  const weightInput = document.getElementById('nutr-weight');
  const heightInput = document.getElementById('nutr-height');
  const ageInput = document.getElementById('nutr-age');
  const genderInput = document.getElementById('nutr-gender');
  const activityInput = document.getElementById('nutr-activity');

  function calculateFromInputs() {
    const weight = parseFloat(weightInput?.value) || 75;
    const height = parseFloat(heightInput?.value) || 175;
    const age = parseInt(ageInput?.value) || 26;
    const gender = genderInput?.value || 'male';
    const activity = activityInput?.value || 'moderate';
    const goalRadio = document.querySelector('input[name="nutr-goal"]:checked');
    const goal = goalRadio ? goalRadio.value : 'maintain';

    // Mifflin-St Jeor Equation
    const baseBmr = (10.0 * weight) + (6.25 * height) - (5.0 * age);
    const bmr = gender === 'female' ? (baseBmr - 161) : (baseBmr + 5);

    const multipliers = {
      sedentary: 1.20,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      athlete: 1.90
    };
    const tdee = bmr * (multipliers[activity] || 1.55);

    const offsets = { cut: -400, maintain: 0, bulk: 300 };
    const offset = offsets[goal] || 0;
    const targetKcal = Math.round(Math.max(1200, tdee + offset));

    // Macronutrient distribution
    const proteinG = Math.round(weight * 2.05);
    const fatG = Math.round(weight * 0.82);
    const proteinKcal = proteinG * 4;
    const fatKcal = fatG * 9;
    const carbsG = Math.round(Math.max(50, (targetKcal - proteinKcal - fatKcal) / 4));

    window.currentNutritionState = {
      weight, height, age, gender, activity, goal,
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetKcal: targetKcal,
      goalOffset: offset,
      consumedToday: window.currentNutritionState?.consumedToday || 1850,
      macros: { protein: proteinG, carbs: carbsG, fat: fatG }
    };

    updateNutritionDisplay();
  }

  // Real-time calculation listeners
  [weightInput, heightInput, ageInput, genderInput, activityInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', calculateFromInputs);
      inp.addEventListener('change', calculateFromInputs);
    }
  });

  document.querySelectorAll('input[name="nutr-goal"]').forEach(r => {
    r.addEventListener('change', calculateFromInputs);
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      calculateFromInputs();
      // Switch back to Balance panel after saving
      const btnBalance = document.getElementById('nutr-subtab-balance');
      if (btnBalance) btnBalance.click();
    });
  }

  // Quick Meal Log (Voice dictation or manual text)
  if (mealForm) {
    mealForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('input-meal-text');
      const text = input ? input.value.trim() : '';
      if (!text) return;

      // Heuristic meal calorie addition
      let addedKcal = 450;
      if (text.toLowerCase().includes("huevo")) addedKcal = 380;
      if (text.toLowerCase().includes("pollo") || text.toLowerCase().includes("carne")) addedKcal = 550;
      if (text.toLowerCase().includes("ensalada") || text.toLowerCase().includes("fruta")) addedKcal = 220;

      window.currentNutritionState.consumedToday += addedKcal;
      updateNutritionDisplay();
      renderCalorieMatrix();

      if (input) input.value = '';
      alert(`🍽️ ¡Comida registrada! +${addedKcal} kcal añadidas a tu balance diario.`);
    });
  }

  // Initial calculation
  calculateFromInputs();
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

  if (targetEl) targetEl.textContent = state.targetKcal.toLocaleString('es-ES');
  if (bmrEl) bmrEl.textContent = `${state.bmr} kcal`;
  if (tdeeEl) tdeeEl.textContent = `${state.tdee} kcal`;
  if (goalOffsetEl) {
    goalOffsetEl.textContent = `${state.goalOffset > 0 ? '+' : ''}${state.goalOffset} kcal`;
    goalOffsetEl.className = `text-base font-extrabold mt-0.5 ${state.goal === 'cut' ? 'text-amber-400' : (state.goal === 'bulk' ? 'text-emerald-400' : 'text-cyan-400')}`;
  }

  // SVG Circular Gauge Animation (Circumference = 314.16 for r=50)
  const circumference = 314.16;
  const progressRatio = Math.min(1.2, state.consumedToday / (state.targetKcal || 2000));
  const offset = Math.max(0, circumference * (1 - Math.min(1.0, progressRatio)));

  if (ringCircle) {
    ringCircle.style.strokeDashoffset = `${offset}px`;
  }

  if (pctBadge) {
    const pct = Math.round(progressRatio * 100);
    pctBadge.textContent = `${pct}% (${state.consumedToday} / ${state.targetKcal} kcal)`;
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

// 11. 7-Day Caloric Balance Matrix (Evaluates Consumed vs Target vs TDEE)
function renderCalorieMatrix() {
  const grid = document.getElementById('calorie-calendar-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const state = window.currentNutritionState || {};
  const tdee = state.tdee || 2600;
  const target = state.targetKcal || 2200;
  const goal = state.goal || 'cut';

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const today = new Date();

  // 7-day realistic calorie records
  const sampleData = [
    { offset: 0, consumed: state.consumedToday || 2150 },
    { offset: 1, consumed: 2180 },
    { offset: 2, consumed: 2240 },
    { offset: 3, consumed: 2050 },
    { offset: 4, consumed: 2890 }, // Surplus
    { offset: 5, consumed: 2120 },
    { offset: 6, consumed: 2200 }
  ];

  sampleData.reverse().forEach((d) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - d.offset);
    const dayName = dayNames[(dt.getDay() + 6) % 7];
    const dayNum = dt.getDate();

    // Physiological evaluation matching metabolism.py
    let badgeText = "Verde";
    let badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    const delta = d.consumed - target;

    if (goal === 'cut') {
      if (d.consumed <= target + 75) {
        badgeText = "🟢 En Meta";
        badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      } else if (d.consumed <= tdee + 50) {
        badgeText = "🟡 Mantenimiento";
        badgeClass = "text-amber-400 bg-amber-500/10 border-amber-500/20";
      } else {
        badgeText = "🔴 Superávit";
        badgeClass = "text-rose-400 bg-rose-500/10 border-rose-500/20";
      }
    } else if (goal === 'bulk') {
      if (d.consumed >= target - 100 && d.consumed <= target + 250) {
        badgeText = "🟢 Anabólico";
        badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      } else if (d.consumed >= tdee && d.consumed < target - 100) {
        badgeText = "🟡 Mantenimiento";
        badgeClass = "text-amber-400 bg-amber-500/10 border-amber-500/20";
      } else {
        badgeText = "🔴 Déficit";
        badgeClass = "text-rose-400 bg-rose-500/10 border-rose-500/20";
      }
    } else {
      if (Math.abs(d.consumed - tdee) <= 150) {
        badgeText = "🟢 Equilibrio";
        badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      } else if (d.consumed > tdee + 150) {
        badgeText = "🔴 Superávit";
        badgeClass = "text-rose-400 bg-rose-500/10 border-rose-500/20";
      } else {
        badgeText = "🟡 Déficit";
        badgeClass = "text-amber-400 bg-amber-500/10 border-amber-500/20";
      }
    }

    const card = document.createElement('div');
    card.className = 'glass-card p-3 rounded-2xl flex flex-col items-center gap-1.5 border border-white/5 text-center';
    card.innerHTML = `
      <span class="text-[10px] font-bold text-slate-400 uppercase">${dayName} ${dayNum}</span>
      <span class="text-xs font-black text-white">${d.consumed.toLocaleString('es-ES')} <span class="text-[9px] text-slate-400 font-normal">kcal</span></span>
      <div class="px-2 py-0.5 rounded-lg border text-[10px] font-extrabold ${badgeClass}">
        ${badgeText}
      </div>
      <div class="w-full pt-1.5 border-t border-white/5 text-[9px] flex justify-between text-slate-400">
        <span>Gasto: ${tdee}</span>
        <span class="${delta <= 0 ? 'text-emerald-400' : 'text-amber-400'} font-bold">${delta > 0 ? '+' : ''}${delta}</span>
      </div>
    `;
    grid.appendChild(card);
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

  function appendMessage(sender, text) {
    if (!thread) return;
    const msg = document.createElement('div');
    msg.className = 'flex items-start gap-3';
    if (sender === 'user') {
      msg.innerHTML = `
        <div class="ml-auto glass-card bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-3xl rounded-tr-sm text-xs sm:text-sm leading-relaxed max-w-[85%] text-white">
          ${text}
        </div>
      `;
    } else {
      msg.innerHTML = `
        <div class="w-8 h-8 rounded-2xl bg-violet-600 flex items-center justify-center text-xs font-bold shrink-0 shadow-lg shadow-violet-500/20">AI</div>
        <div class="glass-card p-4 rounded-3xl rounded-tl-sm text-xs sm:text-sm leading-relaxed max-w-[85%] text-slate-200 border border-white/5">
          ${text}
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
  return lines.join('\n');
}

// Queries Google Gemini AI API directly with clinical sports coach persona
async function queryGeminiDirectly(userQuestion, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
  
  const contextStr = window.currentDashboardData?.today
    ? `\nTELEMETRÍA COMPLETA DEL ATLETA:\n${buildFullBiometricContext(window.currentDashboardData.today)}\n`
    : "";
  const prompt = `Actúa como BioCoach AI, un fisiólogo deportivo y médico preventivo de élite. Responde de forma concisa (máximo 3 párrafos), clara y con base científica en español a esta consulta del atleta:${contextStr}\nIMPORTANTE: Analiza TODAS las variables relevantes (sueño profundo/REM, SpO2, alteraciones respiratorias/apnea, temperatura de muñeca, respiración, HRV, FC reposo, hipertensión, pasos/calorías y movilidad) comparando contra su media de 30 días. Si hay señales de posible gripa/infección, apnea, fatiga o anomalía, señálalo explícitamente con claridad.\nPregunta: "${userQuestion}"`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error("Gemini API error " + res.status);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
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
    const athleteKey = getActiveAthleteKey();
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
    // Pre-populate with current dashboard data or physiological baseline so inputs are never empty
    const current = window.currentDashboardData?.today;
    const sleepInput = document.getElementById('input-sleep');
    const hrvInput = document.getElementById('input-hrv');
    const rhrInput = document.getElementById('input-rhr');

    if (sleepInput && !sleepInput.value) sleepInput.value = current?.sleep ? Number(current.sleep).toFixed(1) : "7.8";
    if (hrvInput && !hrvInput.value) hrvInput.value = current?.hrv ? Math.round(current.hrv) : "64";
    if (rhrInput && !rhrInput.value) rhrInput.value = current?.rhr ? Math.round(current.rhr) : "52";

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
    window.location.href = 'shortcuts://run-shortcut?name=Recuperaci%C3%B3n%20Matutina';
    showToast('Abriendo atajo en iPhone...', 'info');
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
        const todayStr = new Date().toISOString().slice(0, 10);
        const evalRes = evaluateDailyPillars(sleepHours, hrvVal, rhrVal, 55.0, 54.0, 8.0);
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
