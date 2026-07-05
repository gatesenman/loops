//! Tauri command handlers — the IPC surface the frontend calls via `invoke`.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::model::{Asset, TargetApp};
use crate::osbridge;
use crate::store::Store;

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[tauri::command]
pub fn list_assets(store: State<Store>, kind: Option<String>) -> Result<Vec<Asset>, String> {
    store.list(kind.as_deref())
}

#[tauri::command]
pub fn get_asset(store: State<Store>, id: String) -> Result<Option<Asset>, String> {
    store.get(&id)
}

/// Inserts or updates an asset. Fills in id/timestamps for new assets so the
/// frontend can send a partial draft.
#[tauri::command]
pub fn save_asset(store: State<Store>, mut asset: Asset) -> Result<Asset, String> {
    if asset.id.trim().is_empty() {
        asset.id = uuid::Uuid::new_v4().to_string();
    }
    let now = now_iso();
    if asset.created_at.trim().is_empty() {
        asset.created_at = now.clone();
    }
    asset.updated_at = now;
    store.upsert(&asset)?;
    Ok(asset)
}

#[tauri::command]
pub fn delete_asset(store: State<Store>, id: String) -> Result<(), String> {
    store.delete(&id)
}

/// Increments an asset's run/copy counter (called when a loop is injected).
#[tauri::command]
pub fn bump_copies(store: State<Store>, id: String) -> Result<(), String> {
    store.bump_copies(&id)
}

/// Foreground app detection used by the command bar to filter by scope
/// (resolves the app captured just before the popup was summoned; see `osbridge`).
#[tauri::command]
pub fn get_foreground_app() -> Option<TargetApp> {
    osbridge::detect_foreground_app()
}

/// Shows/hides the frameless command-bar window. Bound to the global hotkey and
/// callable from the tray.
#[tauri::command]
pub fn toggle_command_bar(app: AppHandle) -> Result<(), String> {
    crate::toggle_command_bar_window(&app);
    Ok(())
}

/// App-level settings are persisted as a single JSON blob under the "app" key;
/// the frontend owns the shape so new options don't require schema changes.
#[tauri::command]
pub fn get_settings(store: State<Store>) -> Result<Option<String>, String> {
    store.get_setting("app")
}

#[tauri::command]
pub fn set_settings(store: State<Store>, value: String) -> Result<(), String> {
    store.set_setting("app", &value)
}

/// Re-registers the global summon hotkey live. The choice itself is persisted in
/// the settings JSON by the frontend; this just applies it immediately.
#[tauri::command]
pub fn set_hotkey(app: AppHandle, combo: String) -> Result<(), String> {
    crate::apply_hotkey(&app, &combo)
}

/// Simulates Ctrl+V in the previously captured foreground window. Returns
/// whether the paste actually reached a restored target window; `false` tells
/// the frontend to fall back to a "copied, paste manually" message.
#[tauri::command]
pub fn simulate_paste() -> Result<bool, String> {
    Ok(osbridge::simulate_paste())
}

/// Wipes every locally stored Loop (used by the "clear local data" setting).
#[tauri::command]
pub fn clear_assets(store: State<Store>) -> Result<(), String> {
    store.clear_assets()
}

/// Version + on-disk data location, shown in the About section.
#[derive(serde::Serialize)]
pub struct AppInfo {
    pub version: String,
    pub data_dir: String,
}

#[tauri::command]
pub fn app_info(app: AppHandle) -> Result<AppInfo, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("loops.db");
    Ok(AppInfo {
        version: app.package_info().version.to_string(),
        data_dir: dir.to_string_lossy().to_string(),
    })
}

// ---------------------------------------------------------------------------
// History & Favorites
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn record_usage(
    store: State<Store>,
    asset_id: String,
    variables: String,
) -> Result<(), String> {
    store.record_usage(&asset_id, &variables)
}

#[tauri::command]
pub fn list_recent(store: State<Store>, limit: usize) -> Result<Vec<String>, String> {
    store.list_recent_asset_ids(limit)
}

#[tauri::command]
pub fn get_use_count(store: State<Store>, asset_id: String) -> Result<i64, String> {
    store.get_asset_use_count(&asset_id)
}

#[tauri::command]
pub fn get_last_used(store: State<Store>, asset_id: String) -> Result<Option<String>, String> {
    store.get_last_used(&asset_id)
}

#[tauri::command]
pub fn set_favorite(store: State<Store>, asset_id: String, fav: bool) -> Result<(), String> {
    store.set_favorite(&asset_id, fav)
}

#[tauri::command]
pub fn list_favorites(store: State<Store>) -> Result<Vec<String>, String> {
    store.list_favorites()
}

// ---------------------------------------------------------------------------
// Variable Presets
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub values: serde_json::Value,
}

#[tauri::command]
pub fn list_presets(store: State<Store>, asset_id: String) -> Result<Vec<Preset>, String> {
    let rows = store.list_presets(&asset_id)?;
    rows.into_iter()
        .map(|(id, name, json)| {
            let values: serde_json::Value =
                serde_json::from_str(&json).unwrap_or(serde_json::Value::Object(Default::default()));
            Ok(Preset { id, name, values })
        })
        .collect()
}

#[tauri::command]
pub fn save_preset(
    store: State<Store>,
    asset_id: String,
    name: String,
    values: serde_json::Value,
) -> Result<Preset, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let json = serde_json::to_string(&values).map_err(|e| e.to_string())?;
    store.save_preset(&id, &asset_id, &name, &json)?;
    Ok(Preset { id, name, values })
}

#[tauri::command]
pub fn delete_preset(store: State<Store>, id: String) -> Result<(), String> {
    store.delete_preset(&id)
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
struct ExportEnvelope {
    version: u32,
    #[serde(rename = "exportedAt")]
    exported_at: String,
    loops: Vec<Asset>,
}

/// Exports the given asset IDs (or all if empty) as a JSON file.
/// Opens a native save-file dialog and writes to the chosen path.
#[tauri::command]
pub async fn export_assets(store: State<'_, Store>, ids: Vec<String>) -> Result<String, String> {
    let assets = if ids.is_empty() {
        store.list(Some("loop"))?
    } else {
        let mut out = Vec::new();
        for id in &ids {
            if let Some(a) = store.get(id)? {
                out.push(a);
            }
        }
        out
    };
    if assets.is_empty() {
        return Err("没有可导出的 Loop".to_string());
    }
    let count = assets.len();
    let envelope = ExportEnvelope {
        version: 1,
        exported_at: now_iso(),
        loops: assets,
    };
    let json = serde_json::to_string_pretty(&envelope).map_err(|e| e.to_string())?;

    let handle = rfd::AsyncFileDialog::new()
        .set_title("导出 Loop")
        .add_filter("Loops JSON", &["loops.json", "json"])
        .set_file_name("my-loops.loops.json")
        .save_file()
        .await;
    match handle {
        Some(file) => {
            let path = file.path();
            std::fs::write(path, &json).map_err(|e| e.to_string())?;
            Ok(format!("已导出 {} 个 Loop", count))
        }
        None => Err("cancelled".to_string()),
    }
}

/// Opens a native file dialog, reads a .loops.json file, and imports the
/// contained loops into the local library.
#[tauri::command]
pub async fn import_assets(store: State<'_, Store>) -> Result<String, String> {
    let handle = rfd::AsyncFileDialog::new()
        .set_title("导入 Loop")
        .add_filter("Loops JSON", &["loops.json", "json"])
        .pick_file()
        .await;
    let file = match handle {
        Some(f) => f,
        None => return Err("cancelled".to_string()),
    };
    let bytes = file.read().await;
    let text = String::from_utf8(bytes).map_err(|e| e.to_string())?;
    let envelope: ExportEnvelope =
        serde_json::from_str(&text).map_err(|e| format!("文件格式错误: {e}"))?;
    let mut imported = 0;
    for mut asset in envelope.loops {
        // Assign a new id to avoid collisions with existing assets.
        asset.id = uuid::Uuid::new_v4().to_string();
        let now = now_iso();
        asset.created_at = now.clone();
        asset.updated_at = now;
        asset.origin = "local".to_string();
        store.upsert(&asset)?;
        imported += 1;
    }
    Ok(format!("已导入 {} 个 Loop", imported))
}

// ---------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedLoop {
    pub title: String,
    pub description: String,
    pub goal: String,
    pub instructions: String,
    pub stop_condition: String,
    pub max_iterations: u32,
    #[serde(default)]
    pub output_format: String,
    #[serde(default)]
    pub constraints: String,
    #[serde(default)]
    pub context: String,
    #[serde(default)]
    pub examples: String,
    pub trigger_keyword: String,
    pub tags: Vec<String>,
    pub variables: Vec<GeneratedVariable>,
}

#[derive(Serialize, Deserialize)]
pub struct GeneratedVariable {
    pub name: String,
    pub label: String,
    #[serde(rename = "type")]
    pub var_type: String,
    pub required: bool,
    #[serde(default)]
    pub default: String,
}

const SYSTEM_PROMPT: &str = r#"You are a Loop generator for a desktop AI tool manager called "Loops Desktop".
A Loop is a reusable, goal-directed, iterative AI agent routine.

Given a user's description, generate a well-structured Loop with:
- title: concise Chinese name (4-10 chars)
- description: one-line Chinese description
- goal: what the loop achieves, may use {{variable}} placeholders
- instructions: step-by-step Chinese instructions for the AI, may use {{variable}} placeholders
- stopCondition: when to stop iterating
- maxIterations: reasonable default (1-20)
- outputFormat: required output shape in Chinese (e.g. "markdown 列表", "纯 JSON", "只输出代码，不要解释")
- constraints: guardrails in Chinese — what the AI must NOT do (e.g. "不要修改测试文件；不要引入新依赖")
- context: what context the user should provide before running, in Chinese (e.g. "选中的代码", "失败的测试日志")
- examples: one short few-shot input/output example in Chinese ("输入：…\n输出：…"); empty string if not useful
- triggerKeyword: short English slash-command keyword (lowercase, no spaces)
- tags: 1-3 English tags
- variables: array of template variables used in goal/instructions (each has name, label in Chinese, type as "text"|"path"|"enum"|"number", required boolean, default string)

Respond with ONLY valid JSON matching this schema, no markdown fences, no extra text."#;

fn build_openai_body(
    model: &str,
    prompt: &str,
) -> serde_json::Value {
    serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": prompt }
        ],
        "temperature": 0.7,
        "max_tokens": 2048
    })
}

fn build_anthropic_body(
    model: &str,
    prompt: &str,
) -> serde_json::Value {
    serde_json::json!({
        "model": model,
        "max_tokens": 2048,
        "system": SYSTEM_PROMPT,
        "messages": [
            { "role": "user", "content": prompt }
        ]
    })
}

fn build_gemini_body(prompt: &str) -> serde_json::Value {
    serde_json::json!({
        "contents": [
            {
                "role": "user",
                "parts": [{ "text": format!("{}\n\nUser request: {}", SYSTEM_PROMPT, prompt) }]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2048
        }
    })
}

fn extract_json(text: &str) -> Result<GeneratedLoop, String> {
    let trimmed = text.trim();
    // Strip markdown code fences if present.
    let json_str = if trimmed.starts_with("```") {
        let inner = trimmed
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();
        inner
    } else {
        trimmed
    };
    serde_json::from_str::<GeneratedLoop>(json_str)
        .map_err(|e| format!("Failed to parse AI response as JSON: {e}\n\nRaw: {json_str}"))
}

// ---------------------------------------------------------------------------
// Generic chat completion (in-app Loop runner)
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "user" | "assistant"
    pub content: String,
}

/// Sends a multi-turn conversation to the configured AI provider and returns
/// the assistant's reply text. Powers the in-app Loop runner ("试跑").
#[tauri::command]
pub async fn chat_complete(
    system: String,
    messages: Vec<ChatMessage>,
    provider: String,
    api_key: String,
    model: Option<String>,
    base_url: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    match provider.as_str() {
        "anthropic" => {
            let m = model.as_deref().unwrap_or("claude-sonnet-4-20250514");
            let url = base_url
                .as_deref()
                .unwrap_or("https://api.anthropic.com/v1/messages");
            let msgs: Vec<serde_json::Value> = messages
                .iter()
                .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
                .collect();
            let body = serde_json::json!({
                "model": m,
                "max_tokens": 4096,
                "system": system,
                "messages": msgs
            });
            let resp = client
                .post(url)
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            let status = resp.status();
            let text = resp.text().await.map_err(|e| format!("Read body failed: {e}"))?;
            if !status.is_success() {
                return Err(format!("Anthropic API error ({status}): {text}"));
            }
            let v: serde_json::Value =
                serde_json::from_str(&text).map_err(|e| format!("Parse response failed: {e}"))?;
            Ok(v["content"][0]["text"].as_str().unwrap_or("").to_string())
        }
        "gemini" => {
            let m = model.as_deref().unwrap_or("gemini-2.5-flash");
            let url = base_url.unwrap_or_else(|| {
                format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"
                )
            });
            let contents: Vec<serde_json::Value> = messages
                .iter()
                .map(|m| {
                    let role = if m.role == "assistant" { "model" } else { "user" };
                    serde_json::json!({ "role": role, "parts": [{ "text": m.content }] })
                })
                .collect();
            let body = serde_json::json!({
                "systemInstruction": { "parts": [{ "text": system }] },
                "contents": contents,
                "generationConfig": { "temperature": 0.7, "maxOutputTokens": 4096 }
            });
            let resp = client
                .post(&url)
                .query(&[("key", &api_key)])
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            let status = resp.status();
            let text = resp.text().await.map_err(|e| format!("Read body failed: {e}"))?;
            if !status.is_success() {
                return Err(format!("Gemini API error ({status}): {text}"));
            }
            let v: serde_json::Value =
                serde_json::from_str(&text).map_err(|e| format!("Parse response failed: {e}"))?;
            Ok(v["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .unwrap_or("")
                .to_string())
        }
        // "openai" | "deepseek" | "custom" and anything else: OpenAI-compatible
        _ => {
            let default_url = match provider.as_str() {
                "deepseek" => "https://api.deepseek.com/v1/chat/completions",
                _ => "https://api.openai.com/v1/chat/completions",
            };
            let url = base_url.as_deref().unwrap_or(default_url);
            let default_model = match provider.as_str() {
                "deepseek" => "deepseek-chat",
                _ => "gpt-4o-mini",
            };
            let m = model.as_deref().unwrap_or(default_model);
            let mut msgs = vec![serde_json::json!({ "role": "system", "content": system })];
            msgs.extend(
                messages
                    .iter()
                    .map(|m| serde_json::json!({ "role": m.role, "content": m.content })),
            );
            let body = serde_json::json!({
                "model": m,
                "messages": msgs,
                "temperature": 0.7,
                "max_tokens": 4096
            });
            let resp = client
                .post(url)
                .header("Authorization", format!("Bearer {api_key}"))
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            let status = resp.status();
            let text = resp.text().await.map_err(|e| format!("Read body failed: {e}"))?;
            if !status.is_success() {
                return Err(format!("API error ({status}): {text}"));
            }
            let v: serde_json::Value =
                serde_json::from_str(&text).map_err(|e| format!("Parse response failed: {e}"))?;
            Ok(v["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or("")
                .to_string())
        }
    }
}

// ---------------------------------------------------------------------------
// Fabric pattern import (github.com/danielmiessler/fabric)
// ---------------------------------------------------------------------------

const FABRIC_REPO: &str = "danielmiessler/fabric";
const FABRIC_UA: &str = "loops-desktop";

/// Lists the pattern names in the fabric repo (each pattern is a directory
/// containing a system.md prompt).
#[tauri::command]
pub async fn fetch_fabric_patterns() -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    for dir in ["data/patterns", "patterns"] {
        let url = format!("https://api.github.com/repos/{FABRIC_REPO}/contents/{dir}");
        let resp = client
            .get(&url)
            .header("User-Agent", FABRIC_UA)
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| format!("Request failed: {e}"))?;
        if !resp.status().is_success() {
            continue;
        }
        let v: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Parse response failed: {e}"))?;
        let names: Vec<String> = v
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter(|e| e["type"].as_str() == Some("dir"))
                    .filter_map(|e| e["name"].as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        if !names.is_empty() {
            return Ok(names);
        }
    }
    Err("无法获取 Fabric patterns 列表（GitHub API 不可达或结构已变化）".to_string())
}

/// Fetches a single pattern's system.md prompt text.
#[tauri::command]
pub async fn fetch_fabric_pattern(name: String) -> Result<String, String> {
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("非法的 pattern 名称".to_string());
    }
    let client = reqwest::Client::new();
    for dir in ["data/patterns", "patterns"] {
        let url = format!(
            "https://raw.githubusercontent.com/{FABRIC_REPO}/main/{dir}/{name}/system.md"
        );
        let resp = client
            .get(&url)
            .header("User-Agent", FABRIC_UA)
            .send()
            .await
            .map_err(|e| format!("Request failed: {e}"))?;
        if resp.status().is_success() {
            return resp.text().await.map_err(|e| format!("Read body failed: {e}"));
        }
    }
    Err(format!("无法获取 pattern「{name}」的 system.md"))
}

#[tauri::command]
pub async fn generate_loop(
    prompt: String,
    provider: String,
    api_key: String,
    model: Option<String>,
    base_url: Option<String>,
) -> Result<GeneratedLoop, String> {
    let client = reqwest::Client::new();

    let response_text = match provider.as_str() {
        "anthropic" => {
            let m = model.as_deref().unwrap_or("claude-sonnet-4-20250514");
            let url = base_url
                .as_deref()
                .unwrap_or("https://api.anthropic.com/v1/messages");
            let body = build_anthropic_body(m, &prompt);
            let resp = client
                .post(url)
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            let status = resp.status();
            let text = resp.text().await.map_err(|e| format!("Read body failed: {e}"))?;
            if !status.is_success() {
                return Err(format!("Anthropic API error ({status}): {text}"));
            }
            let v: serde_json::Value = serde_json::from_str(&text)
                .map_err(|e| format!("Parse response failed: {e}"))?;
            v["content"][0]["text"]
                .as_str()
                .unwrap_or("")
                .to_string()
        }
        "gemini" => {
            let m = model.as_deref().unwrap_or("gemini-2.5-flash");
            let url = base_url.unwrap_or_else(|| {
                format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"
                )
            });
            let body = build_gemini_body(&prompt);
            let resp = client
                .post(&url)
                .query(&[("key", &api_key)])
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            let status = resp.status();
            let text = resp.text().await.map_err(|e| format!("Read body failed: {e}"))?;
            if !status.is_success() {
                return Err(format!("Gemini API error ({status}): {text}"));
            }
            let v: serde_json::Value = serde_json::from_str(&text)
                .map_err(|e| format!("Parse response failed: {e}"))?;
            v["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .unwrap_or("")
                .to_string()
        }
        // "openai" | "deepseek" | "custom" and anything else: OpenAI-compatible
        _ => {
            let default_url = match provider.as_str() {
                "deepseek" => "https://api.deepseek.com/v1/chat/completions",
                _ => "https://api.openai.com/v1/chat/completions",
            };
            let url = base_url.as_deref().unwrap_or(default_url);
            let default_model = match provider.as_str() {
                "deepseek" => "deepseek-chat",
                _ => "gpt-4o-mini",
            };
            let m = model.as_deref().unwrap_or(default_model);
            let body = build_openai_body(m, &prompt);
            let resp = client
                .post(url)
                .header("Authorization", format!("Bearer {api_key}"))
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            let status = resp.status();
            let text = resp.text().await.map_err(|e| format!("Read body failed: {e}"))?;
            if !status.is_success() {
                return Err(format!("API error ({status}): {text}"));
            }
            let v: serde_json::Value = serde_json::from_str(&text)
                .map_err(|e| format!("Parse response failed: {e}"))?;
            v["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or("")
                .to_string()
        }
    };

    extract_json(&response_text)
}
