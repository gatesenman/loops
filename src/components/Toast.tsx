import { useEffect, useState } from "react";

export interface ToastData {
  id: number;
  message: string;
  type?: "success" | "error" | "info";
}

let nextId = 0;
let addToastFn: ((t: ToastData) => void) | null = null;

export function showToast(message: string, type: ToastData["type"] = "success") {
  addToastFn?.({ id: nextId++, message, type });
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    addToastFn = (t) => setToasts((prev) => [...prev, t]);
    return () => { addToastFn = null; };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 2400);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type ?? "success"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
