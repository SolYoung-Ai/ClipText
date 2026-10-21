import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * 轻量 Toast（toast）
 * 复制成功/失败、下载结果等操作反馈统一走这里。
 */

interface ToastItem {
  id: number;
  text: string;
  type: 'info' | 'error';
}

type ToastFn = (text: string, type?: 'info' | 'error') => void;

const ToastContext = createContext<ToastFn>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push: ToastFn = useCallback((text, type = 'info') => {
    const id = ++counter.current;
    setItems((prev) => [...prev.slice(-3), { id, text, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastContext);
}
