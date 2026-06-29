import type { Asset, AssetDraft, LoopPayload } from "../types/asset";

// Bundled "platform" loops shown in the Discover tab. These mirror what a
// remote marketplace would serve (origin = "platform"), but ship locally so the
// browse/import flow works without a backend. Importing one clones it into the
// user's local library as a fresh, editable loop.
//
// Keep these distinct from the wizard's starter templates: these are richer,
// community-style loops a user discovers and adopts rather than blank starting
// points.

function loop(
  partial: Omit<Asset, "createdAt" | "updatedAt" | "origin" | "stats"> &
    Partial<Pick<Asset, "stats">>,
): Asset {
  return {
    ...partial,
    origin: "platform",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    stats: partial.stats ?? { copies: 0, likes: 0 },
  };
}

export const DISCOVER_LOOPS: Asset[] = [
  loop({
    id: "platform-commitmsg",
    kind: "loop",
    title: "提交信息生成器",
    slug: "commit-message",
    description: "根据已暂存的改动生成规范的 Conventional Commits 提交信息。",
    category: "git",
    tags: ["git", "commit"],
    visibility: "public",
    author: "loops",
    version: "1.0.0",
    variables: [
      {
        name: "scope",
        label: "可选范围 (scope)",
        type: "text",
        required: false,
        default: "",
        options: [],
      },
    ],
    triggers: [{ trigger: "/", keyword: "commitmsg" }],
    scope: { appliesTo: ["all"] },
    payload: {
      goal: "为当前已暂存的改动生成一条清晰、规范的提交信息。",
      instructions:
        "查看已暂存的 diff，按 Conventional Commits 规范输出：`type(scope): 简述`。type 取 feat/fix/docs/refactor/test/chore 之一{{scope}}。首行不超过 72 字，必要时补充要点列表说明动机与影响。",
      stopCondition: "提交信息符合规范且准确概括改动。",
      maxIterations: 3,
    } as LoopPayload,
    stats: { copies: 1284, likes: 342 },
  }),
  loop({
    id: "platform-prdesc",
    kind: "loop",
    title: "PR 描述撰写",
    slug: "pr-description",
    description: "把一组改动整理成结构化、可读的 Pull Request 描述。",
    category: "git",
    tags: ["git", "review"],
    visibility: "public",
    author: "loops",
    version: "1.0.0",
    variables: [
      {
        name: "base",
        label: "目标分支",
        type: "text",
        required: true,
        default: "main",
        options: [],
      },
    ],
    triggers: [{ trigger: "/", keyword: "prdesc" }],
    scope: { appliesTo: ["all"] },
    payload: {
      goal: "为相对 {{base}} 的改动写一份高质量 PR 描述。",
      instructions:
        "审阅 `{{base}}` 到当前分支的差异，输出：Summary（做了什么、为什么）、主要改动要点、风险与回滚方式、测试说明。面向没看过代码的评审者，避免逐行复述 diff。",
      stopCondition: "描述覆盖动机、改动、风险与测试。",
      maxIterations: 4,
    } as LoopPayload,
    stats: { copies: 731, likes: 198 },
  }),
  loop({
    id: "platform-translate",
    kind: "loop",
    title: "技术文案翻译润色",
    slug: "translate-polish",
    description: "在中英之间翻译并润色技术文案，保留术语与代码。",
    category: "writing",
    tags: ["writing", "i18n"],
    visibility: "public",
    author: "loops",
    version: "1.0.0",
    variables: [
      {
        name: "lang",
        label: "目标语言",
        type: "enum",
        required: true,
        default: "English",
        options: ["English", "中文"],
      },
    ],
    triggers: [{ trigger: "/", keyword: "translate" }],
    scope: { appliesTo: ["all"] },
    payload: {
      goal: "把所选文本翻译并润色为 {{lang}}。",
      instructions:
        "将文本翻译为 {{lang}}，保持技术术语准确、语气专业自然；代码块、命令、标识符保持原样不翻译。先给译文，再用一行说明你调整了哪些表达。",
      stopCondition: "译文准确、地道，且未改动代码与术语。",
      maxIterations: 3,
    } as LoopPayload,
    stats: { copies: 642, likes: 121 },
  }),
  loop({
    id: "platform-sqltune",
    kind: "loop",
    title: "SQL 查询优化",
    slug: "sql-tune",
    description: "分析慢查询，给出索引与改写建议。",
    category: "database",
    tags: ["sql", "perf"],
    visibility: "public",
    author: "loops",
    version: "1.0.0",
    variables: [
      {
        name: "engine",
        label: "数据库",
        type: "enum",
        required: true,
        default: "PostgreSQL",
        options: ["PostgreSQL", "MySQL", "SQLite"],
      },
    ],
    triggers: [{ trigger: "/", keyword: "sqltune" }],
    scope: { appliesTo: ["all"] },
    payload: {
      goal: "优化所选 {{engine}} 查询的性能。",
      instructions:
        "针对 {{engine}}：阅读查询与（如有）执行计划，定位全表扫描/低效连接/缺失索引等问题，给出改写后的 SQL 与建议的索引，并说明预期收益与权衡。",
      stopCondition: "给出可执行的优化方案并解释原因。",
      maxIterations: 5,
    } as LoopPayload,
    stats: { copies: 503, likes: 96 },
  }),
  loop({
    id: "platform-apireview",
    kind: "loop",
    title: "API 设计评审",
    slug: "api-design-review",
    description: "评审 REST/RPC 接口设计的一致性与健壮性。",
    category: "design",
    tags: ["api", "review"],
    visibility: "public",
    author: "loops",
    version: "1.0.0",
    variables: [],
    triggers: [{ trigger: "/", keyword: "apireview" }],
    scope: { appliesTo: ["all"] },
    payload: {
      goal: "评审所选 API 设计。",
      instructions:
        "从命名一致性、资源建模、状态码与错误结构、分页与过滤、版本化、幂等性与安全等维度审查接口，按『问题—影响—建议』列出，并给出改进后的示例。",
      stopCondition: "覆盖主要设计维度并给出可执行建议。",
      maxIterations: 4,
    } as LoopPayload,
    stats: { copies: 377, likes: 88 },
  }),
  loop({
    id: "platform-explain",
    kind: "loop",
    title: "代码讲解",
    slug: "explain-code",
    description: "把一段陌生代码讲清楚：做什么、怎么做、要注意什么。",
    category: "learning",
    tags: ["learning", "docs"],
    visibility: "public",
    author: "loops",
    version: "1.0.0",
    variables: [
      {
        name: "level",
        label: "讲解深度",
        type: "enum",
        required: true,
        default: "概览",
        options: ["概览", "逐行"],
      },
    ],
    triggers: [{ trigger: "/", keyword: "explain" }],
    scope: { appliesTo: ["all"] },
    payload: {
      goal: "以 {{level}} 的方式讲解所选代码。",
      instructions:
        "解释这段代码的用途、关键数据流与控制流、依赖与副作用、潜在坑点。{{level}} 为『逐行』时按行注释，为『概览』时只讲整体思路与要点。",
      stopCondition: "读者能理解代码意图与风险。",
      maxIterations: 3,
    } as LoopPayload,
    stats: { copies: 915, likes: 207 },
  }),
];

// Convert a platform loop into a fresh local draft for import (drops id /
// timestamps / stats / platform origin so the backend creates a new local loop).
export function discoverToDraft(asset: Asset): AssetDraft {
  return {
    kind: asset.kind,
    title: asset.title,
    slug: "",
    description: asset.description ?? "",
    category: asset.category ?? "",
    tags: [...asset.tags],
    visibility: "private",
    version: asset.version,
    variables: asset.variables.map((v) => ({ ...v, options: [...v.options] })),
    triggers: asset.triggers.map((t) => ({ ...t })),
    scope: { appliesTo: [...asset.scope.appliesTo] },
    payload: { ...(asset.payload as LoopPayload) },
  };
}
