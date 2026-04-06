import { forwardRef } from 'react';
import { Plus } from 'lucide-react';
import { colorPalette } from '@cred/neopop-web/lib/primitives';
import styled from 'styled-components';

const accent = colorPalette.rss[500];

const Root = styled.button`
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
  border: 1px solid rgba(255, 135, 68, 0.45);
  border-radius: 8px;
  background: rgba(255, 135, 68, 0.12);
  color: ${accent};
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 135, 68, 0.22);
    border-color: rgba(255, 135, 68, 0.65);
    color: ${accent};
  }

  &:active:not(:disabled) {
    background: rgba(255, 135, 68, 0.28);
  }

  &:focus-visible {
    outline: 2px solid ${accent};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

export type PlusIconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'> & {
  'aria-label': string;
  iconSize?: number;
};

export const PlusIconButton = forwardRef<HTMLButtonElement, PlusIconButtonProps>(function PlusIconButton(
  { iconSize = 16, className, style, ...rest },
  ref,
) {
  return (
    <Root ref={ref} type="button" className={className} style={style} {...rest}>
      <Plus size={iconSize} strokeWidth={2} aria-hidden focusable={false} />
    </Root>
  );
});
