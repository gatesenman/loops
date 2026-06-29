// Domain model — mirrors the Rust structs in src-tauri/src/model.rs.
//
// `Asset` is the single stable abstraction for every reusable AI artifact.
// Categories are distinguished by `kind`; their category-specific body lives in
// `payload`, a discriminated union keyed by the same `kind`. Adding a new
// category = adding a new `AssetKind` + a new `*Payload` variant here. The
// backend stores `payload` as opaque JSON, so no backend change is needed.

export type AssetKind =
  | "loop"
  | "prompt"
  | "context"
  | "command"
  | "persona"
  | "snippet"
  | "rule";

export type Visibility = "private" | "unlisted" | "public";

export type Origin = "local" | "platform";

export type TriggerChar = "/" | "@" | "#" | "!";

export type VariableType =
  | "text"
  | "enum"
  | "file"
  | "path"
  | "number"
  | "boolean";

export interface VariableSpec {
  name: string;
  label?: string;
  type: VariableType;
  required: boolean;
  default?: string;
  options: string[];
}

export interface TriggerBinding {
  trigger: TriggerChar;
  keyword: string;
}

// Recognized AI applications. `all` means the asset is shown regardless of the
// foreground app; otherwise the command bar filters by the detected app id.
export type TargetAppId =
  | "all"
  | "claude-code"
  | "cursor"
  | "codex"
  | "gemini-cli"
  | "opencode"
  | "generic";

export interface ScopeRule {
  appliesTo: TargetAppId[];
}

export interface Stats {
  copies: number;
  likes: number;
}

// --- Category-specific payloads (discriminated union by `kind`) -------------

// A Loop is a goal-directed, iterative agent routine: a primary instruction
// run repeatedly until a stop condition, mirroring the reference site's loops.
export interface LoopPayload {
  goal: string;
  instructions: string;
  stopCondition?: string;
  maxIterations?: number;
  model?: string;
}

// Placeholder payloads for future categories — typed now so the union is
// stable, fully implemented in later milestones (M4).
export interface PromptPayload {
  body: string;
}

export interface ContextPayload {
  body: string;
}

export type AssetPayload =
  | LoopPayload
  | PromptPayload
  | ContextPayload
  | Record<string, unknown>;

export interface Asset {
  id: string;
  kind: AssetKind;
  title: string;
  slug: string;
  description?: string;
  category?: string;
  tags: string[];
  visibility: Visibility;
  author?: string;
  version: string;
  variables: VariableSpec[];
  triggers: TriggerBinding[];
  scope: ScopeRule;
  payload: AssetPayload;
  stats: Stats;
  origin: Origin;
  createdAt: string;
  updatedAt: string;
}

export interface TargetApp {
  id: string;
  displayName: string;
}

// A draft is what the editor builds before the backend assigns id/timestamps.
export type AssetDraft = Omit<
  Asset,
  "id" | "createdAt" | "updatedAt" | "stats" | "origin"
> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  stats?: Stats;
  origin?: Origin;
};
