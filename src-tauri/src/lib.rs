use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State, AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use chrono::Datelike;

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
fn save_events(state: State<AppState>, events: Value) -> bool {
    let dir = get_data_dir(&state);
    write_json(&dir, "events", &events);
    true
}

#[tauri::command]
fn load_exams(state: State<AppState>) -> Value {
    let dir = get_data_dir(&state);
    read_json(&dir, "exams", Value::Array(vec![]))
}

#[tauri::command]
fn save_exams(state: State<AppState>, exams: Value) -> bool {
    let dir = get_data_dir(&state);
    write_json(&dir, "exams", &exams);
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
fn save_settings(state: State<AppState>, settings: Value) -> bool {
    let dir = get_data_dir(&state);
    write_json(&dir, "settings", &settings);
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

// ===== Notification Scheduler (runs in background) =====
fn start_notification_scheduler(app: AppHandle, state: std::sync::Arc<Mutex<PathBuf>>) {
    std::thread::spawn(move || {
        let mut last_minute = String::new();
        loop {
            // Sleep 60s — we only need once-per-minute precision (checks HH:MM)
            std::thread::sleep(std::time::Duration::from_secs(60));
            
            let now = chrono::Local::now();
            let current_minute = now.format("%H:%M").to_string();
            
            if current_minute == last_minute {
                continue;
            }
            last_minute = current_minute.clone();
            
            let dir = state.lock().unwrap().clone();
            let today = now.format("%Y-%m-%d").to_string();
            let tomorrow = (now + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
            
            // Per-event reminders
            let mut events = read_json(&dir, "events", Value::Array(vec![]));
            let mut dirty = false;
            
            if let Value::Array(ref mut arr) = events {
                for event in arr.iter_mut() {
                    if let Some(reminders) = event.get("reminders").and_then(|r| r.as_array()).cloned() {
                        let sent: Vec<String> = event.get("remindersSent")
                            .and_then(|s| s.as_array())
                            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                            .unwrap_or_default();
                        
                        let mut new_sent = sent.clone();
                        
                        for rem in &reminders {
                            let rem_type = rem.get("type").and_then(|t| t.as_str()).unwrap_or("");
                            let rem_time = rem.get("time").and_then(|t| t.as_str()).unwrap_or("");
                            let rem_key = format!("{}:{}", rem_type, rem_time);
                            
                            if sent.contains(&rem_key) {
                                continue;
                            }
                            
                            let event_date = event.get("date").and_then(|d| d.as_str()).unwrap_or("");
                            let should_fire = match rem_type {
                                "day-before" => event_date == tomorrow && current_minute == rem_time,
                                "same-day" => event_date == today && current_minute == rem_time,
                                _ => false,
                            };
                            
                            if should_fire {
                                let title_text = event.get("title").and_then(|t| t.as_str()).unwrap_or("Evento");
                                let time_start = event.get("timeStart").and_then(|t| t.as_str()).unwrap_or("");
                                let is_day_before = rem_type == "day-before";
                                
                                let notif_title = if is_day_before {
                                    "StudyPlan — Promemoria domani".to_string()
                                } else {
                                    "StudyPlan — Promemoria oggi".to_string()
                                };
                                let notif_body = if is_day_before {
                                    format!("Domani: {} alle {}", title_text, time_start)
                                } else {
                                    format!("Oggi: {} alle {}", title_text, time_start)
                                };
                                
                                let _ = app.notification()
                                    .builder()
                                    .title(&notif_title)
                                    .body(&notif_body)
                                    .show();
                                
                                new_sent.push(rem_key);
                                dirty = true;
                            }
                        }
                        
                        if new_sent.len() > sent.len() {
                            event["remindersSent"] = Value::Array(
                                new_sent.into_iter().map(|s| Value::String(s)).collect()
                            );
                        }
                    }
                }
            }
            
            if dirty {
                write_json(&dir, "events", &events);
            }
            
            // Global morning/afternoon/evening summary
            let settings = read_json(&dir, "settings", serde_json::json!({
                "morningNotif": true, "afternoonNotif": true, "eveningNotif": true,
                "morningTime": "07:30", "afternoonTime": "14:00", "eveningTime": "21:00"
            }));
            
            let morning_enabled = settings.get("morningNotif").and_then(|v| v.as_bool()).unwrap_or(true);
            let afternoon_enabled = settings.get("afternoonNotif").and_then(|v| v.as_bool()).unwrap_or(true);
            let evening_enabled = settings.get("eveningNotif").and_then(|v| v.as_bool()).unwrap_or(true);
            let morning_time = settings.get("morningTime").and_then(|v| v.as_str()).unwrap_or("07:30");
            let afternoon_time = settings.get("afternoonTime").and_then(|v| v.as_str()).unwrap_or("14:00");
            let evening_time = settings.get("eveningTime").and_then(|v| v.as_str()).unwrap_or("21:00");
            
            let is_morning = morning_enabled && current_minute == morning_time;
            let is_afternoon = afternoon_enabled && current_minute == afternoon_time;
            let is_evening = evening_enabled && current_minute == evening_time;
            
            if is_morning || is_afternoon || is_evening {
                if let Value::Array(ref arr) = read_json(&dir, "events", Value::Array(vec![])) {
                    let today_events: Vec<&Value> = arr.iter()
                        .filter(|e| e.get("date").and_then(|d| d.as_str()) == Some(today.as_str()))
                        .collect();

                    // Also get tomorrow's events for evening notification
                    let tomorrow_events: Vec<&Value> = arr.iter()
                        .filter(|e| e.get("date").and_then(|d| d.as_str()) == Some(tomorrow.as_str()))
                        .collect();
                    
                    if is_morning && !today_events.is_empty() {
                        let pending = today_events.iter()
                            .filter(|e| !e.get("completed").and_then(|c| c.as_bool()).unwrap_or(false))
                            .count();
                        let _ = app.notification()
                            .builder()
                            .title("StudyPlan — Riepilogo mattutino")
                            .body(&format!("{} impegni in programma per oggi.", pending))
                            .show();
                    }

                    if is_afternoon && !today_events.is_empty() {
                        let completed = today_events.iter()
                            .filter(|e| e.get("completed").and_then(|c| c.as_bool()).unwrap_or(false))
                            .count();
                        let remaining = today_events.len() - completed;
                        if remaining > 0 {
                            let _ = app.notification()
                                .builder()
                                .title("StudyPlan — Riepilogo pomeridiano")
                                .body(&format!("{} impegni ancora da completare oggi.", remaining))
                                .show();
                        }
                    }
                    
                    if is_evening {
                        if !today_events.is_empty() {
                            let completed = today_events.iter()
                                .filter(|e| e.get("completed").and_then(|c| c.as_bool()).unwrap_or(false))
                                .count();
                            let _ = app.notification()
                                .builder()
                                .title("StudyPlan — Riepilogo serale")
                                .body(&format!("Completati {}/{} impegni di oggi.", completed, today_events.len()))
                                .show();
                        }
                        // Preview tomorrow
                        if !tomorrow_events.is_empty() {
                            let _ = app.notification()
                                .builder()
                                .title("StudyPlan — Domani")
                                .body(&format!("{} impegni in programma per domani.", tomorrow_events.len()))
                                .show();
                        }
                    }
                }
            }
        }
    });
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
    
    let data_dir_arc = std::sync::Arc::new(Mutex::new(data_dir.clone()));
    
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
            {
                let data_dir = data_dir_arc.lock().unwrap().clone();
                let marker = data_dir.join(".notifications_registered");
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
            // Note: window starts hidden (visible:false in tauri.conf.json)
            // Frontend calls show_main_window when DOM is ready to avoid flash
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Focused(false) => {
                            let _ = w.emit("app-blur", true);
                        }
                        tauri::WindowEvent::Focused(true) => {
                            let _ = w.emit("app-blur", false);
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
            
            // Start notification scheduler
            let handle = app.handle().clone();
            let state_clone = data_dir_arc.clone();
            start_notification_scheduler(handle, state_clone);

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
