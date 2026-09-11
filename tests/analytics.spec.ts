import assert from "assert";
import test from "node:test";

import {
  ANALYTICS_EVENTS,
  ANALYTICS_SDK_VERSION,
  Analytics,
  AnalyticsClient,
  consumeOAuthConnectionTrackData,
  getErrorAnalyticsProperties,
  getInputFactorFailureReason,
  OAUTH_CONNECTION_TRACK_STORAGE_KEY,
  persistOAuthConnectionTrackData,
  WEB3AUTH_NETWORK,
} from "../src";
import { version as packageVersion } from "../package.json";

test("analytics SDK version matches package.json", () => {
  assert.strictEqual(ANALYTICS_SDK_VERSION, packageVersion);
});

test("analytics identifies by client id and includes global properties", async () => {
  const identifyCalls: unknown[][] = [];
  const trackCalls: unknown[][] = [];
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://example.com" } },
  });

  try {
    const client = {
      identify: async (...args: unknown[]) => {
        identifyCalls.push(args);
      },
      track: async (...args: unknown[]) => {
        trackCalls.push(args);
      },
    } as unknown as AnalyticsClient;
    const analytics = new Analytics({
      clientFactory: async () => client,
    });
    analytics.setGlobalProperties({ sdk_name: "MPC Core Kit", duration: 99 });
    analytics.init();

    await analytics.identify("client-id", { web3auth_client_id: "client-id" });
    await analytics.track(ANALYTICS_EVENTS.CONNECTION_COMPLETED, { duration: 10 });

    assert.strictEqual(identifyCalls[0][0], "client-id");
    assert.deepStrictEqual(trackCalls[0], [
      ANALYTICS_EVENTS.CONNECTION_COMPLETED,
      { sdk_name: "MPC Core Kit", duration: 10 },
    ]);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("analytics sends events on all networks", async () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://example.com" } },
  });
  try {
    for (const network of [WEB3AUTH_NETWORK.DEVNET, WEB3AUTH_NETWORK.MAINNET]) {
      const trackCalls: unknown[][] = [];
      const analytics = new Analytics({
        clientFactory: async (): Promise<AnalyticsClient> =>
          ({
            identify: async (): Promise<void> => undefined,
            track: async (...args: unknown[]): Promise<void> => {
              trackCalls.push(args);
            },
          }) as unknown as AnalyticsClient,
      });
      analytics.setGlobalProperties({ web3auth_network: network });
      analytics.init();
      await analytics.track(ANALYTICS_EVENTS.CONNECTION_COMPLETED);
      assert.strictEqual(trackCalls[0][0], ANALYTICS_EVENTS.CONNECTION_COMPLETED);
      assert.deepStrictEqual(trackCalls[0][1], { web3auth_network: network });
    }
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("analytics skips insecure and local origins", async () => {
  const originalWindow = globalThis.window;
  try {
    for (const origin of ["http://example.com", "https://localhost", "https://127.0.0.1", "https://[::1]", "null"]) {
      let factoryCalled = false;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { location: { origin } },
      });
      const analytics = new Analytics({
        clientFactory: async () => {
          factoryCalled = true;
          return {} as AnalyticsClient;
        },
      });
      analytics.init();
      await analytics.track(ANALYTICS_EVENTS.SDK_INITIALIZATION_COMPLETED);
      assert.strictEqual(factoryCalled, false, `analytics should skip ${origin}`);
    }
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("analytics uses a thenable Segment client instead of the resolved tuple", async () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://example.com" } },
  });
  try {
    const trackCalls: unknown[][] = [];
    const client = {
      identify: async (): Promise<void> => undefined,
      track: async (...args: unknown[]): Promise<void> => {
        trackCalls.push(args);
      },
      then(onFulfilled?: (value: unknown) => unknown) {
        return Promise.resolve([this, {}]).then(onFulfilled);
      },
    };
    const analytics = new Analytics({
      clientFactory: async () => client as unknown as AnalyticsClient,
    });
    analytics.init();
    await analytics.track(ANALYTICS_EVENTS.CONNECTION_COMPLETED);
    assert.strictEqual(trackCalls[0][0], ANALYTICS_EVENTS.CONNECTION_COMPLETED);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("analytics skips when no browser window is available", async () => {
  const originalWindow = globalThis.window;
  let factoryCalled = false;
  Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
  try {
    const analytics = new Analytics({
      clientFactory: async () => {
        factoryCalled = true;
        return {} as AnalyticsClient;
      },
    });
    analytics.init();
    await analytics.track(ANALYTICS_EVENTS.SDK_INITIALIZATION_COMPLETED);
    assert.strictEqual(factoryCalled, false);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("analytics can be disabled and never propagates client errors", async () => {
  const disabledAnalytics = new Analytics({
    disabled: true,
    clientFactory: async () => {
      throw new Error("must not initialize");
    },
  });
  disabledAnalytics.init();
  await disabledAnalytics.track(ANALYTICS_EVENTS.CONNECTION_STARTED);

  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://example.com" } },
  });
  try {
    const failingAnalytics = new Analytics({
      clientFactory: async () =>
        ({
          identify: async () => {
            throw new Error("identify failed");
          },
          track: async () => {
            throw new Error("track failed");
          },
        }) as unknown as AnalyticsClient,
    });
    failingAnalytics.init();
    await assert.doesNotReject(() => failingAnalytics.identify("client-id"));
    await assert.doesNotReject(() => failingAnalytics.track(ANALYTICS_EVENTS.CONNECTION_STARTED));
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("input factor errors are split into user and infrastructure buckets", () => {
  assert.strictEqual(getInputFactorFailureReason({ code: 1207, message: "invalid factor" }), "invalid_factor");
  assert.strictEqual(getInputFactorFailureReason({ code: 1209, message: "metadata missing" }), "invalid_factor");
  assert.strictEqual(getInputFactorFailureReason(new Error("invalid factor key")), "invalid_factor");
  assert.strictEqual(getInputFactorFailureReason(new Error("network unavailable")), "infra_error");
});

test("analytics errors redact tokens and key material", () => {
  const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.VerySecretSignature";
  const key = "a".repeat(64);
  const email = "person@example.com";
  const properties = getErrorAnalyticsProperties(new Error(`token ${token} key ${key} email ${email}`));

  assert.strictEqual(properties.error_message.includes(token), false);
  assert.strictEqual(properties.error_message.includes(key), false);
  assert.strictEqual(properties.error_message.includes(email), false);
});

test("oauth connection track data survives a redirect and is consumed once", () => {
  const originalWindow = globalThis.window;
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        getItem: (key: string) => store.get(key) ?? null,
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    },
  });

  try {
    const trackData = {
      login_method: "oauth",
      verifier: "google-verifier",
      auth_connection: "google",
      is_aggregate_verifier: false,
    };
    persistOAuthConnectionTrackData(trackData);
    assert.ok(store.has(OAUTH_CONNECTION_TRACK_STORAGE_KEY));
    assert.deepStrictEqual(consumeOAuthConnectionTrackData(), trackData);
    assert.strictEqual(consumeOAuthConnectionTrackData(), undefined);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});
