/**
 * The test project keeps the production DOM, Window, and RCAdapter contracts.
 * Chrome alone is widened at the Vitest boundary because test/setup installs a
 * deliberately partial, mutable API fake; production typecheck still uses the
 * complete @types/chrome contract.
 */
declare var chrome: any;

declare namespace chrome {
  namespace storage {
    type StorageChange = {
      newValue?: unknown;
      oldValue?: unknown;
    };
  }
}
