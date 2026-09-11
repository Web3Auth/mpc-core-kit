import type { AnalyticsBrowser, EventProperties, UserTraits } from "@segment/analytics-next";

import { log } from "./utils";

// Public Segment *source* write key (write-only). This is the same key used by
// web3auth-web. It is not a secret: browser SDKs must ship it in the bundle.
// Mixpanel isolation is via sdk_name / web3auth_client_id, not a private key.
const SEGMENT_WRITE_KEY = "f6LbNqCeVRf512ggdME4b6CyflhF1tsX";

export const ANALYTICS_EVENTS = {
  SDK_INITIALIZATION_COMPLETED: "SDK Initialization Completed",
  SDK_INITIALIZATION_FAILED: "SDK Initialization Failed",
  CONNECTION_STARTED: "Connection Started",
  CONNECTION_COMPLETED: "Connection Completed",
  CONNECTION_FAILED: "Connection Failed",
  LOGIN_REQUIRED_SHARE: "Login Required Share",
  INPUT_FACTOR_STARTED: "Input Factor Started",
  INPUT_FACTOR_COMPLETED: "Input Factor Completed",
  INPUT_FACTOR_FAILED: "Input Factor Failed",
  MFA_ENABLEMENT_STARTED: "MFA Enablement Started",
  MFA_ENABLEMENT_COMPLETED: "MFA Enablement Completed",
  MFA_ENABLEMENT_FAILED: "MFA Enablement Failed",
  SESSION_REHYDRATION_COMPLETED: "Session Rehydration Completed",
  SESSION_REHYDRATION_FAILED: "Session Rehydration Failed",
  SESSION_CREATION_FAILED: "Session Creation Failed",
  LOGOUT_COMPLETED: "Logout Completed",
  LOGOUT_FAILED: "Logout Failed",
  FACTOR_CREATION_COMPLETED: "Factor Creation Completed",
  FACTOR_CREATION_FAILED: "Factor Creation Failed",
  FACTOR_DELETION_COMPLETED: "Factor Deletion Completed",
  FACTOR_DELETION_FAILED: "Factor Deletion Failed",
} as const;

export const ANALYTICS_SDK_NAME = "MPC Core Kit";
export const ANALYTICS_INTEGRATION_TYPE = "Native SDK";
export { ANALYTICS_SDK_VERSION } from "./sdkVersion";

export type InputFactorFailureReason = "invalid_factor" | "infra_error";

export type AnalyticsClient = Pick<AnalyticsBrowser, "identify" | "track">;
export type AnalyticsClientFactory = () => Promise<AnalyticsClient>;

export interface AnalyticsOptions {
  disabled?: boolean;
  clientFactory?: AnalyticsClientFactory;
}

function unwrapAnalyticsClient(client: AnalyticsClient): AnalyticsClient {
  // AnalyticsBrowser is PromiseLike<[Analytics, Context]>. An async factory
  // that returns it resolves to that tuple instead of the client. Returning a
  // plain object also prevents later `await client` from unwrapping it again.
  const value = client as AnalyticsClient | [AnalyticsClient, unknown];
  const resolved = Array.isArray(value) && value[0] && typeof value[0].track === "function" ? value[0] : client;
  return {
    identify: resolved.identify.bind(resolved),
    track: resolved.track.bind(resolved),
  };
}

export class Analytics {
  private client?: AnalyticsClient;

  private initializationPromise?: Promise<AnalyticsClient | undefined>;

  private globalProperties: Record<string, unknown> = {};

  private readonly disabled: boolean;

  private readonly clientFactory: AnalyticsClientFactory;

  public constructor(options: AnalyticsOptions) {
    this.disabled = Boolean(options.disabled);
    this.clientFactory =
      options.clientFactory ||
      (async () => {
        const { AnalyticsBrowser } = await import("@segment/analytics-next");
        const segment = new AnalyticsBrowser();
        await segment.load(
          { writeKey: SEGMENT_WRITE_KEY },
          {
            user: {
              cookie: { key: "web3auth_ajs_user_id" },
              localStorage: { key: "web3auth_ajs_user_traits" },
            },
            globalAnalyticsKey: "web3auth_analytics",
          }
        );
        // AnalyticsBrowser is a PromiseLike<[Analytics, Context]>, so returning it
        // directly from an async function would resolve to that tuple instead of the client.
        return {
          identify: segment.identify.bind(segment),
          track: segment.track.bind(segment),
        };
      });
  }

  public init(): void {
    if (this.isSkipped() || this.initializationPromise) return;

    this.initializationPromise = this.clientFactory()
      .then((client) => {
        this.client = unwrapAnalyticsClient(client);
        return this.client;
      })
      .catch((error: unknown): AnalyticsClient | undefined => {
        log.error("Failed to initialize analytics", error);
        return undefined;
      });
  }

  public setGlobalProperties(properties: Record<string, unknown>): void {
    this.globalProperties = { ...this.globalProperties, ...properties };
  }

  public async identify(userId: string, traits?: UserTraits): Promise<void> {
    if (this.isSkipped()) return;
    try {
      const client = await this.getClient();
      await client?.identify(userId, traits);
    } catch (error) {
      log.error(`Failed to identify client ${userId} in analytics`, error);
    }
  }

  public async track(event: string, properties?: EventProperties): Promise<void> {
    if (this.isSkipped()) return;
    try {
      const client = await this.getClient();
      await client?.track(event, { ...this.globalProperties, ...properties });
    } catch (error) {
      log.error(`Failed to track event ${event}`, error);
    }
  }

  private async getClient(): Promise<AnalyticsClient | undefined> {
    if (!this.initializationPromise) this.init();
    return this.client || this.initializationPromise;
  }

  private isSkipped(): boolean {
    if (this.disabled) return true;
    if (typeof window === "undefined") return true;
    const dappOrigin = window.location?.origin || "";
    try {
      const url = new URL(dappOrigin);
      return (
        url.protocol !== "https:" ||
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1" ||
        url.hostname === "[::1]"
      );
    } catch {
      return true;
    }
  }
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:0x)?[a-fA-F0-9]{64,}\b/g, "[REDACTED_KEY]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .slice(0, 500);
}

export const OAUTH_CONNECTION_TRACK_STORAGE_KEY = "web3auth_mpc_oauth_connection_track";

export function persistOAuthConnectionTrackData(trackData: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(OAUTH_CONNECTION_TRACK_STORAGE_KEY, JSON.stringify(trackData));
  } catch (error) {
    log.error("Failed to persist oauth connection track data", error);
  }
}

export function consumeOAuthConnectionTrackData(): Record<string, unknown> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(OAUTH_CONNECTION_TRACK_STORAGE_KEY);
    if (!raw) return undefined;
    window.sessionStorage.removeItem(OAUTH_CONNECTION_TRACK_STORAGE_KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown>;
  } catch (error) {
    log.error("Failed to consume oauth connection track data", error);
    return undefined;
  }
}

export function getErrorAnalyticsProperties(error: unknown): { error_code?: number | string; error_message: string } {
  const analyticsError = error as { code?: number | string; message?: string };
  const message = analyticsError?.message || String(error) || "Unknown error";
  return {
    ...(analyticsError?.code !== undefined ? { error_code: analyticsError.code } : {}),
    error_message: sanitizeErrorMessage(message),
  };
}

export function getInputFactorFailureReason(error: unknown): InputFactorFailureReason {
  const analyticsError = error as { code?: number; message?: string };
  if (
    analyticsError?.code === 1207 ||
    analyticsError?.code === 1209 ||
    /invalid factor\s*key/i.test(analyticsError?.message || "") ||
    analyticsError?.message?.toLowerCase().includes("no metadata found")
  ) {
    return "invalid_factor";
  }
  return "infra_error";
}
