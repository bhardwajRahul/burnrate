declare module '@cred/neopop-web/lib/components' {
  import type { ComponentType } from 'react';
  export const Button: ComponentType<any>;
  export const Typography: ComponentType<any>;
  export const ElevatedCard: ComponentType<any>;
  export const InputField: ComponentType<any>;
  export const Tag: ComponentType<any>;
  export const SearchBar: ComponentType<any>;
  export const Dropdown: ComponentType<any>;
  export const Row: ComponentType<any>;
  export const Column: ComponentType<any>;
  export const HorizontalSpacer: ComponentType<any>;
  export const VerticalSpacer: ComponentType<any>;
}

declare module '@cred/neopop-web/lib/components/Typography/types' {
  export enum FontType {
    HEADING = 'heading',
    CAPS = 'caps',
    BODY = 'body',
    SERIF_HEADING = 'serif-heading',
  }
  export enum FontWeights {
    EXTRA_BOLD = 800,
    BOLD = 700,
    SEMI_BOLD = 600,
    MEDIUM = 500,
    REGULAR = 400,
    THIN = 300,
  }
}
