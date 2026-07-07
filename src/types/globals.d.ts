type AppConnectUnknownRecord = Record<string, unknown>;

interface RCAdapterGlobal {
  alertMessage?: (payload: AppConnectUnknownRecord) => Promise<string> | string;
  dismissMessage?: (notificationId: string) => Promise<void> | void;
  getCallLog?: (payload: AppConnectUnknownRecord) => Promise<unknown>;
  getUnloggedCalls?: (...args: unknown[]) => Promise<{
    calls?: unknown[];
    hasMore?: boolean;
  }>;
  setAutoLog?: (settings: { call?: boolean; message?: boolean }) => void;
  showFeedback?: (options: {
    onFeedback?: (...args: unknown[]) => void;
  } & AppConnectUnknownRecord) => void;
  [key: string]: unknown;
}

interface RingCentralC2DWidget {
  on: (eventName: string, handler: (phoneNumber: string) => void) => void;
  update: (options: AppConnectUnknownRecord) => void;
  [key: string]: unknown;
}

interface RingCentralC2DInstance {
  widget: RingCentralC2DWidget;
  [key: string]: unknown;
}

interface RingCentralC2DConstructor {
  new(options: AppConnectUnknownRecord): RingCentralC2DInstance;
}

declare global {
  const RCAdapter: RCAdapterGlobal;

  interface Window {
    __ON_RC_POPUP_WINDOW?: 1;
    __e2eWidgetMessages?: Array<{
      message: unknown;
      targetOrigin: string;
    }>;
    RingCentralC2D?: RingCentralC2DConstructor;
    clickToDialInject?: RingCentralC2DInstance;
    clickToDialInstances?: RingCentralC2DInstance[];
    clickToDialObservers?: unknown[];
    clickToDialShadowRootPollers?: unknown[];
    __rcC2dAttachShadowPatched?: boolean;
  }
}

export {};
