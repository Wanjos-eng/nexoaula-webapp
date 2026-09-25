"use client";

import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./Toast.module.css";

export type ToastVariant = "success" | "error" | "info";

type ToastInput = {
  duration?: number;
  message: string;
  variant?: ToastVariant;
};

type ToastItem = Required<Pick<ToastInput, "message" | "variant">> & {
  id: number;
  closing: boolean;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => number;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());
  const exitTimers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);

    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, closing: true } : item,
      ),
    );

    if (exitTimers.current.has(id)) return;
    const exitTimer = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
      exitTimers.current.delete(id);
    }, 140);
    exitTimers.current.set(id, exitTimer);
  }, []);

  const showToast = useCallback(({ duration = 4000, message, variant = "info" }: ToastInput) => {
    const id = nextId.current++;
    setItems((current) => [...current, { closing: false, id, message, variant }]);
    const timer = window.setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
    return id;
  }, [dismiss]);

  useEffect(() => {
    const activeTimers = timers.current;
    const activeExitTimers = exitTimers.current;
    return () => {
      activeTimers.forEach((timer) => window.clearTimeout(timer));
      activeTimers.clear();
      activeExitTimers.forEach((timer) => window.clearTimeout(timer));
      activeExitTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div aria-label="Notificações" className={styles.viewport}>
        {items.map((item) => (
          <div
            className={[
              styles.toast,
              styles[item.variant],
              item.closing ? styles.leaving : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
          >
            <span aria-hidden className={styles.icon}>
              {item.variant === "success" ? (
                <CheckCircle size={20} weight="fill" />
              ) : item.variant === "error" ? (
                <WarningCircle size={20} weight="fill" />
              ) : (
                <Info size={20} weight="fill" />
              )}
            </span>
            <p>{item.message}</p>
            <button
              aria-label="Fechar notificação"
              className={styles.close}
              onClick={() => dismiss(item.id)}
              type="button"
            >
              <X aria-hidden size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de ToastProvider.");
  }
  return context;
}
