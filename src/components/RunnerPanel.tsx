import { useEffect, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Asset, LoopPayload } from "../types/asset";
import { chatComplete, type ChatMessage } from "../lib/api";
import { getSettings, type AiSettings } from "../lib/settings";
import { showToast } from "./Toast";

// In-app Loop runner: executes the rendered loop against the configured AI
// provider, iterating (user-driven) until the stop condition is met or
// maxIterations is reached. The model signals completion by starting its
// reply with [DONE].
const DONE_MARK = "[DONE]";

function buildSystem(asset: Asset): string {
  const p = asset.payload as LoopPayload;
  const parts = [
    "你是一个执行 Loop（目标导向的迭代式 AI 例程）的智能代理。",
    `目标：${p.goal || asset.title}`,
  ];
  if (p.stopCondition) parts.push(`停止条件：${p.stopCondition}`);
  if (p.constraints) parts.push(`约束（禁止事项）：${p.constraints}`);
  if (p.outputFormat) parts.push(`输出格式要求：${p.outputFormat}`);
  parts.push(
    `请严格按用户提供的指令执行。每轮给出当前最佳结果；` +
      `当你判断停止条件已满足、无需继续迭代时，在回复的第一行输出 ${DONE_MARK}。`,
  );
  return parts.join("\n");
}

export default function RunnerPanel({
  asset,
  rendered,
}: {
  asset: Asset;
  rendered: string;
}) {
  const payload = asset.payload as LoopPayload;
  const maxIterations = payload.maxIterations || 5;
  const [ai, setAi] = useState<AiSettings | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getSettings().then((s) =>
      setAi(s.ai && s.ai.apiKey ? s.ai : null),
    );
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, running]);

  const iteration = messages.filter((m) => m.role === "assistant").length;

  const send = async (next: ChatMessage[]) => {
    if (!ai) return;
    setRunning(true);
    setError("");
    setMessages(next);
    try {
      // A per-loop model override takes precedence over the global setting.
      const reply = await chatComplete(buildSystem(asset), next, {
        ...ai,
        model: payload.model || ai.model,
      });
      const finished = reply.trimStart().startsWith(DONE_MARK);
      setMessages([...next, { role: "assistant", content: reply }]);
      if (finished) {
        setDone(true);
        showToast("Loop 已达成停止条件 ✓");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const start = () => {
    setDone(false);
    void send([{ role: "user", content: rendered }]);
  };

  const iterate = () => {
    void send([
      ...messages,
      {
        role: "user",
        content: `请继续迭代改进上面的结果（第 ${iteration + 1}/${maxIterations} 轮）。若停止条件已满足，请在第一行输出 ${DONE_MARK}。`,
      },
    ]);
  };

  if (ai === undefined) return null;
  if (ai === null) {
    return (
      <div className="runner">
        <p className="muted">
          试跑需要先在「设置 → AI 设置」中配置 API Key。
        </p>
      </div>
    );
  }

  return (
    <div className="runner">
      <div className="runner__head">
        <span className="runner__title">▶ 试跑（{ai.provider}）</span>
        <span className="muted">
          迭代 {iteration}/{maxIterations}
          {done && " · 已完成 ✓"}
        </span>
      </div>

      {messages.length > 0 && (
        <div className="runner__log">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`runner__msg runner__msg--${m.role}`}
            >
              <div className="runner__role">
                {m.role === "user" ? "输入" : `AI 第 ${messages.slice(0, i).filter((x) => x.role === "assistant").length + 1} 轮`}
              </div>
              <pre className="runner__content">{m.content}</pre>
              {m.role === "assistant" && (
                <button
                  className="btn btn--mini btn--ghost"
                  onClick={async () => {
                    await writeText(m.content.replace(DONE_MARK, "").trim());
                    showToast("已复制该轮结果");
                  }}
                >
                  复制
                </button>
              )}
            </div>
          ))}
          {running && <div className="runner__thinking">AI 思考中…</div>}
          <div ref={endRef} />
        </div>
      )}

      {error && <div className="dryrun-warn">⚠ {error}</div>}

      <div className="row">
        {messages.length === 0 ? (
          <button className="btn btn--primary" onClick={start} disabled={running}>
            开始试跑
          </button>
        ) : (
          <>
            <button
              className="btn btn--primary"
              onClick={iterate}
              disabled={running || done || iteration >= maxIterations}
              title={
                iteration >= maxIterations
                  ? "已达最大迭代次数"
                  : undefined
              }
            >
              继续迭代
            </button>
            <button className="btn btn--ghost" onClick={start} disabled={running}>
              重新开始
            </button>
          </>
        )}
      </div>
    </div>
  );
}
