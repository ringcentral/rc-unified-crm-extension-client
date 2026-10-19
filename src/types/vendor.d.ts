declare module '@ringcentral/juno' {
  import type { ComponentType, ReactNode } from 'react';

  export const RcButton: ComponentType<Record<string, unknown>>;
  export const RcDrawer: ComponentType<Record<string, unknown>>;
  export const RcIcon: ComponentType<Record<string, unknown>>;
  export const RcIconButton: ComponentType<Record<string, unknown>>;
  export const RcLoading: ComponentType<Record<string, unknown>>;
  export const RcThemeProvider: ComponentType<{ children?: ReactNode } & Record<string, unknown>>;
  export const RcTextarea: ComponentType<Record<string, unknown>>;
}

declare module '@ringcentral/juno-icon' {
  export const ArrowDown2: unknown;
  export const ArrowUp2: unknown;
  export const Check: unknown;
  export const Feedback: unknown;
  export const Logout: unknown;
  export const Note: unknown;
  export const People: unknown;
  export const RcCloudContact: unknown;
  export const Settings: unknown;
}

declare module 'mixpanel-browser' {
  const mixpanel: {
    add_group: (...args: unknown[]) => void;
    identify: (...args: unknown[]) => void;
    init: (...args: unknown[]) => void;
    people: {
      set: (...args: unknown[]) => void;
    };
    reset: (...args: unknown[]) => void;
    set_group: (...args: unknown[]) => void;
    track: (...args: unknown[]) => void;
    track_pageview: (...args: unknown[]) => void;
  };

  export default mixpanel;
}
