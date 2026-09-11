// The contract of record for this plugin.
//
// Three surfaces read these key names — the Swift mapper, the Java mapper and the
// example harness — and none of them can detect a rename in the others: the contract
// between JavaScript and native is strings, so a renamed key leaves a flag with no
// effect and no error. scripts/check-option-keys.js compares all of them against this
// file, which is why the interfaces below are the source of truth rather than a
// convenience.

export type KhipuTheme = 'light' | 'dark' | 'system';

export type KhipuResultStatus = 'OK' | 'ERROR' | 'WARNING' | 'CONTINUE';

/** Hex colours, as `#rrggbb`. Every one is optional; the SDK has its own palette. */
export interface KhipuColors {
  lightBackground?: string;
  lightOnBackground?: string;
  lightPrimary?: string;
  lightOnPrimary?: string;
  lightTopBarContainer?: string;
  lightOnTopBarContainer?: string;
  darkBackground?: string;
  darkOnBackground?: string;
  darkPrimary?: string;
  darkOnPrimary?: string;
  darkTopBarContainer?: string;
  darkOnTopBarContainer?: string;
}

export interface KhipuOptions {
  /** Title for the top bar during the payment. */
  title?: string;
  /** URL of an image to show centred in the top bar. */
  titleImageUrl?: string;
  /**
   * Interface language, as an ISO 639-1 language and an ISO 3166 country, e.g. `es_CL`.
   *
   * Send it always. Left out, the language differs between platforms: KhipuClientIOS
   * defaults to `es_CL`, while khipu-client-android leaves it undefined and resolves it
   * from the device. Same payload, two languages.
   */
  locale?: string;
  theme?: KhipuTheme;
  /** Show a message with the Khipu logo at the bottom. */
  showFooter?: boolean;
  /** Show the merchant's logo in the top bar. */
  showMerchantLogo?: boolean;
  /** Show the payment code and a link to its details. */
  showPaymentDetails?: boolean;
  /** Skip the exit page at the end of the payment, successful or not. */
  skipExitPage?: boolean;
  /** Skip the exit page only when the payment succeeded. */
  skipExitSuccessPage?: boolean;
  colors?: KhipuColors;
}

export interface KhipuEvent {
  name: string;
  type: string;
  timestamp: string;
}

export interface KhipuResult {
  operationId: string;
  result: KhipuResultStatus;
  exitTitle: string;
  exitMessage: string;
  /**
   * Careful: this arrives as an empty string, not as null, on a real cancellation —
   * while `continueUrl` arrives as null. Check for falsiness, not for `=== null`.
   */
  exitUrl: string | null;
  failureReason: string | null;
  continueUrl: string | null;
  events: KhipuEvent[];
}

export interface KhipuCall {
  operationId: string;
  options?: KhipuOptions;
}

export interface KhipuPlugin {
  /**
   * Starts a payment. Called with callbacks, it returns nothing; called without them, it
   * returns a promise.
   *
   * The promise rejects, and the error callback fires, with a `KhipuResult` whose
   * `result` is `'ERROR'` — or with a string when the failure happened before the
   * operation started at all.
   */
  startOperation(
    call: KhipuCall,
    success: (result: KhipuResult) => void,
    error: (failure: KhipuResult | string) => void
  ): void;
  startOperation(call: KhipuCall): Promise<KhipuResult>;
}

declare global {
  interface Window {
    Khipu: KhipuPlugin;
  }
}

declare const Khipu: KhipuPlugin;

export default Khipu;
