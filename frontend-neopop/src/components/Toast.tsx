import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from 'lucide-react';
import { Typography } from '@cred/neopop-web/lib/components';
import { FontType } from '@cred/neopop-web/lib/components/Typography/types';

type ToastType = 'success' | 'error' | 'info' | 'loading';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'rgba(6, 194, 112, 0.12)',
    border: 'rgba(6, 194, 112, 0.4)',
    icon: '#06C270',
  },
  error: {
    bg: 'rgba(238, 77, 55, 0.12)',
    border: 'rgba(238, 77, 55, 0.4)',
    icon: '#EE4D37',
  },
  info: {
    bg: 'rgba(255, 135, 68, 0.12)',
    border: 'rgba(255, 135, 68, 0.4)',
    icon: '#FF8744',
  },
  loading: {
    bg: 'rgba(255, 135, 68, 0.12)',
    border: 'rgba(255, 135, 68, 0.4)',
    icon: '#FF8744',
  },
};

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  loading: Loader2,
};

let toastId = 0;
let addToastExternal: ((item: ToastItem) => void) | null = null;
let dismissExternal: ((id: string) => void) | null = null;

function ToastEntry({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    if (item.type !== 'loading' && item.duration > 0) {
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss(item.id), 300);
      }, item.duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [item, onDismiss]);

  const colors = TOAST_COLORS[item.type];
  const Icon = ICONS[item.type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        background: colors.bg,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        minWidth: 280,
        maxWidth: 420,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        transform: visible ? 'translateY(0)' : 'translateY(-20px)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
      }}
      onClick={() => {
        setVisible(false);
        setTimeout(() => onDismiss(item.id), 300);
      }}
    >
      <Icon
        size={20}
        color={colors.icon}
        style={item.type === 'loading' ? { animation: 'toast-spin 1s linear infinite' } : undefined}
      />
      <div style={{ flex: 1 }}>
        <Typography fontType={FontType.BODY} fontSize={14} color="rgba(255,255,255,0.9)">
          {item.message}
        </Typography>
      </div>
      <X
        size={14}
        color="rgba(255,255,255,0.4)"
        style={{ flexShrink: 0, cursor: 'pointer' }}
      />
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((item: ToastItem) => {
    setToasts((prev) => [...prev, item]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    addToastExternal = addToast;
    dismissExternal = dismiss;
    return () => {
      addToastExternal = null;
      dismissExternal = null;
    };
  }, [addToast, dismiss]);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((item) => (
        <div key={item.id} style={{ pointerEvents: 'auto' }}>
          <ToastEntry item={item} onDismiss={dismiss} />
        </div>
      ))}
      <style>{`@keyframes toast-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body
  );
}

function createToast(type: ToastType, message: string, duration = 4000): string {
  const id = `toast-${++toastId}`;
  addToastExternal?.({ id, message, type, duration });
  return id;
}

export const toast = {
  success: (message: string, duration?: number) => createToast('success', message, duration),
  error: (message: string, duration?: number) => createToast('error', message, duration ?? 5000),
  info: (message: string, duration?: number) => createToast('info', message, duration),
  loading: (message: string) => createToast('loading', message, 0),
  dismiss: (id: string) => dismissExternal?.(id),
};
