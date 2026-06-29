import type { AssetDraft, LoopPayload, VariableSpec } from "../types/asset";

// A LoopTemplate is a ready-to-use starting point for a new Loop. The beginner
// wizard lists these so a first-time user can create a working loop in seconds
// instead of facing a blank form. Each template declares its template variables
// up front so the command-bar variable form works immediately.
export interface LoopTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  triggerKeyword: string;
  variables: VariableSpec[];
  payload: LoopPayload;
}

// Loops use the "/" slash command exclusively (other asset kinds do not bind to
// slash). The wizard always pairs these keywords with "/".
export const LOOP_TEMPLATES: LoopTemplate[] = [
  {
    id: "blank",
    name: "空白 Loop",
    description: "从零开始，自己填写目标与指令。",
    icon: "blank",
    tags: [],
    triggerKeyword: "",
    variables: [],
    payload: {
      goal: "",
      instructions: "",
      stopCondition: "",
      maxIterations: 10,
    },
  },
  {
    id: "fix-tests",
    name: "修复失败测试",
    description: "反复运行测试、定位并修复失败，直到全部通过。",
    icon: "test",
    tags: ["testing", "ci"],
    triggerKeyword: "fixtests",
    variables: [
      {
        name: "path",
        label: "测试路径",
        type: "path",
        required: true,
        default: "tests/",
        options: [],
      },
    ],
    payload: {
      goal: "让 {{path}} 下的所有测试通过。",
      instructions:
        "运行 {{path}} 的测试，阅读失败信息，做最小改动修复，重复直到全部通过。每轮简述你改了什么、为什么。",
      stopCondition: "所有测试以退出码 0 通过。",
      maxIterations: 10,
    },
  },
  {
    id: "code-review",
    name: "代码评审",
    description: "对一个改动/PR 做结构化评审，给出可执行建议。",
    icon: "review",
    tags: ["review"],
    triggerKeyword: "review",
    variables: [
      {
        name: "target",
        label: "评审对象",
        type: "text",
        required: true,
        default: "当前改动",
        options: [],
      },
    ],
    payload: {
      goal: "对 {{target}} 进行一次彻底的代码评审。",
      instructions:
        "审查 {{target}}：检查正确性、边界条件、错误处理、命名与可读性、测试覆盖、安全与性能。按『问题—影响—建议改法』列出，最严重的排在最前。",
      stopCondition: "已覆盖所有改动文件，且每条问题都给出明确建议。",
      maxIterations: 5,
    },
  },
  {
    id: "refactor",
    name: "安全重构",
    description: "在不改变行为的前提下重构一个模块，并用测试守护。",
    icon: "refactor",
    tags: ["refactor"],
    triggerKeyword: "refactor",
    variables: [
      {
        name: "module",
        label: "目标模块/文件",
        type: "path",
        required: true,
        default: "",
        options: [],
      },
    ],
    payload: {
      goal: "在不改变外部行为的前提下重构 {{module}}。",
      instructions:
        "先确保 {{module}} 有测试覆盖（缺则补）。小步重构：每步只做一类改动，随后运行测试确认行为不变。保持每次提交可回滚。",
      stopCondition: "重构完成且全部测试通过，外部行为不变。",
      maxIterations: 8,
    },
  },
  {
    id: "write-tests",
    name: "补写单元测试",
    description: "为指定文件补齐单元测试，覆盖主要分支。",
    icon: "check",
    tags: ["testing"],
    triggerKeyword: "writetests",
    variables: [
      {
        name: "path",
        label: "目标文件",
        type: "path",
        required: true,
        default: "",
        options: [],
      },
    ],
    payload: {
      goal: "为 {{path}} 编写覆盖主要分支的单元测试。",
      instructions:
        "阅读 {{path}}，识别公开函数与关键分支/边界条件，按项目现有测试风格补写测试用例，运行确保通过。",
      stopCondition: "新测试通过，且关键分支均被覆盖。",
      maxIterations: 6,
    },
  },
  {
    id: "debug",
    name: "定位并修复 Bug",
    description: "复现问题、定位根因、做最小修复并验证。",
    icon: "debug",
    tags: ["debug"],
    triggerKeyword: "debug",
    variables: [
      {
        name: "symptom",
        label: "问题现象",
        type: "text",
        required: true,
        default: "",
        options: [],
      },
    ],
    payload: {
      goal: "定位并修复以下问题：{{symptom}}。",
      instructions:
        "先稳定复现 {{symptom}}，再用二分/日志定位根因（先说明根因再改代码），做最小修复，最后验证问题消失且无回归。",
      stopCondition: "问题不再复现且相关测试通过。",
      maxIterations: 8,
    },
  },
  {
    id: "document",
    name: "生成文档",
    description: "为代码生成清晰的文档与使用示例。",
    icon: "doc",
    tags: ["docs"],
    triggerKeyword: "document",
    variables: [
      {
        name: "path",
        label: "目标文件/目录",
        type: "path",
        required: true,
        default: "",
        options: [],
      },
    ],
    payload: {
      goal: "为 {{path}} 生成清晰、准确的文档。",
      instructions:
        "阅读 {{path}}，说明其用途、公开接口、参数与返回、典型用法示例及注意事项，沿用项目既有文档风格。",
      stopCondition: "文档覆盖所有公开接口并附带可运行示例。",
      maxIterations: 5,
    },
  },
];

// Convert a template into an editable draft. The backend assigns id/timestamps.
export function templateToDraft(t: LoopTemplate): AssetDraft {
  return {
    kind: "loop",
    title: t.id === "blank" ? "" : t.name,
    slug: "",
    description: t.id === "blank" ? "" : t.description,
    category: "",
    tags: [...t.tags],
    visibility: "private",
    version: "1.0.0",
    variables: t.variables.map((v) => ({ ...v, options: [...v.options] })),
    triggers: t.triggerKeyword
      ? [{ trigger: "/", keyword: t.triggerKeyword }]
      : [],
    scope: { appliesTo: ["all"] },
    payload: { ...t.payload } as LoopPayload,
  };
}
