# AGENTS.md — BioCoach AI Agent Guidelines & Operating Manual

> **Note for AI Agents & Developers:**  
> This file defines the mandatory engineering practices, behavioral rules, code conventions, and architectural boundaries for this repository. Any agent modifying or adding code to this project **MUST** follow these directives without deviation.

---

## 1. Project Overview & Core Philosophy

**BioCoach AI** is an automated, zero-cost personal health and athletic performance coaching system integrating Apple Watch / HealthKit telemetry, PostgreSQL (Supabase PostgREST), and Google Gemini AI.

- **Primary Goal:** Transform raw Apple Watch vitals into actionable, personalized physiological guidance on the watch and mobile webapp with **$0 cloud/subscription cost**.
- **Key Tenet:** All physiological scoring (Recovery 0–100, ANS dominance, Strain 0–21, Stress 0–100, Mifflin-St Jeor TDEE, 3 Pillars) is calculated **deterministically in Python first**. Gemini AI receives structured physiological facts rather than raw data to prevent biological hallucinations.

---

## 2. Language & Communication Policy

Strict separation of languages applies across the codebase:

| Scope | Required Language | Examples |
| :--- | :--- | :--- |
| **Code Comments & Docstrings** | **English (Strictly)** | `# Compute Karvonen Heart Rate Reserve`, `"""Calculates daily recovery score."""` |
| **Git Commits & PRs** | **English (Strictly)** | `feat(metabolism): add Mifflin-St Jeor BMR calculator` |
| **Technical Documentation** | **English (Strictly)** | `AGENTS.md`, architecture diagrams, code specs |
| **User-Facing UI & WebApp** | **Spanish (Strictly)** | Buttons, dashboard labels, modals, charts |
| **User Feedback & Notifications** | **Spanish (Strictly)** | Apple Watch alerts, Siri voice dictation feedback |
| **Gemini Prompts & LLM Outputs** | **Spanish (Strictly)** | Coach recommendations, clinical morning summaries |
| **Chat with the User** | **Spanish (Strictly)** | Agent conversational responses in chat |

---

## 3. Engineering Methodology: Test-Driven Development (TDD)

Every feature or bugfix **MUST** follow this strict TDD cycle:

```
[ Red Phase ]          [ Green Phase ]          [ Refactor & Verify ]
Write Unit Tests  --->  Implement Minimal Code --->  Run Full Regression Suite
(Must fail first)      (Make tests pass)            (Ensure 0 regressions)
```

### Mandatory Testing Rules:
1. **Never write implementation code before creating or updating the test suite.**
2. **Edge Cases & Defensiveness:**
   - Empty histories (Day 1 behavior).
   - Missing sensor metrics (e.g., watch didn't capture HRV during sleep).
   - Biological outliers (e.g., HRV > 250 ms, resting HR < 30 bpm clamped safely).
   - Regional formatting quirks (e.g., Spanish comma decimals like `"7,5"` from Apple Shortcuts).
   - Offline / network failure fallbacks for Gemini API.
3. **Regression Requirement:**
   - After **ANY** code modification, always execute:
     ```bash
     python -m unittest discover -s tests -v
     ```
   - Never commit code if any test fails or outputs an unhandled warning.

---

## 4. Git & Commit Protocol

1. **Granular Commits Only:** Never dump monolithic or multi-feature commits into the repository. Break tasks into logical, self-contained commits.
2. **Conventional Commits Specification:**
   - `feat(scope): ...` for new features or algorithmic enhancements.
   - `test(scope): ...` for new test cases and edge validations.
   - `fix(scope): ...` for bug and regression fixes.
   - `refactor(scope): ...` for structural cleanup without changing behavior.
   - `docs(scope): ...` for documentation and markdown guides.
3. **Zero Secrets in Git:**
   - **NEVER** commit `.env`, credentials, service keys, or management tokens.
   - Ensure `.env.example` remains updated with mock placeholders.
   - Always verify `git status` and `.gitignore` before staging.

---

## 5. Architectural Map

```
bio-coach/
├── AGENTS.md                  # Agent operating instructions (this file)
├── run.py                     # Root entry point: starts API server & prepares shortcuts
├── backend/
│   ├── physiology.py          # Pure deterministic algorithms (Recovery, Strain, ANS, 3 Pillars)
│   ├── metabolism.py          # Mifflin-St Jeor BMR, dynamic TDEE (Apple Watch kcal), macros
│   ├── orchestrator.py        # Gemini AI prompt builder, structured parsing & deterministic fallback
│   ├── payload_validator.py   # HealthKit sanitizer, Spanish comma-decimal coercion, clamping
│   ├── service.py             # Service coordinator (Supabase PostgREST + Physiology + Orchestrator)
│   └── api.py                 # Pure Python HTTP server (zero npm/pip dependencies)
├── database/
│   └── schema.sql             # Supabase DDL (daily_recovery, workouts, nutrition_logs, hr_checkins)
├── scripts/
│   ├── test_connection.py     # Connectivity test for Supabase PostgREST
│   └── generate_shortcuts.py  # Binary .shortcut plist generator and ZIP packager
├── shortcuts/
│   ├── downloads/             # Serves ready-to-import .shortcut and .zip files
│   └── *.md                   # Blueprint documentation for iOS Shortcuts
├── webapp/
│   ├── index.html             # Standalone PWA shell (Tailwind CDN, dark-mode glassmorphism)
│   ├── app.js                 # Frontend SPA logic (Dashboard, Nutrition tab, Coach Chat)
│   ├── manifest.json          # iOS standalone PWA manifest
│   └── sw.js                  # Service Worker for offline asset caching
└── tests/
    ├── test_physiology.py
    ├── test_metabolism.py
    ├── test_orchestrator.py
    ├── test_service.py
    ├── test_shortcuts_payloads.py
    ├── test_api_endpoints.py
    ├── test_webapp_api.py
    └── test_shortcut_generator.py
```

---

## 6. Verification Checklist Before Marking Work Complete

- [ ] All code comments and docstrings written in **English**.
- [ ] User-facing text, error messages, and UI written in **Spanish**.
- [ ] Unit tests written **before** implementation and passing with 100% green status.
- [ ] Full regression suite executed (`python -m unittest discover -s tests -v`).
- [ ] No API keys, credentials, or `.env` files staged or pushed.
- [ ] Changes committed with clean Conventional Commits.
- [ ] Server starts cleanly with `python run.py`.
