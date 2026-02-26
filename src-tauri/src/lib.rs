use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State, AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
#[cfg(any(target_os = "android", target_os = "ios"))]
use tauri_plugin_notification::Schedule;
use chrono::Datelike;
#[cfg(any(target_os = "android", target_os = "ios"))]
use chrono::TimeZone as _;

// ===== State =====
pub struct AppState {
    data_dir: Mutex<PathBuf>,
}

// ===== Helpers =====
fn get_data_dir(state: &State<AppState>) -> PathBuf {
    state.data_dir.lock().unwrap().clone()
}

fn read_json(dir: &PathBuf, name: &str, fallback: Value) -> Value {
    let path = dir.join(format!("{}.json", name));
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or(fallback),
            Err(_) => fallback,
        }
    } else {
        fallback
    }
}

fn write_json(dir: &PathBuf, name: &str, data: &Value) {
    let path = dir.join(format!("{}.json", name));
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let content = serde_json::to_string_pretty(data).unwrap_or_default();
    let _ = fs::write(&path, content);
}

// ===== Data Commands =====

#[tauri::command]
fn load_events(state: State<AppState>) -> Value {
    let dir = get_data_dir(&state);
    read_json(&dir, "events", Value::Array(vec![]))
}

#[tauri::command]
fn save_events(app: AppHandle, state: State<AppState>, events: Value) -> bool {
    let dir = get_data_dir(&state);
    write_json(&dir, "events", &events);
    sync_notifications(&app, &dir);
    true
}

#[tauri::command]
fn load_exams(state: State<AppState>) -> Value {
    let dir = get_data_dir(&state);
    read_json(&dir, "exams", Value::Array(vec![]))
}

#[tauri::command]
fn save_exams(app: AppHandle, state: State<AppState>, exams: Value) -> bool {
    let dir = get_data_dir(&state);
    write_json(&dir, "exams", &exams);
    sync_notifications(&app, &dir);
    true
}

#[tauri::command]
fn load_settings(state: State<AppState>) -> Value {
    let dir = get_data_dir(&state);
    let default_settings = serde_json::json!({
        "morningNotif": true,
        "eveningNotif": true,
        "morningTime": "07:30",
        "eveningTime": "21:00"
    });
    read_json(&dir, "settings", default_settings)
}

#[tauri::command]
fn save_settings(app: AppHandle, state: State<AppState>, settings: Value) -> bool {
    let dir = get_data_dir(&state);
    write_json(&dir, "settings", &settings);
    sync_notifications(&app, &dir);
    true
}

#[tauri::command]
fn load_career(state: State<AppState>) -> Value {
    let dir = get_data_dir(&state);
    read_json(&dir, "career", Value::Null)
}

#[tauri::command]
fn save_career(state: State<AppState>, data: Value) -> bool {
    let dir = get_data_dir(&state);
    write_json(&dir, "career", &data);
    true
}

// ===== Platform =====

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
fn get_is_mac() -> bool {
    cfg!(target_os = "macos")
}

#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

// ===== Security / Keychain =====

#[tauri::command]
fn get_secure_key() -> Result<String, String> {
    let service = "StudyPlan_Secure";
    let username = whoami::username();
    
    let entry = keyring::Entry::new(service, &username).map_err(|e| e.to_string())?;
    
    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => {
            // Generate new key
            use rand::Rng;
            let key: String = rand::thread_rng()
                .sample_iter(&rand::distributions::Alphanumeric)
                .take(64)
                .map(char::from)
                .collect();
            entry.set_password(&key).map_err(|e| e.to_string())?;
            Ok(key)
        },
        Err(e) => Err(e.to_string()),
    }
}

// ===== Biometrics =====

#[tauri::command]
fn bio_check() -> bool {
    #[cfg(target_os = "macos")]
    {
        // On macOS, Touch ID is generally available on supported hardware
        // The actual prompt will verify
        true
    }
    #[cfg(target_os = "windows")]
    {
        true
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

#[tauri::command]
fn bio_has_saved() -> bool {
    let service = "TechnoJaw_StudyPlan_Bio";
    let username = whoami::username();
    
    if let Ok(entry) = keyring::Entry::new(service, &username) {
        entry.get_password().is_ok()
    } else {
        false
    }
}

#[tauri::command]
fn bio_save(pwd: String) -> Result<bool, String> {
    let service = "TechnoJaw_StudyPlan_Bio";
    let username = whoami::username();
    
    let entry = keyring::Entry::new(service, &username).map_err(|e| e.to_string())?;
    entry.set_password(&pwd).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn bio_login() -> Result<String, String> {
    let service = "TechnoJaw_StudyPlan_Bio";
    
    // Verifica identità con Touch ID prima di accedere al keychain
    #[cfg(target_os = "macos")]
    {
        let swift_code = concat!(
            "import LocalAuthentication\n",
            "import Foundation\n",
            "let ctx = LAContext()\n",
            "var err: NSError?\n",
            "guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) else {\n",
            "  fputs(\"no_biometrics\", stderr); exit(1)\n",
            "}\n",
            "let sema = DispatchSemaphore(value: 0)\n",
            "var ok = false\n",
            "ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: \"StudyPlan richiede l'autenticazione\") { s, _ in ok = s; sema.signal() }\n",
            "sema.wait()\n",
            "if ok { print(\"ok\"); exit(0) } else { fputs(\"denied\", stderr); exit(1) }\n"
        );
        
        let tmp = std::env::temp_dir().join("studyplan_touchid.swift");
        std::fs::write(&tmp, swift_code).map_err(|e| e.to_string())?;
        
        let result = std::process::Command::new("swift")
            .arg(&tmp)
            .output()
            .map_err(|e| format!("Errore biometria: {}", e))?;
        
        let _ = std::fs::remove_file(&tmp);
        
        if !result.status.success() {
            return Err("Autenticazione biometrica negata".to_string());
        }
    }
    
    let username = whoami::username();
    let entry = keyring::Entry::new(service, &username).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

#[tauri::command]
fn bio_clear() -> Result<bool, String> {
    let service = "TechnoJaw_StudyPlan_Bio";
    let username = whoami::username();
    
    if let Ok(entry) = keyring::Entry::new(service, &username) {
        let _ = entry.delete_credential();
    }
    Ok(true)
}

// ===== PDF =====

#[tauri::command]
fn pick_pdf(state: State<AppState>, app: AppHandle) -> Result<Option<Value>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let dir = get_data_dir(&state);
    let pdf_dir = dir.join("pdf-notes");
    let _ = fs::create_dir_all(&pdf_dir);
    
    let file_path = app.dialog()
        .file()
        .add_filter("PDF", &["pdf"])
        .blocking_pick_file();
    
    match file_path {
        Some(fp) => {
            let src = fp.into_path().map_err(|e| format!("Path error: {:?}", e))?;
            let original_name = src.file_name()
                .map(|n: &std::ffi::OsStr| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "document.pdf".to_string());
            
            let timestamp = chrono::Utc::now().timestamp_millis();
            let file_name = format!("{}_{}", timestamp, original_name);
            let dest = pdf_dir.join(&file_name);
            
            fs::copy(&src, &dest).map_err(|e| e.to_string())?;
            
            Ok(Some(serde_json::json!({
                "fileName": file_name,
                "originalName": original_name
            })))
        },
        None => Ok(None),
    }
}

#[tauri::command]
fn open_pdf(state: State<AppState>, file_name: String) -> bool {
    let dir = get_data_dir(&state);
    let pdf_dir = dir.join("pdf-notes");
    let path = pdf_dir.join(&file_name);
    
    // Security: ensure path doesn't escape pdf_dir
    if !path.starts_with(&pdf_dir) {
        return false;
    }
    
    if path.exists() {
        let _ = open::that(&path);
        true
    } else {
        false
    }
}

#[tauri::command]
fn delete_pdf(state: State<AppState>, file_name: String) -> bool {
    let dir = get_data_dir(&state);
    let pdf_dir = dir.join("pdf-notes");
    let path = pdf_dir.join(&file_name);
    
    if !path.starts_with(&pdf_dir) {
        return false;
    }
    
    if path.exists() {
        fs::remove_file(&path).is_ok()
    } else {
        false
    }
}

#[tauri::command]
fn get_pdf_pages(state: State<AppState>, file_name: String) -> u32 {
    let dir = get_data_dir(&state);
    let pdf_dir = dir.join("pdf-notes");
    let path = pdf_dir.join(&file_name);
    
    if !path.starts_with(&pdf_dir) || !path.exists() {
        return 0;
    }
    
    // Simple PDF page count by counting /Type /Page occurrences
    if let Ok(content) = fs::read(&path) {
        let content_str = String::from_utf8_lossy(&content);
        // Count "/Type /Page" but not "/Type /Pages"
        content_str.matches("/Type /Page\n").count() as u32
            + content_str.matches("/Type /Page\r").count() as u32
            + content_str.matches("/Type /Page ").count() as u32
    } else {
        0
    }
}

// ===== Widget Data =====

#[tauri::command]
fn get_widget_today(state: State<AppState>) -> Value {
    let dir = get_data_dir(&state);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let events = read_json(&dir, "events", Value::Array(vec![]));
    
    if let Value::Array(arr) = events {
        let mut today_events: Vec<Value> = arr.into_iter()
            .filter(|e| e.get("date").and_then(|d| d.as_str()) == Some(&today))
            .collect();
        today_events.sort_by(|a, b| {
            let ta = a.get("timeStart").and_then(|t| t.as_str()).unwrap_or("");
            let tb = b.get("timeStart").and_then(|t| t.as_str()).unwrap_or("");
            ta.cmp(tb)
        });
        Value::Array(today_events)
    } else {
        Value::Array(vec![])
    }
}

#[tauri::command]
fn get_widget_exams(state: State<AppState>) -> Value {
    let dir = get_data_dir(&state);
    let career = read_json(&dir, "career", Value::Null);
    
    if let Some(exams) = career.get("exams").and_then(|e| e.as_array()) {
        let mut filtered: Vec<Value> = exams.iter()
            .filter(|e| e.get("status").and_then(|s| s.as_str()) != Some("passed"))
            .cloned()
            .collect();
        filtered.sort_by(|a, b| {
            let da = a.get("examDate").and_then(|d| d.as_str()).unwrap_or("zzzz");
            let db = b.get("examDate").and_then(|d| d.as_str()).unwrap_or("zzzz");
            da.cmp(db)
        });
        Value::Array(filtered)
    } else {
        Value::Array(vec![])
    }
}

#[tauri::command]
fn get_widget_week(state: State<AppState>) -> Value {
    let dir = get_data_dir(&state);
    let now = chrono::Local::now().date_naive();
    let weekday = now.weekday().num_days_from_monday();
    let start_of_week = now - chrono::Duration::days(weekday as i64);
    let end_of_week = start_of_week + chrono::Duration::days(6);
    
    let sow = start_of_week.format("%Y-%m-%d").to_string();
    let eow = end_of_week.format("%Y-%m-%d").to_string();
    
    let events = read_json(&dir, "events", Value::Array(vec![]));
    
    if let Value::Array(arr) = events {
        let mut week_events: Vec<Value> = arr.into_iter()
            .filter(|e| {
                if let Some(date) = e.get("date").and_then(|d| d.as_str()) {
                    date >= sow.as_str() && date <= eow.as_str()
                } else {
                    false
                }
            })
            .collect();
        week_events.sort_by(|a, b| {
            let da = a.get("date").and_then(|d| d.as_str()).unwrap_or("");
            let db = b.get("date").and_then(|d| d.as_str()).unwrap_or("");
            let ta = a.get("timeStart").and_then(|t| t.as_str()).unwrap_or("");
            let tb = b.get("timeStart").and_then(|t| t.as_str()).unwrap_or("");
            da.cmp(db).then(ta.cmp(tb))
        });
        Value::Array(week_events)
    } else {
        Value::Array(vec![])
    }
}

#[tauri::command]
fn get_widget_career(state: State<AppState>) -> Value {
    let dir = get_data_dir(&state);
    read_json(&dir, "career", Value::Null)
}

// ===== HYBRID NOTIFICATION ARCHITECTURE (v2.1) =====
//
// MOBILE (Android/iOS): Native AOT scheduling via Schedule::At — the OS fires
//   notifications even if the app is killed.
//
// DESKTOP (macOS/Windows/Linux): tauri-plugin-notification (via notify-rust)
//   IGNORES Schedule::At and fires immediately.  Instead we run a single async
//   Tokio cron job that wakes once per minute, checks the JSON state, and fires
//   notifications in real-time.  Zero threads, zero sleeps, zero CPU waste.
//
//   On macOS the App Nap hack (NSProcessInfo.beginActivityWithOptions) prevents
//   the OS from freezing the async timer when the window is hidden.

/// Deterministic i32 notification ID from a seed string.
/// Uses FNV-1a hash to produce a stable, positive, non-zero i32.
#[cfg(any(target_os = "android", target_os = "ios"))]
fn notif_id(seed: &str) -> i32 {
    let mut h: u32 = 2166136261;
    for b in seed.as_bytes() {
        h ^= *b as u32;
        h = h.wrapping_mul(16777619);
    }
    (h & 0x7FFF_FFFE) as i32 | 1
}

// ── MOBILE: Native AOT scheduling ─────────────────────────────────────────
#[cfg(any(target_os = "android", target_os = "ios"))]
fn sync_notifications(app: &AppHandle, data_dir: &std::path::Path) {
    let _ = app.notification().cancel_all();
    eprintln!("[StudyPlan] Cancelled all pending notifications (mobile)");

    let dir = data_dir.to_path_buf();
    let events = read_json(&dir, "events", Value::Array(vec![]));
    let settings = read_json(&dir, "settings", serde_json::json!({
        "morningNotif": true, "afternoonNotif": true, "eveningNotif": true,
        "morningTime": "07:30", "afternoonTime": "14:00", "eveningTime": "21:00"
    }));

    let now = chrono::Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let tomorrow = (now + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    const MAX_SCHEDULED: u32 = 60;
    let horizon = now + chrono::Duration::days(14);
    let mut scheduled_count = 0u32;

    let to_schedule_time = |date_str: &str, time_str: &str| -> Option<time::OffsetDateTime> {
        if time_str.len() < 5 { return None; }
        let dt_str = format!("{} {}", date_str, time_str);
        let ndt = chrono::NaiveDateTime::parse_from_str(&dt_str, "%Y-%m-%d %H:%M").ok()?;
        let local_dt = chrono::Local.from_local_datetime(&ndt).single()?;
        if local_dt <= now || local_dt > horizon { return None; }
        let ts = local_dt.timestamp();
        let offset_secs = local_dt.offset().local_minus_utc();
        let offset = time::UtcOffset::from_whole_seconds(offset_secs).ok()?;
        time::OffsetDateTime::from_unix_timestamp(ts).ok().map(|t| t.to_offset(offset))
    };

    // Per-event reminders
    if let Value::Array(ref arr) = events {
        for event in arr {
            if scheduled_count >= MAX_SCHEDULED { break; }
            let reminders_obj = match event.get("reminders") {
                Some(r) if r.is_object() => r, _ => continue,
            };
            let event_date = event.get("date").and_then(|d| d.as_str()).unwrap_or("");
            let title_text = event.get("title").and_then(|t| t.as_str()).unwrap_or("Evento");
            let time_start = event.get("timeStart").and_then(|t| t.as_str()).unwrap_or("");

            if let Some(db) = reminders_obj.get("dayBefore") {
                let enabled = db.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
                let rem_time = db.get("time").and_then(|v| v.as_str()).unwrap_or("");
                if enabled {
                    if let Ok(edate) = chrono::NaiveDate::parse_from_str(event_date, "%Y-%m-%d") {
                        let day_before = (edate - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
                        if let Some(fire_at) = to_schedule_time(&day_before, rem_time) {
                            let id = notif_id(&format!("sp-db-{}-{}", event_date, rem_time));
                            let _ = app.notification().builder().id(id)
                                .title("StudyPlan — Promemoria domani")
                                .body(&format!("Domani: {} alle {}", title_text, time_start))
                                .schedule(Schedule::At { date: fire_at, repeating: false, allow_while_idle: true })
                                .show();
                            scheduled_count += 1;
                        }
                    }
                }
            }
            if let Some(sd) = reminders_obj.get("sameDay") {
                let enabled = sd.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
                let rem_time = sd.get("time").and_then(|v| v.as_str()).unwrap_or("");
                if enabled {
                    if let Some(fire_at) = to_schedule_time(event_date, rem_time) {
                        let id = notif_id(&format!("sp-sd-{}-{}", event_date, rem_time));
                        let _ = app.notification().builder().id(id)
                            .title("StudyPlan — Promemoria oggi")
                            .body(&format!("Oggi: {} alle {}", title_text, time_start))
                            .schedule(Schedule::At { date: fire_at, repeating: false, allow_while_idle: true })
                            .show();
                        scheduled_count += 1;
                    }
                }
            }
            if let Some(custom_mins) = reminders_obj.get("customRemindTime").and_then(|v| v.as_i64()) {
                if custom_mins > 0 && !time_start.is_empty() {
                    let dt_str = format!("{} {}", event_date, time_start);
                    if let Ok(ndt) = chrono::NaiveDateTime::parse_from_str(&dt_str, "%Y-%m-%d %H:%M") {
                        let remind_ndt = ndt - chrono::Duration::minutes(custom_mins);
                        let remind_date = remind_ndt.format("%Y-%m-%d").to_string();
                        let remind_time = remind_ndt.format("%H:%M").to_string();
                        if let Some(fire_at) = to_schedule_time(&remind_date, &remind_time) {
                            let id = notif_id(&format!("sp-cr-{}-{}-{}", event_date, time_start, custom_mins));
                            let _ = app.notification().builder().id(id)
                                .title("StudyPlan — Tra poco")
                                .body(&format!("{} tra {} minuti", title_text, custom_mins))
                                .schedule(Schedule::At { date: fire_at, repeating: false, allow_while_idle: true })
                                .show();
                            scheduled_count += 1;
                        }
                    }
                }
            }
        }
    }

    // Global briefings
    let morning_enabled = settings.get("morningNotif").and_then(|v| v.as_bool()).unwrap_or(true);
    let afternoon_enabled = settings.get("afternoonNotif").and_then(|v| v.as_bool()).unwrap_or(true);
    let evening_enabled = settings.get("eveningNotif").and_then(|v| v.as_bool()).unwrap_or(true);
    let morning_time = settings.get("morningTime").and_then(|v| v.as_str()).unwrap_or("07:30");
    let afternoon_time = settings.get("afternoonTime").and_then(|v| v.as_str()).unwrap_or("14:00");
    let evening_time = settings.get("eveningTime").and_then(|v| v.as_str()).unwrap_or("21:00");

    let today_count = if let Value::Array(ref arr) = events {
        arr.iter().filter(|e| e.get("date").and_then(|d| d.as_str()) == Some(today.as_str())).count()
    } else { 0 };
    let today_pending = if let Value::Array(ref arr) = events {
        arr.iter().filter(|e| {
            e.get("date").and_then(|d| d.as_str()) == Some(today.as_str())
            && !e.get("completed").and_then(|c| c.as_bool()).unwrap_or(false)
        }).count()
    } else { 0 };
    let today_completed = today_count.saturating_sub(today_pending);
    let tomorrow_count = if let Value::Array(ref arr) = events {
        arr.iter().filter(|e| e.get("date").and_then(|d| d.as_str()) == Some(tomorrow.as_str())).count()
    } else { 0 };

    if scheduled_count < MAX_SCHEDULED && morning_enabled && today_pending > 0 {
        if let Some(fire_at) = to_schedule_time(&today, morning_time) {
            let id = notif_id(&format!("sp-morning-{}", today));
            let _ = app.notification().builder().id(id)
                .title("StudyPlan — Riepilogo mattutino")
                .body(&format!("{} impegni in programma per oggi.", today_pending))
                .schedule(Schedule::At { date: fire_at, repeating: false, allow_while_idle: true })
                .show();
            scheduled_count += 1;
        }
    }
    if scheduled_count < MAX_SCHEDULED && afternoon_enabled && today_pending > 0 {
        if let Some(fire_at) = to_schedule_time(&today, afternoon_time) {
            let id = notif_id(&format!("sp-afternoon-{}", today));
            let _ = app.notification().builder().id(id)
                .title("StudyPlan — Riepilogo pomeridiano")
                .body(&format!("{} impegni ancora da completare oggi.", today_pending))
                .schedule(Schedule::At { date: fire_at, repeating: false, allow_while_idle: true })
                .show();
            scheduled_count += 1;
        }
    }
    if scheduled_count < MAX_SCHEDULED && evening_enabled && (today_count > 0 || tomorrow_count > 0) {
        if let Some(fire_at) = to_schedule_time(&today, evening_time) {
            let id = notif_id(&format!("sp-evening-{}", today));
            let body = if today_count > 0 && tomorrow_count > 0 {
                format!("Completati {}/{}. Domani: {} impegni.", today_completed, today_count, tomorrow_count)
            } else if today_count > 0 {
                format!("Completati {}/{} impegni di oggi.", today_completed, today_count)
            } else {
                format!("{} impegni in programma per domani.", tomorrow_count)
            };
            let _ = app.notification().builder().id(id)
                .title("StudyPlan — Riepilogo serale")
                .body(&body)
                .schedule(Schedule::At { date: fire_at, repeating: false, allow_while_idle: true })
                .show();
            scheduled_count += 1;
        }
    }
    if scheduled_count < MAX_SCHEDULED && morning_enabled && tomorrow_count > 0 {
        if let Some(fire_at) = to_schedule_time(&tomorrow, morning_time) {
            let id = notif_id(&format!("sp-morning-{}", tomorrow));
            let _ = app.notification().builder().id(id)
                .title("StudyPlan — Riepilogo mattutino")
                .body(&format!("{} impegni in programma per oggi.", tomorrow_count))
                .schedule(Schedule::At { date: fire_at, repeating: false, allow_while_idle: true })
                .show();
            scheduled_count += 1;
        }
    }

    eprintln!("[StudyPlan] Mobile AOT sync: {}/{} notifications scheduled", scheduled_count, MAX_SCHEDULED);
}

// ── DESKTOP: stub — scheduling is handled by the async cron job ────────────
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn sync_notifications(_app: &AppHandle, _data_dir: &std::path::Path) {
    // No-op on desktop.  The desktop_cron_job() handles everything.
}

// ── DESKTOP: Async Cron Job — wakes every 60s, fires matching notifications ──
#[cfg(not(any(target_os = "android", target_os = "ios")))]
async fn desktop_cron_job(app: AppHandle) {
    use tauri_plugin_notification::NotificationExt;

    let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
    let mut last_processed_minute = String::new();

    eprintln!("[StudyPlan Cron] Desktop cron job started — checking every 60s");

    loop {
        interval.tick().await;

        let now = chrono::Local::now();
        let current_minute = now.format("%Y-%m-%d %H:%M").to_string();
        if current_minute == last_processed_minute { continue; }
        last_processed_minute = current_minute.clone();

        let data_dir = {
            let state = app.state::<AppState>();
            let dir = state.data_dir.lock().unwrap().clone();
            dir
        };

        let events = read_json(&data_dir, "events", Value::Array(vec![]));
        let settings = read_json(&data_dir, "settings", serde_json::json!({
            "morningNotif": true, "afternoonNotif": true, "eveningNotif": true,
            "morningTime": "07:30", "afternoonTime": "14:00", "eveningTime": "21:00"
        }));

        let today = now.format("%Y-%m-%d").to_string();
        let tomorrow = (now + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

        // ── Check per-event reminders ──
        if let Value::Array(ref arr) = events {
            for event in arr {
                let reminders_obj = match event.get("reminders") {
                    Some(r) if r.is_object() => r, _ => continue,
                };
                let event_date = event.get("date").and_then(|d| d.as_str()).unwrap_or("");
                let title_text = event.get("title").and_then(|t| t.as_str()).unwrap_or("Evento");
                let time_start = event.get("timeStart").and_then(|t| t.as_str()).unwrap_or("");

                // dayBefore reminder
                if let Some(db) = reminders_obj.get("dayBefore") {
                    let enabled = db.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
                    let rem_time = db.get("time").and_then(|v| v.as_str()).unwrap_or("");
                    if enabled {
                        if let Ok(edate) = chrono::NaiveDate::parse_from_str(event_date, "%Y-%m-%d") {
                            let day_before = (edate - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
                            let fire_key = format!("{} {}", day_before, rem_time);
                            if fire_key == current_minute {
                                let app_c = app.clone();
                                let body = format!("Domani: {} alle {}", title_text, time_start);
                                let _ = app.run_on_main_thread(move || {
                                    let _ = app_c.notification().builder()
                                        .title("StudyPlan — Promemoria domani")
                                        .body(&body).show();
                                });
                                eprintln!("[StudyPlan Cron] ✓ dayBefore fired: {}", fire_key);
                            }
                        }
                    }
                }

                // sameDay reminder
                if let Some(sd) = reminders_obj.get("sameDay") {
                    let enabled = sd.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
                    let rem_time = sd.get("time").and_then(|v| v.as_str()).unwrap_or("");
                    if enabled {
                        let fire_key = format!("{} {}", event_date, rem_time);
                        if fire_key == current_minute {
                            let app_c = app.clone();
                            let body = format!("Oggi: {} alle {}", title_text, time_start);
                            let _ = app.run_on_main_thread(move || {
                                let _ = app_c.notification().builder()
                                    .title("StudyPlan — Promemoria oggi")
                                    .body(&body).show();
                            });
                            eprintln!("[StudyPlan Cron] ✓ sameDay fired: {}", fire_key);
                        }
                    }
                }

                // customRemindTime reminder
                if let Some(custom_mins) = reminders_obj.get("customRemindTime").and_then(|v| v.as_i64()) {
                    if custom_mins > 0 && !time_start.is_empty() {
                        let dt_str = format!("{} {}", event_date, time_start);
                        if let Ok(ndt) = chrono::NaiveDateTime::parse_from_str(&dt_str, "%Y-%m-%d %H:%M") {
                            let remind_ndt = ndt - chrono::Duration::minutes(custom_mins);
                            let fire_key = remind_ndt.format("%Y-%m-%d %H:%M").to_string();
                            if fire_key == current_minute {
                                let app_c = app.clone();
                                let body = format!("{} tra {} minuti", title_text, custom_mins);
                                let _ = app.run_on_main_thread(move || {
                                    let _ = app_c.notification().builder()
                                        .title("StudyPlan — Tra poco")
                                        .body(&body).show();
                                });
                                eprintln!("[StudyPlan Cron] ✓ customRemind fired: {}", fire_key);
                            }
                        }
                    }
                }
            }
        }

        // ── Check global briefings ──
        let morning_enabled = settings.get("morningNotif").and_then(|v| v.as_bool()).unwrap_or(true);
        let afternoon_enabled = settings.get("afternoonNotif").and_then(|v| v.as_bool()).unwrap_or(true);
        let evening_enabled = settings.get("eveningNotif").and_then(|v| v.as_bool()).unwrap_or(true);
        let morning_time = settings.get("morningTime").and_then(|v| v.as_str()).unwrap_or("07:30");
        let afternoon_time = settings.get("afternoonTime").and_then(|v| v.as_str()).unwrap_or("14:00");
        let evening_time = settings.get("eveningTime").and_then(|v| v.as_str()).unwrap_or("21:00");

        let today_count = if let Value::Array(ref arr) = events {
            arr.iter().filter(|e| e.get("date").and_then(|d| d.as_str()) == Some(today.as_str())).count()
        } else { 0 };
        let today_pending = if let Value::Array(ref arr) = events {
            arr.iter().filter(|e| {
                e.get("date").and_then(|d| d.as_str()) == Some(today.as_str())
                && !e.get("completed").and_then(|c| c.as_bool()).unwrap_or(false)
            }).count()
        } else { 0 };
        let today_completed = today_count.saturating_sub(today_pending);
        let tomorrow_count = if let Value::Array(ref arr) = events {
            arr.iter().filter(|e| e.get("date").and_then(|d| d.as_str()) == Some(tomorrow.as_str())).count()
        } else { 0 };

        // Morning briefing
        if morning_enabled && today_pending > 0 {
            let key = format!("{} {}", today, morning_time);
            if key == current_minute {
                let app_c = app.clone();
                let body = format!("{} impegni in programma per oggi.", today_pending);
                let _ = app.run_on_main_thread(move || {
                    let _ = app_c.notification().builder()
                        .title("StudyPlan — Riepilogo mattutino")
                        .body(&body).show();
                });
                eprintln!("[StudyPlan Cron] ✓ Morning briefing fired");
            }
        }

        // Afternoon briefing
        if afternoon_enabled && today_pending > 0 {
            let key = format!("{} {}", today, afternoon_time);
            if key == current_minute {
                let app_c = app.clone();
                let body = format!("{} impegni ancora da completare oggi.", today_pending);
                let _ = app.run_on_main_thread(move || {
                    let _ = app_c.notification().builder()
                        .title("StudyPlan — Riepilogo pomeridiano")
                        .body(&body).show();
                });
                eprintln!("[StudyPlan Cron] ✓ Afternoon briefing fired");
            }
        }

        // Evening briefing
        if evening_enabled && (today_count > 0 || tomorrow_count > 0) {
            let key = format!("{} {}", today, evening_time);
            if key == current_minute {
                let app_c = app.clone();
                let body = if today_count > 0 && tomorrow_count > 0 {
                    format!("Completati {}/{}. Domani: {} impegni.", today_completed, today_count, tomorrow_count)
                } else if today_count > 0 {
                    format!("Completati {}/{} impegni di oggi.", today_completed, today_count)
                } else {
                    format!("{} impegni in programma per domani.", tomorrow_count)
                };
                let _ = app.run_on_main_thread(move || {
                    let _ = app_c.notification().builder()
                        .title("StudyPlan — Riepilogo serale")
                        .body(&body).show();
                });
                eprintln!("[StudyPlan Cron] ✓ Evening briefing fired");
            }
        }
    }
}

// ===== Window Commands =====

#[tauri::command]
fn window_minimize(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
fn window_maximize(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn window_close(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn show_main_window(app: AppHandle, opts: Option<Value>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        // Forward navigation from widget to main window
        if let Some(opts) = opts {
            if let Some(nav) = opts.get("navigate") {
                if let Some(tab) = nav.get("tab").and_then(|t| t.as_str()) {
                    let _ = window.emit("navigate", tab);
                }
            }
        }
    }
}

#[tauri::command]
fn toggle_widget(app: AppHandle) {
    if let Some(w) = app.get_webview_window("widget") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

// ===== Run =====

pub fn run() {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.studyplan.app")
        .join("studyplan-data");
    let _ = fs::create_dir_all(&data_dir);
    let _ = fs::create_dir_all(data_dir.join("pdf-notes"));
    
    let setup_data_dir = data_dir.clone();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .manage(AppState {
            data_dir: Mutex::new(data_dir),
        })
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // First-launch notification registration with macOS
            // Request native permission — on macOS this triggers the system dialog
            {
                use tauri_plugin_notification::PermissionState;
                let data_dir = setup_data_dir.clone();
                let marker = data_dir.join(".notifications_registered");

                // Always ensure permission is requested at native level
                let state = app.notification().permission_state();
                eprintln!("[StudyPlan] Notification permission state: {:?}", state);
                match state {
                    Ok(PermissionState::Granted) => {
                        eprintln!("[StudyPlan] Notifications already granted ✓");
                    }
                    Ok(PermissionState::Denied) => {
                        // APPLE GUIDELINES FIX: if the user has explicitly Denied notifications,
                        // we must NOT call request_permission() again — macOS ignores the call and
                        // repeated attempts can cause the XPC daemon to permanently silence the app.
                        // Instead, log a message guiding the user to System Settings.
                        eprintln!("[StudyPlan] ⚠️ Notifications DENIED by user/system.");
                        eprintln!("[StudyPlan] → User must enable manually: System Settings → Notifications → StudyPlan");
                        // Emit to frontend so we can show an in-app banner
                        let _ = app.emit("notification-permission-denied", ());
                    }
                    _ => {
                        eprintln!("[StudyPlan] Notifications unknown — requesting permission...");
                        let result = app.notification().request_permission();
                        eprintln!("[StudyPlan] Permission request result: {:?}", result);
                    }
                }

                if !marker.exists() {
                    let _ = app.notification()
                        .builder()
                        .title("StudyPlan")
                        .body("Le notifiche sono attive! Riceverai promemoria per i tuoi impegni.")
                        .show();
                    let _ = fs::write(&marker, "1");
                }
            }
            
            // Privacy blur: emit events on window focus/blur
            // Intercept close button → hide to tray instead of terminating
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                let w_close = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Focused(false) => {
                            let _ = w.emit("app-blur", true);
                        }
                        tauri::WindowEvent::Focused(true) => {
                            let _ = w.emit("app-blur", false);
                        }
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            // Hide instead of close — keeps tray alive
                            api.prevent_close();
                            let _ = w_close.hide();
                        }
                        _ => {}
                    }
                });
            }

            // Tray menu
            {
                use tauri::menu::{MenuBuilder, MenuItemBuilder};
                use tauri::tray::TrayIconBuilder;

                let show_app = MenuItemBuilder::with_id("show", "Apri StudyPlan").build(app)?;
                let show_widget = MenuItemBuilder::with_id("widget", "Widget").build(app)?;
                let quit = MenuItemBuilder::with_id("quit", "Esci").build(app)?;
                let menu = MenuBuilder::new(app).items(&[&show_app, &show_widget, &quit]).build()?;

                let png_data = include_bytes!("../icons/tray-icon.png");
                let img = image::load_from_memory(png_data).expect("decode tray icon").to_rgba8();
                let (w, h) = img.dimensions();
                let icon = tauri::image::Image::new_owned(img.into_raw(), w, h);

                TrayIconBuilder::new()
                    .icon(icon)
                    .icon_as_template(false)
                    .menu(&menu)
                    .tooltip("StudyPlan")
                    .on_menu_event(move |app, event| {
                        match event.id().as_ref() {
                            "show" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            },
                            "widget" => {
                                if let Some(w) = app.get_webview_window("widget") {
                                    if w.is_visible().unwrap_or(false) {
                                        let _ = w.hide();
                                    } else {
                                        let _ = w.show();
                                        let _ = w.set_focus();
                                    }
                                }
                            },
                            "quit" => { app.exit(0); },
                            _ => {}
                        }
                    })
                    .build(app)?;
            }
            
            // Start AOT notification sync (mobile: real scheduling, desktop: no-op stub)
            sync_notifications(&app.handle(), &setup_data_dir);

            // ── DESKTOP: App Nap prevention + async cron job ──────────────────
            #[cfg(target_os = "macos")]
            {
                use objc::{msg_send, sel, sel_impl, class};
                use cocoa::foundation::NSString as NSStringTrait;
                unsafe {
                    let info: *mut objc::runtime::Object = msg_send![class!(NSProcessInfo), processInfo];
                    let reason = cocoa::foundation::NSString::alloc(cocoa::base::nil)
                        .init_str("StudyPlan notification cron job must not be suspended");
                    let _activity: *mut objc::runtime::Object = msg_send![info,
                        beginActivityWithOptions: 0x00FFFFFFu64
                        reason: reason
                    ];
                    eprintln!("[StudyPlan] macOS App Nap disabled via NSProcessInfo ✓");
                }
            }

            // Launch the desktop cron job (single async task, zero threads)
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    desktop_cron_job(app_handle).await;
                });
            }

            // Show main window after setup
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Data
            load_events,
            save_events,
            load_exams,
            save_exams,
            load_settings,
            save_settings,
            load_career,
            save_career,
            // Platform
            get_platform,
            get_is_mac,
            get_app_version,
            // Security
            get_secure_key,
            // Biometrics
            bio_check,
            bio_has_saved,
            bio_save,
            bio_login,
            bio_clear,
            // PDF
            pick_pdf,
            open_pdf,
            delete_pdf,
            get_pdf_pages,
            // Widget data
            get_widget_today,
            get_widget_exams,
            get_widget_week,
            get_widget_career,
            // Window
            window_minimize,
            window_maximize,
            window_close,
            show_main_window,
            toggle_widget,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS: click sull'icona nel Dock quando la finestra è nascosta → riaprila
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            // Prevent default exit on last window close (keep tray alive)
            if let tauri::RunEvent::ExitRequested { api, .. } = &event {
                api.prevent_exit();
            }
        });
}
