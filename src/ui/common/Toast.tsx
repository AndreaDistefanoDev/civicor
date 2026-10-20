import { useEffect } from 'react';
import './common.css';

export interface ToastProps {
  message: string;
  action?: { label: string; onPress: () => void };
  onDismiss: () => void;
  durationMs?: number;
}

/** Avviso in alto che sparisce da solo; con un'azione opzionale (es. Annulla). */
export function Toast({ message, action, onDismiss, durationMs = 5000 }: ToastProps) {
  useEffect(() => {
    const id = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(id);
  }, [message, onDismiss, durationMs]);

  return (
    <div className="toast" role="status">
      <span className="toast-text">{message}</span>
      {action && (
        <button
          className="toast-action"
          onClick={() => {
            action.onPress();
            onDismiss();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
