import { useEffect, useState } from 'react';
import styles from './common.module.css';

interface ToastMsg {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

let nextId = 1;
let listeners: ((t: ToastMsg) => void)[] = [];

export function showToast(text: string, kind: 'info' | 'error' = 'info'): void {
  const msg = { id: nextId++, text, kind };
  listeners.forEach((l) => l(msg));
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    const listener = (t: ToastMsg) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className={styles.toastHost}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${t.kind === 'error' ? styles.toastError : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
