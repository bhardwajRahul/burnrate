import { useEffect } from 'react';
import { Button, Typography } from '@cred/neopop-web/lib/components';
import {
    SelectableElevatedCard as ElevatedCard,
    TRANSPARENT_ELEVATED_CARD_EDGES,
} from '@/components/SelectableElevatedCard';
import { FontType, FontWeights } from '@cred/neopop-web/lib/components/Typography/types';
import { colorPalette, mainColors } from '@cred/neopop-web/lib/primitives';
import { CloseButton } from '@/components/CloseButton';

interface ConfirmModalProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onCancel]);

    if (!open) return null;

    const confirmColor =
        variant === 'danger'
            ? mainColors.red
            : variant === 'warning'
                ? colorPalette.warning[500]
                : mainColors.white;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                }}
                onClick={onCancel}
            />
            <ElevatedCard
                backgroundColor={colorPalette.black[90]}
                edgeColors={TRANSPARENT_ELEVATED_CARD_EDGES}
                style={{
                    padding: 0,
                    position: 'relative',
                    width: '100%',
                    maxWidth: 400,
                    maxHeight: 'none',
                    display: 'block',
                    backgroundColor: 'transparent',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <Typography
                        fontType={FontType.BODY}
                        fontSize={18}
                        fontWeight={FontWeights.BOLD}
                        color={mainColors.white}
                    >
                        {title}
                    </Typography>
                    <CloseButton onClick={onCancel} variant="modal" />
                </div>

                <div style={{ padding: '20px' }}>
                    <Typography
                        fontType={FontType.BODY}
                        fontSize={14}
                        fontWeight={FontWeights.REGULAR}
                        color="rgba(255,255,255,0.7)"
                        style={{ lineHeight: '1.5', whiteSpace: 'pre-line' }}
                    >
                        {message}
                    </Typography>
                </div>

                <div
                    style={{
                        padding: '12px 20px',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        gap: 12,
                        justifyContent: 'flex-end',
                    }}
                >
                    <Button
                        variant="primary"
                        kind="elevated"
                        size="small"
                        colorMode="dark"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant="secondary"
                        kind="elevated"
                        size="small"
                        colorMode="dark"
                        onClick={onConfirm}
                        style={{
                            color: confirmColor,
                            borderColor: variant === 'danger' ? 'rgba(238,77,55,0.4)' : undefined,
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </ElevatedCard>
        </div>
    );
}
