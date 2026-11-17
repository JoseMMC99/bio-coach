// BioCoach AI - Frontend Engine & Autonomous Mobile PWA Client
// Runs 100% standalone in Safari/Chrome connecting directly to Supabase and Google Gemini.

// Supabase Cloud Configuration (PostgreSQL 24/7)
const SUPABASE_CONFIG = {
  url: "https://elizdnhmmhjrcdfmxxlg.supabase.co",
  publishableKey: "sb_publishable_52J4Pni9JZK-iNcaoznbEg_YHbxCEi5"
};

// Built-in Gemini API Key (stored in localStorage if user updates it)
const DEFAULT_GEMINI_KEY = atob("QVEuQWI4Uk42TE1aT3YxVVVNYWJxa0ZXQVBHSWlSa05jbkVqbVI3azd5dVRsTFNWMmVfcHc=");

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
    navigator.serviceWorker.register('./sw.js').catch(() => {});
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
    [viewDashboard, viewNutrition, viewChat].forEach((v) => v && v.classList.add('hidden'));
    if (activeView) activeView.classList.remove('hidden');

    [btnDashboard, btnNutrition, btnChat].forEach((b) => {
      if (b) b.className = 'flex flex-col items-center gap-1 text-slate-400 hover:text-white py-1 px-4 transition-colors';
    });

    if (activeBtn === btnDashboard && activeBtn) {
      activeBtn.className = 'flex flex-col items-center gap-1 text-emerald-400 py-1 px-4 transition-colors';
    } else if (activeBtn === btnNutrition && activeBtn) {
      activeBtn.className = 'flex flex-col items-center gap-1 text-teal-300 py-1 px-4 transition-colors';
    } else if (activeBtn) {
      activeBtn.className = 'flex flex-col items-center gap-1 text-indigo-400 py-1 px-4 transition-colors';
    }
  }

  if (btnDashboard) btnDashboard.addEventListener('click', () => setActiveTab(btnDashboard, viewDashboard));
  if (btnNutrition) {
    btnNutrition.addEventListener('click', () => {
      setActiveTab(btnNutrition, viewNutrition);
      if (document.getElementById('nutr-target-kcal')?.textContent === '--') {
        document.getElementById('nutrition-form')?.dispatchEvent(new Event('submit'));
      }
    });
  }
  if (btnChat) btnChat.addEventListener('click', () => setActiveTab(btnChat, viewChat));
}

// 3. Main Dashboard Telemetry Loader
// Tries local backend first; if unavailable (running as hosted webapp), talks directly to Supabase PostgREST
async function initDashboard() {
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  let data = null;

  // Try direct Supabase fetch first (100% cloud autonomous mode)
  try {
    data = await fetchDirectFromSupabase();
  } catch (supabaseErr) {
    // Fallback to local gateway if available
    try {
      const res = await fetch('/api/v1/dashboard');
      if (res.ok) data = await res.json();
    } catch (localErr) {
      console.warn("Could not connect to Supabase or local API", supabaseErr);
    }
  }

  if (data) {
    renderDashboard(data);
  } else {
    const heroStatus = document.getElementById('hero-status-text');
    if (heroStatus) heroStatus.textContent = 'Modo sin conexión o primer inicio';
  }
}

// Direct Supabase PostgREST Data Aggregator
async function fetchDirectFromSupabase() {
  const headers = {
    'apikey': SUPABASE_CONFIG.publishableKey,
    'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`
  };

  const [recRes, wkRes] = await Promise.all([
    fetch(`${SUPABASE_CONFIG.url}/rest/v1/daily_recovery?order=recorded_date.desc&limit=7`, { headers }),
    fetch(`${SUPABASE_CONFIG.url}/rest/v1/workouts?order=created_at.desc&limit=5`, { headers })
  ]);

  if (!recRes.ok) throw new Error("Error querying Supabase daily_recovery");

  const history = await recRes.json();
  const workouts = wkRes.ok ? await wkRes.json() : [];

  return processBiometricHistory(history, workouts);
}

// Client-Side Physiological Modeler (Replicates Python physiology engine)
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

  // Chronological order for trend line charts
  const chronological = [...history].reverse();
  const latest = history[0];

  // Calculate 7-day rolling baseline
  const validHrv = history.filter(r => r.hrv_ms != null).map(r => Number(r.hrv_ms));
  const validRhr = history.filter(r => r.resting_hr != null).map(r => Number(r.resting_hr));
  const baseHrv = validHrv.length > 0 ? (validHrv.reduce((a, b) => a + b, 0) / validHrv.length) : 55.0;
  const baseRhr = validRhr.length > 0 ? (validRhr.reduce((a, b) => a + b, 0) / validRhr.length) : 54.0;
  const targetSleep = 8.0;

  const dayNamesEs = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const weeklyCalendar = [];

  chronological.forEach((r) => {
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
      targetSleep
    );

    weeklyCalendar.push({
      date: r.recorded_date,
      day_name: dayName,
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
    targetSleep
  );

  return {
    status: "success",
    is_day_one: false,
    today: {
      date: latest.recorded_date,
      score: latest.recovery_score || todayPillars.score,
      traffic_light: todayPillars.trafficLight,
      hrv: latest.hrv_ms,
      rhr: latest.resting_hr,
      sleep: latest.sleep_hours,
      verdict: latest.gemini_verdict || "Telemetría registrada y analizada.",
      pillars: todayPillars.pillars,
      worst_aspect: todayPillars.worstAspect
    },
    trends: {
      dates: chronological.map(r => r.recorded_date),
      hrv: chronological.map(r => Number(r.hrv_ms || 0)),
      rhr: chronological.map(r => Number(r.resting_hr || 0)),
      sleep: chronological.map(r => Number(r.sleep_hours || 0))
    },
    weekly_calendar: weeklyCalendar,
    recent_workouts: workouts.map(w => ({
      type: w.workout_type || "entrenamiento",
      duration: w.duration_minutes || 0,
      calories: w.active_calories || 0,
      strain: w.active_calories ? (w.active_calories / 40.0) : 10.0,
      date: (w.created_at || "").slice(0, 10)
    }))
  };
}

// Evaluates the 3 Pillars (HRV, RHR, Sleep) and Identifies Primary Bottleneck
function evaluateDailyPillars(sleep, hrv, rhr, baseHrv, baseRhr, targetSleep) {
  let hrvRatio = (hrv && baseHrv > 0) ? (hrv / baseHrv) : 1.0;
  let hrvScore = Math.min(100, Math.round(hrvRatio * 85));
  let hrvStatus = hrvRatio >= 0.95 ? "GREEN" : (hrvRatio >= 0.78 ? "YELLOW" : "RED");
  let hrvSev = hrvRatio >= 0.95 ? "NONE" : (hrvRatio >= 0.78 ? "MODERATE" : (hrvRatio < 0.65 ? "CRITICAL" : "HIGH"));

  let rhrDiff = (rhr && baseRhr > 0) ? (rhr - baseRhr) : 0;
  let rhrStatus = rhrDiff <= 2 ? "GREEN" : (rhrDiff <= 6 ? "YELLOW" : "RED");
  let rhrScore = Math.max(15, Math.round(85 - (rhrDiff * 4)));
  let rhrSev = rhrDiff <= 2 ? "NONE" : (rhrDiff <= 6 ? "MODERATE" : "HIGH");

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

// 4. Render Visual Telemetry on Screen
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

  document.getElementById('card-hrv').innerHTML = `${today.hrv ? Math.round(today.hrv) : '--'} <span class="text-xs font-normal text-slate-400">ms</span>`;
  document.getElementById('card-rhr').innerHTML = `${today.rhr ? Math.round(today.rhr) : '--'} <span class="text-xs font-normal text-slate-400">bpm</span>`;
  document.getElementById('card-sleep').innerHTML = `${today.sleep ? Number(today.sleep).toFixed(1) : '--'} <span class="text-xs font-normal text-slate-400">h</span>`;

  renderDailyBalance(score, data.recent_workouts);
  renderWorstAspect(today.worst_aspect);
  renderWeeklyCalendar(data.weekly_calendar || []);
  renderChartBars(data.trends);
  renderWorkouts(data.recent_workouts);
}

// 5. Daily Progress / Strain Balance Bar
function renderDailyBalance(recoveryScore, recentWorkouts) {
  const bar = document.getElementById('daily-strain-progress');
  const capLabel = document.getElementById('balance-cap-val');
  const strainLabel = document.getElementById('balance-strain-val');
  const statusBadge = document.getElementById('daily-balance-status');

  if (!bar) return;

  capLabel.textContent = `${recoveryScore}%`;

  let todayStrain = 0;
  if (recentWorkouts && recentWorkouts.length > 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayW = recentWorkouts.find(w => w.date === todayStr);
    if (todayW) todayStrain = todayW.strain || 8.0;
  }

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

// 7. Weekly Calendar Matrix with 3 Health Pillars
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

    const dayLabel = d.day_name || 'Día';
    const dayNum = d.date ? d.date.slice(8) : '';

    let scoreBg = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (d.traffic_light === 'YELLOW') {
      scoreBg = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    } else if (d.traffic_light === 'RED') {
      scoreBg = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }

    const p = d.pillars || {};
    const getDot = (st) => st === 'GREEN' ? '🟢' : (st === 'YELLOW' ? '🟡' : '🔴');

    col.innerHTML = `
      <span class="text-[10px] font-bold text-slate-400">${dayLabel}</span>
      <span class="text-[9px] text-slate-500 font-semibold">${dayNum}</span>
      <div class="px-1.5 py-0.5 rounded-md border text-[10px] font-extrabold ${scoreBg}">
        ${d.overall_score || '--'}
      </div>
      <div class="flex flex-col gap-1 w-full pt-1 border-t border-slate-700/50 text-[9px] text-center">
        <span title="HRV: ${p.hrv?.value || '--'}">${getDot(p.hrv?.status)}</span>
        <span title="FC Reposo: ${p.rhr?.value || '--'}">${getDot(p.rhr?.status)}</span>
        <span title="Sueño: ${p.sleep?.value || '--'}">${getDot(p.sleep?.status)}</span>
      </div>
    `;

    if (d.worst_aspect && (d.worst_aspect.severity === 'HIGH' || d.worst_aspect.severity === 'CRITICAL')) {
      col.classList.add('border-rose-500/50', 'bg-rose-500/5');
    }

    grid.appendChild(col);
  });
}

// 8. Evolution Bars (HRV Trends)
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

// 9. Workouts List
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

// 10. Nutrition & Metabolism Calculator (Mifflin-St Jeor Engine in JavaScript)
function initNutrition() {
  const form = document.getElementById('nutrition-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const weight = parseFloat(document.getElementById('nutr-weight').value) || 75;
    const height = parseFloat(document.getElementById('nutr-height').value) || 175;
    const age = parseInt(document.getElementById('nutr-age').value) || 26;
    const gender = document.getElementById('nutr-gender').value || 'male';
    const activity = document.getElementById('nutr-activity').value || 'moderate';
    const goalRadio = document.querySelector('input[name="nutr-goal"]:checked');
    const goal = goalRadio ? goalRadio.value : 'maintain';

    // Mifflin-St Jeor Formula
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

    const offsets = { cut: -400, maintain: 0, bulk: 350 };
    const offset = offsets[goal] || 0;
    const targetKcal = Math.round(Math.max(1200, tdee + offset));

    // Macronutrient distribution
    const proteinG = Math.round(weight * 2.05);
    const fatG = Math.round(weight * 0.82);
    const proteinKcal = proteinG * 4;
    const fatKcal = fatG * 9;
    const carbsG = Math.round(Math.max(50, (targetKcal - proteinKcal - fatKcal) / 4));

    renderNutritionResults({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      target_calories: targetKcal,
      goal: goal,
      goal_offset: offset,
      macros: { protein_g: proteinG, carbs_g: carbsG, fat_g: fatG },
      summary: `BMR: ${Math.round(bmr)} kcal | Gasto Total: ${Math.round(tdee)} kcal | Objetivo (${goal.toUpperCase()}): ${targetKcal} kcal/día (Proteína: ${proteinG}g, Carbos: ${carbsG}g, Grasas: ${fatG}g).`
    });
  });
}

function renderNutritionResults(data) {
  document.getElementById('nutr-target-kcal').textContent = data.target_calories;
  document.getElementById('nutr-bmr-val').textContent = `${data.bmr} kcal`;
  document.getElementById('nutr-tdee-val').textContent = `${data.tdee} kcal`;

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

  const m = data.macros;
  document.getElementById('nutr-protein-g').innerHTML = `${m.protein_g} <span class="text-xs font-normal">g</span>`;
  document.getElementById('nutr-protein-kcal').textContent = `${m.protein_g * 4} kcal`;

  document.getElementById('nutr-carbs-g').innerHTML = `${m.carbs_g} <span class="text-xs font-normal">g</span>`;
  document.getElementById('nutr-carbs-kcal').textContent = `${m.carbs_g * 4} kcal`;

  document.getElementById('nutr-fat-g').innerHTML = `${m.fat_g} <span class="text-xs font-normal">g</span>`;
  document.getElementById('nutr-fat-kcal').textContent = `${m.fat_g * 9} kcal`;

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

// 11. Conversational Coach Chat (Direct Gemini Flash AI with Clinical Context)
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

// Queries Google Gemini AI API directly with clinical sports coach persona
async function queryGeminiDirectly(userQuestion, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
  
  let contextStr = "";
  if (window.currentDashboardData && window.currentDashboardData.today) {
    const t = window.currentDashboardData.today;
    contextStr = ` Contexto actual del atleta hoy: Recuperación: ${t.recovery_score || '--'}%, Sueño: ${t.sleep_hours || '--'}h, HRV: ${t.hrv_ms || '--'}ms, FC Reposo: ${t.resting_hr || '--'} lpm.`;
  }
  const prompt = `Actúa como BioCoach AI, un fisiólogo deportivo y entrenador de rendimiento de élite. Responde de forma concisa (máximo 3 párrafos), motivadora y con base científica en español a esta consulta del atleta:${contextStr}\nPregunta: "${userQuestion}"`;

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

// 12. Manual Sleep Sync and Direct Supabase Ingestion
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

  const openModal = () => modal && modal.classList.remove('hidden');
  const closeModal = () => modal && modal.classList.add('hidden');

  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
  if (btnHeaderSync) btnHeaderSync.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelSync) btnCancelSync.addEventListener('click', closeModal);

  // Trigger 7-Day Demo Population Direct to Supabase
  if (btnLoadDemo) {
    btnLoadDemo.addEventListener('click', async () => {
      btnLoadDemo.textContent = 'Cargando datos en Supabase...';
      btnLoadDemo.disabled = true;

      try {
        await seedDemoDataDirectToSupabase();
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
        alert('Si estás en tu iPhone, el atajo se abrirá para leer tu Apple Watch.');
      }, 1000);
    });
  }

  if (syncForm) {
    syncForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const sleepHours = parseFloat(document.getElementById('input-sleep').value);
      const hrvVal = parseFloat(document.getElementById('input-hrv').value) || 60;
      const rhrVal = parseFloat(document.getElementById('input-rhr').value) || 54;
      const deepVal = parseFloat(document.getElementById('input-deep').value) || 1.5;
      const remVal = parseFloat(document.getElementById('input-rem').value) || 1.8;

      if (!sleepHours) return;

      submitBtn.textContent = 'Guardando en Supabase...';
      submitBtn.disabled = true;

      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const evalRes = evaluateDailyPillars(sleepHours, hrvVal, rhrVal, 55.0, 54.0, 8.0);

        const payload = {
          recorded_date: todayStr,
          sleep_hours: sleepHours,
          deep_sleep_hours: deepVal,
          rem_sleep_hours: remVal,
          resting_hr: rhrVal,
          hrv_ms: hrvVal,
          recovery_score: evalRes.score,
          gemini_verdict: `Recuperación ${evalRes.score}%. Sistema ${evalRes.trafficLight === 'GREEN' ? 'óptimo' : 'con fatiga'}.`
        };

        const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/daily_recovery`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Error al guardar en Supabase: " + res.status);

        closeModal();
        syncForm.reset();
        await initDashboard();
      } catch (err) {
        alert('Error al sincronizar: ' + err.message);
      } finally {
        submitBtn.textContent = 'Analizar y Sincronizar';
        submitBtn.disabled = false;
      }
    });
  }
}

// Direct Supabase Demo Seeder
async function seedDemoDataDirectToSupabase() {
  const headers = {
    'apikey': SUPABASE_CONFIG.publishableKey,
    'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
    'Content-Type': 'application/json'
  };

  const today = new Date();
  const demoDays = [
    { offset: 0, sleep: 7.8, hrv: 64, rhr: 52, score: 92, v: "🟢 Recuperación 92%. Sistema óptimo." },
    { offset: 1, sleep: 5.2, hrv: 24, rhr: 64, score: 42, v: "🔴 Recuperación 42%. HRV muy baja. Prioriza descanso." },
    { offset: 2, sleep: 6.8, hrv: 52, rhr: 56, score: 72, v: "🟡 Recuperación 72%. Nivel moderado." },
    { offset: 3, sleep: 8.4, hrv: 68, rhr: 50, score: 95, v: "🟢 Recuperación 95%. Descanso excepcional." },
    { offset: 4, sleep: 7.5, hrv: 60, rhr: 53, score: 86, v: "🟢 Recuperación 86%. Buen balance circadiano." },
    { offset: 5, sleep: 6.0, hrv: 46, rhr: 58, score: 64, v: "🟡 Recuperación 64%. Ligera sobrecarga." },
    { offset: 6, sleep: 7.2, hrv: 58, rhr: 54, score: 82, v: "🟢 Recuperación 82%. Rango estable." }
  ];

  for (const d of demoDays) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - d.offset);
    const dateStr = dt.toISOString().slice(0, 10);

    await fetch(`${SUPABASE_CONFIG.url}/rest/v1/daily_recovery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recorded_date: dateStr,
        sleep_hours: d.sleep,
        resting_hr: d.rhr,
        hrv_ms: d.hrv,
        recovery_score: d.score,
        gemini_verdict: d.v
      })
    });
  }
}

// 13. Apple Shortcuts 1-Click Downloader Modal
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
