//! Core domain model shared with the frontend.
//!
//! `Asset` is the single stable abstraction for every reusable piece of AI
//! content. Concrete categories (loop, prompt, context, …) are distinguished by
//! `kind`; their category-specific data lives in `payload`. New categories are
//! added by introducing a new `kind` + a `payload` shape on the frontend — the
//! persistence layer here stays untouched, which is the whole point of the
//! abstraction.
//!
//! All structs serialize as camelCase so the JSON contract matches the
//! TypeScript types in `src/types/asset.ts` exactly.

use serde::{Deserialize, Serialize};

fn default_version() -> String {
    "1.0.0".to_string()
}

fn default_origin() -> String {
    "local".to_string()
}

/// A reusable AI asset. The category-specific body lives in `payload`, whose
/// shape is owned by the frontend and validated there; the backend treats it as
/// an opaque JSON document so adding a new `kind` never requires backend work.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    #[serde(default)]
    pub id: String,
    /// "loop" | "prompt" | "context" | "command" | "persona" | "snippet" | "rule"
    pub kind: String,
    pub title: String,
    pub slug: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    /// "private" | "unlisted" | "public"
    pub visibility: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default = "default_version")]
    pub version: String,
    /// Template variables used by quick-input (e.g. {{branch}}).
    #[serde(default)]
    pub variables: Vec<VariableSpec>,
    /// How the asset is summoned in the command bar (/, @, #, ! + keyword).
    #[serde(default)]
    pub triggers: Vec<TriggerBinding>,
    /// Which target AI apps this asset applies to (drives command-bar filtering).
    #[serde(default)]
    pub scope: ScopeRule,
    /// Category-specific content; shape depends on `kind` (see frontend union).
    #[serde(default)]
    pub payload: serde_json::Value,
    #[serde(default)]
    pub stats: Stats,
    /// "local" (created here) | "platform" (pulled from the marketplace).
    #[serde(default = "default_origin")]
    pub origin: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

/// A template variable surfaced as a quick-input field before injection.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariableSpec {
    pub name: String,
    #[serde(default)]
    pub label: Option<String>,
    /// "text" | "enum" | "file" | "path" | "number" | "boolean"
    #[serde(rename = "type")]
    pub var_type: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub default: Option<String>,
    #[serde(default)]
    pub options: Vec<String>,
}

/// Binds a trigger character + keyword so the command bar can route to it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerBinding {
    /// One of "/", "@", "#", "!".
    pub trigger: String,
    pub keyword: String,
}

/// Applicability scope. `applies_to` is either `["all"]` or a list of target
/// app ids; the command bar hides assets whose scope excludes the foreground
/// app.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeRule {
    pub applies_to: Vec<String>,
}

impl Default for ScopeRule {
    fn default() -> Self {
        Self {
            applies_to: vec!["all".to_string()],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    #[serde(default)]
    pub copies: u64,
    #[serde(default)]
    pub likes: u64,
}

/// A target AI application the command bar can detect and inject into.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetApp {
    pub id: String,
    pub display_name: String,
}
