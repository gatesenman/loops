import { useCallback, useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Visibility } from "../types/asset";
import {
  ACCENTS,
  AI_PROVIDERS,
  applyAccent,
  clearAssets,
  getAppInfo,
  HOTKEYS,
  saveSettings,
  setHotkey,
  type AiProvider,
  type AppInfo,
  type AppSettings,
  type HotkeyCombo,
} from "../lib/settings";
import { IconExternal, IconTrash } from "./icons";
import ConfirmDialog from "./ConfirmDialog";

const REFERENCE_URL = "https://loops.elorm.xyz/";

const VIS_OPTIONS: { id: Visibility; label: string }[] = [
  { id: "private", label: "私有" },
  { id: "unlisted", label: "未公开" },
  { id: "public", label: "公开" },
];

// The Settings surface: appearance, general, command-bar, and about sections.
// Every control writes through immediately so changes persist and (where
// relevant) take effect live.
export default function SettingsView({
  settings,
  onChange,
  onCleared,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onCleared: () => void;
}) {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void getAppInfo().then(setInfo);
  }, []);

  // Persist a patched settings object and lift it to the parent.
  // Debounces the SQLite write to avoid hammering the DB on every keystroke.
  const update = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    onChange(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveSettings(next), 300);
  }, [settings, onChange]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const pickAccent = (id: string) => {
    applyAccent(id);
    update({ accent: id });
  };

  const pickHotkey = async (combo: HotkeyCombo) => {
    await setHotkey(combo);
    update({ hotkey: combo });
  };

  const doClear = async () => {
    await clearAssets();
    setConfirmClear(false);
    onCleared();
  };

  return (
    <div className="settings">
      <section className="settings__group">
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">主题强调色</span>
            <span className="settings__desc">应用于高亮、选中与主按钮。</span>
          </div>
          <div className="settings__swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                className={`swatch ${settings.accent === a.id ? "is-active" : ""}`}
                style={{ background: a.accent }}
                title={a.label}
                aria-label={a.label}
                onClick={() => pickAccent(a.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="settings__group">
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">新建 Loop 默认可见性</span>
            <span className="settings__desc">
              新建或导入时的初始可见性，之后仍可单独切换。
            </span>
          </div>
          <div className="segmented">
            {VIS_OPTIONS.map((o) => (
              <button
                key={o.id}
                className={`segmented__item ${
                  settings.defaultVisibility === o.id ? "is-active" : ""
                }`}
                onClick={() => update({ defaultVisibility: o.id })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">全局唤起热键</span>
            <span className="settings__desc">在任意应用之上唤起命令栏。</span>
          </div>
          <select
            className="settings__select"
            value={settings.hotkey}
            onChange={(e) => pickHotkey(e.target.value as HotkeyCombo)}
          >
            {HOTKEYS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="settings__group">
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">AI 模型提供商</span>
            <span className="settings__desc">
              用于 AI 生成 Loop 功能。选择你的 AI 提供商并填入 API Key。
            </span>
          </div>
          <select
            className="settings__select"
            value={settings.ai?.provider ?? "openai"}
            onChange={(e) => {
              const provider = e.target.value as AiProvider;
              const defaultModel =
                AI_PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? "";
              update({
                ai: {
                  ...(settings.ai ?? { provider: "openai", apiKey: "" }),
                  provider,
                  model: defaultModel,
                  baseUrl: undefined,
                },
              });
            }}
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">API Key</span>
            <span className="settings__desc">你的 API 密钥，仅存储在本地。</span>
          </div>
          <input
            type="password"
            className="settings__input"
            style={{ width: 220, fontSize: 13, padding: "7px 11px" }}
            placeholder="sk-..."
            value={settings.ai?.apiKey ?? ""}
            onChange={(e) =>
              update({
                ai: {
                  ...(settings.ai ?? { provider: "openai", apiKey: "" }),
                  apiKey: e.target.value,
                },
              })
            }
          />
        </div>
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">模型名称</span>
            <span className="settings__desc">留空使用默认模型。</span>
          </div>
          <input
            className="settings__input"
            style={{ width: 220, fontSize: 13, padding: "7px 11px" }}
            placeholder={
              AI_PROVIDERS.find((p) => p.id === (settings.ai?.provider ?? "openai"))
                ?.defaultModel ?? ""
            }
            value={settings.ai?.model ?? ""}
            onChange={(e) =>
              update({
                ai: {
                  ...(settings.ai ?? { provider: "openai", apiKey: "" }),
                  model: e.target.value,
                },
              })
            }
          />
        </div>
        {(settings.ai?.provider === "custom") && (
          <div className="settings__row">
            <div className="settings__label">
              <span className="settings__name">Base URL</span>
              <span className="settings__desc">
                自定义 OpenAI 兼容 API 地址。
              </span>
            </div>
            <input
              className="settings__input"
              style={{ width: 280, fontSize: 13, padding: "7px 11px" }}
              placeholder="https://api.example.com/v1/chat/completions"
              value={settings.ai?.baseUrl ?? ""}
              onChange={(e) =>
                update({
                  ai: {
                    ...(settings.ai ?? { provider: "custom", apiKey: "" }),
                    baseUrl: e.target.value,
                  },
                })
              }
            />
          </div>
        )}
      </section>

      <section className="settings__group">
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">失焦时自动隐藏命令栏</span>
            <span className="settings__desc">
              点击其他应用或按 Esc 时自动收起浮框（输入法式）。
            </span>
          </div>
          <button
            role="switch"
            aria-checked={settings.hideOnBlur}
            className={`toggle ${settings.hideOnBlur ? "is-on" : ""}`}
            onClick={() => update({ hideOnBlur: !settings.hideOnBlur })}
          >
            <span className="toggle__knob" />
          </button>
        </div>
      </section>

      <section className="settings__group">
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">版本</span>
          </div>
          <span className="settings__value">{info?.version ?? "—"}</span>
        </div>
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">数据存储位置</span>
            <span className="settings__desc settings__path">
              {info?.dataDir ?? "—"}
            </span>
          </div>
        </div>
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">参考站点</span>
          </div>
          <button
            className="btn btn--ghost settings__link"
            onClick={() => void openUrl(REFERENCE_URL)}
          >
            loops.elorm.xyz <IconExternal />
          </button>
        </div>
        <div className="settings__row">
          <div className="settings__label">
            <span className="settings__name">清空本地数据</span>
            <span className="settings__desc">
              删除本机所有 Loop，此操作不可撤销。
            </span>
          </div>
          <button
            className="btn btn--danger settings__danger"
            onClick={() => setConfirmClear(true)}
          >
            <IconTrash /> 清空
          </button>
        </div>
      </section>

      {confirmClear && (
        <ConfirmDialog
          title="清空本地所有 Loop？"
          message="本机保存的全部 Loop 将被永久删除，无法恢复。"
          confirmLabel="清空"
          danger
          onConfirm={doClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
