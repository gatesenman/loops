import { useState } from "react";
import type { LintReport } from "../lib/validate";

const ICONS = { pass: "✓", warn: "⚠", fail: "✕" } as const;

// Renders a loop's standardness/completeness checklist (from lintLoop) with a
// 0-100 score. Collapsed by default when everything passes.
export default function LintPanel({ report }: { report: LintReport }) {
  const allPass = report.fails === 0 && report.warns === 0;
  const [open, setOpen] = useState(!allPass);

  return (
    <div className={`lint lint--${report.fails > 0 ? "fail" : report.warns > 0 ? "warn" : "pass"}`}>
      <button className="lint__head" onClick={() => setOpen((v) => !v)}>
        <span className="lint__score">{report.score}</span>
        <span className="lint__title">
          规范检查
          {report.fails > 0 && ` · ${report.fails} 项不合格`}
          {report.warns > 0 && ` · ${report.warns} 项建议完善`}
          {allPass && " · 标准且完整 ✓"}
        </span>
        <span className="lint__toggle">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <ul className="lint__list">
          {report.items.map((it, i) => (
            <li key={i} className={`lint__item lint__item--${it.level}`}>
              <span className="lint__icon">{ICONS[it.level]}</span>
              <span className="lint__label">{it.label}</span>
              <span className="lint__msg">{it.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
