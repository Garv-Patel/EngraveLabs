import type { ReactNode } from 'react';
import styles from './common.module.css';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  return (
    <div className={styles.overlay} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${wide ? styles.modalWide : ''}`} role="dialog" aria-label={title}>
        <div className={styles.modalHeader}>
          <h2>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}
