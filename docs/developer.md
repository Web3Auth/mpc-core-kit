# MPC Core Kit — developer reference

Public API of `Web3AuthMPCCoreKit`. Types: `src/interfaces.ts`.

## Constructor

```ts
new Web3AuthMPCCoreKit(options: Web3AuthOptions)
```

| Param | Type | Required | Default | What it does |
|---|---|---|---|---|
| `web3AuthClientId` | `string` | yes | — | Dashboard client ID |
| `tssLib` | `TssLibType` | yes | — | Signing curve: `@toruslabs/tss-dkls-lib` (secp256k1) or `@toruslabs/tss-frost-lib` (ed25519) |
| `storage` | `IStorage \| IAsyncStorage` | yes | — | Persists device factor and `sessionId` |
| `web3AuthNetwork` | `WEB3AUTH_NETWORK` | | `MAINNET` | `DEVNET` or `MAINNET` |
| `uxMode` | `CoreKitMode` | | `"redirect"` | `"redirect"` \| `"popup"` \| `"nodejs"` \| `"react-native"` |
| `manualSync` | `boolean` | | `false` | If `true`, you must call `commitChanges()` after MFA/factor edits |
| `sessionTime` | `number` | | `86400` | Session and auth-signature TTL in seconds |
| `disableSessionManager` | `boolean` | | `false` | Skip session create/rehydrate. Signatures still expire at `sessionTime` |
| `disableHashedFactorKey` | `boolean` | | `false` | No cloud factor. First login stores a device factor; recovery needs another factor |
| `hashedFactorNonce` | `string` | | `web3AuthClientId` | Salt for the hashed factor. Share across apps to share MFA state |
| `baseUrl` | `string` | | `{origin}/serviceworker` | OAuth base. Redirect URI = `baseUrl/redirectPathName` |
| `redirectPathName` | `string` | | `"redirect"` | OAuth path |
| `useDKG` | `boolean` | | `true` | Distributed key gen. Not supported for ed25519 |
| `useClientGeneratedTSSKey` | `boolean` | | secp `false`, ed25519 `true` | Client-side TSS key. Required to export ed25519 seed |
| `enableLogging` | `boolean` | | `false` | Internal logs |
| `socketTransports` | `string[]` | | `['websocket','polling']` | TSS socket.io transports |
| `serverTimeOffset` | `number` | | `0` | Clock skew in seconds |

`storage`: `localStorage` / `sessionStorage` / `new MemoryStorage()` / `{ getItem, setItem }` (async, RN).

---

## Status

`coreKit.status`

| Value | Meaning |
|---|---|
| `NOT_INITIALIZED` | Call `init()` |
| `INITIALIZED` | Ready to login |
| `REQUIRED_SHARE` | Auth succeeded; call `inputFactorKey` with another factor |
| `LOGGED_IN` | Can sign |

---

## Methods

### `init(params?: InitParams): Promise<void>`

Builds tKey and the auth client. Then, if configured, finishes an OAuth redirect and/or restores a saved session. Call this before login.

| Param | Type | Default | What it does |
|---|---|---|---|
| `handleRedirectResult` | `boolean` | `true` | Complete OAuth when `uxMode` is `"redirect"` and the URL hash has a result |
| `rehydrate` | `boolean` | `true` | Restore a previous session from `storage` if `sessionId` is valid |

After a successful redirect or rehydrate, `status` is `LOGGED_IN` or `REQUIRED_SHARE` — do not login again.

**Rehydration:** if a previous login created a session, `init({ rehydrate: true })` restores it. Needs `disableSessionManager: false`, a `sessionId` in the same `storage`, and an unexpired session. Skipped when `disableSessionManager: true`, `rehydrate: false`, no/expired `sessionId`, or an OAuth redirect hash is present (`handleRedirectResult` runs instead). Restores `factorKey`, `postBoxKey`, `signatures`, `userInfo`, `tssShareIndex`, `tssPubKey`.

```ts
await coreKit.init(); // rehydrate: true by default

if (coreKit.status === COREKIT_STATUS.LOGGED_IN) {
  // session restored — skip login
} else {
  await coreKit.loginWithJWT({ verifier, verifierId, idToken });
}

// cold start
await coreKit.init({ rehydrate: false });
```

---

### `loginWithJWT(params: JWTLoginParams): Promise<void>`

Exchanges a JWT for a postbox key and sets up (or loads) the TSS account. Use for custom auth, Node, and React Native. Throws if already logged in or rehydrated.

New vs existing user is decided by whether metadata exists for that postbox key.

| Param | Type | Required | Default | What it does |
|---|---|---|---|---|
| `verifier` | `string` | yes | — | Dashboard verifier (aggregate: top-level name) |
| `verifierId` | `string` | yes | — | User id (`email`, `sub`, …) |
| `idToken` | `string` | yes | — | JWT from your IdP |
| `subVerifier` | `string` | | — | Sub-verifier name for aggregate verifiers |
| `extraVerifierParams` | `PasskeyExtraParams` | | — | WebAuthn / passkey extras |
| `additionalParams` | `ExtraParams` | | — | Extra fields sent with login |
| `prefetchTssPublicKeys` | `0–3` | | `1` | Prefetch TSS pubs. Set to factors you will create; `0` for existing users |
| `importTssKey` | `string` (hex) | | — | New users only: import an existing private key as the TSS key |
| `registerExistingSFAKey` | `boolean` | | — | New users only: convert an SFA user to TSS. Not with `importTssKey`. v1 SFA unsupported |

**New user** (no metadata): creates tKey and the first factor, then a session. Default hashed (cloud) factor → `LOGGED_IN` after one JWT. With `disableHashedFactorKey`, a device factor is stored locally; you may still need `inputFactorKey`. `importTssKey` / `registerExistingSFAKey` only work here.

```ts
await coreKit.init();
await coreKit.loginWithJWT({
  verifier,
  verifierId,
  idToken,
});
```

**Existing user** (metadata exists): hashed factor still valid → `LOGGED_IN`. MFA enabled or `disableHashedFactorKey` → `REQUIRED_SHARE` until `inputFactorKey`.

```ts
await coreKit.init();
await coreKit.loginWithJWT({ verifier, verifierId, idToken });

if (coreKit.status === COREKIT_STATUS.REQUIRED_SHARE) {
  const hex = await coreKit.getDeviceFactor(); // or backup / sq.recoverFactor(...)
  await coreKit.inputFactorKey(new BN(hex, "hex"));
}
```

---

### `loginWithOAuth(params: OAuthLoginParams): Promise<void>`

Opens Google (etc.) login in the browser. Not available in `nodejs` / `react-native`. Throws if already logged in.

In **redirect** mode the function returns immediately; `init()` or `handleRedirectResult()` finishes login. `importTssKey` and `registerExistingSFAKey` are not allowed in redirect mode.

**Single verifier:** `subVerifierDetails` (`typeOfLogin`, `verifier`, `clientId`), optional `importTssKey` / `registerExistingSFAKey`.

**Aggregate:** `aggregateVerifierIdentifier` + `subVerifierDetailsArray`, optional `aggregateVerifierType`.

```ts
await coreKit.loginWithOAuth({
  subVerifierDetails: {
    typeOfLogin: "google",
    verifier: "your-verifier",
    clientId: "GOOGLE_CLIENT_ID",
  },
});
```

---

### `handleRedirectResult(): Promise<void>`

Reads the OAuth redirect hash and completes login. `init()` already does this when `handleRedirectResult: true`.

```ts
await coreKit.init({ handleRedirectResult: false, rehydrate: true });
if (window.location.hash.includes("#state")) {
  await coreKit.handleRedirectResult();
}
```

---

### `inputFactorKey(factorKey: BN): Promise<void>`

Supplies a device, recovery, or security-question factor when `status === REQUIRED_SHARE`. Reconstructs tKey and creates a session. Source the hex from `getDeviceFactor()`, `mnemonicToKey`, or `recoverFactor`.

```ts
await coreKit.inputFactorKey(new BN(hex, "hex"));
```

---

### `enableMFA(params: EnableMFAParams, recoveryFactor = true): Promise<string>`

Turns a 1-factor (hashed/cloud) account into MFA: stores a device factor, deletes the hashed factor, and optionally creates a recovery factor. Returns the recovery hex — persist it. Empty string if `recoveryFactor` is `false`.

Hashed factor must still exist. If `manualSync` has pending edits, `commitChanges()` first.

| Param | Type | Default | What it does |
|---|---|---|---|
| `factorKey` | `BN` | generated | Private key for the recovery factor |
| `shareDescription` | `FactorKeyTypeShareDescription` | `Other` | Label stored on the recovery factor |
| `additionalMetadata` | `Record<string, string>` | | Extra labels |
| `recoveryFactor` | `boolean` | `true` | Create the backup factor |

```ts
const backupHex = await coreKit.enableMFA({});
const mnemonic = keyToMnemonic(backupHex); // persist this
if (manualSync) await coreKit.commitChanges();
```

---

### `createFactor(params: CreateFactorParams): Promise<string>`

Adds a DEVICE or RECOVERY factor and returns its hex key. Persist that key. Max 10 factors.

| Param | Type | Required | What it does |
|---|---|---|---|
| `shareType` | `TssShareType` | yes | `DEVICE` (2) or `RECOVERY` (3) |
| `factorKey` | `BN` | | Generated if omitted |
| `shareDescription` | `FactorKeyTypeShareDescription` | | Label: `HashedShare` \| `SecurityQuestions` \| `DeviceShare` \| `SeedPhrase` \| `PasswordShare` \| `SocialShare` \| `Other` |
| `additionalMetadata` | `Record<string, string>` | | Extra labels |

```ts
const { private: factorKey } = generateFactorKey();
await coreKit.createFactor({ shareType: TssShareType.DEVICE, factorKey });
const mnemonic = keyToMnemonic(factorKey.toString("hex"));
if (manualSync) await coreKit.commitChanges();
```

---

### `deleteFactor(factorPub: Point, factorKey?: BNString): Promise<void>`

Removes a factor. Cannot delete the last factor or the one currently in use. Pass `factorKey` to also delete its metadata backup.

```ts
const pubs = coreKit.getTssFactorPub();
const pub = Point.fromSEC1(factorKeyCurve, pubs[i]);
await coreKit.deleteFactor(pub);
if (manualSync) await coreKit.commitChanges();
```

### `getTssFactorPub(): string[]`

Returns compressed hex public keys of all factors. Use these with `deleteFactor`.

```ts
const pubs = coreKit.getTssFactorPub();
```

---

### `commitChanges(): Promise<void>`

Writes pending metadata to the network. Required after MFA/factor edits when `manualSync: true`.

```ts
await coreKit.commitChanges();
```

### `setManualSync(manualSync: boolean): Promise<void>`

Flushes pending writes, then turns manual sync on or off.

```ts
await coreKit.setManualSync(true);
```

---

### Signing

| Method | Params | Returns | What it does |
|---|---|---|---|
| `sign(data, hashed?, precompute?)` | `Buffer`, `hashed` default `false` | `Buffer` | TSS-signs. secp256k1: 65-byte `r\|\|s\|\|v`. ed25519: EdDSA |
| `setPreSigningHook(hook)` | `( { data, hashed } ) => { success }` | `void` | Abort signing if `success` is false |
| `precompute_secp256k1()` | — | `{ client, serverCoeffs }` | Warms TSS. Pass the result into the next `sign`. One-shot |
| `setTssWalletIndex(n)` | `number` | `void` | Switch HD account. secp256k1 only |
| `getPubKey()` | — | `Buffer` | Current account public key (SEC1) |
| `getPubKeyPoint()` | — | `Point` | Same key as a tKey point |
| `getPubKeyEd25519()` | — | `Buffer` | ed25519 public key |

`makeEthereumSigner(coreKit)` wraps `sign(..., true)` as `{ sign(msgHash), getPublic() }` for EVM providers.

```ts
// TSS ECDSA (secp256k1): hashes the bytes with keccak256, then signs. Returns 65-byte r||s||v.
const sig = await coreKit.sign(Buffer.from("hello signer!"));

// Sign with precomputed coefficients ( can be called before user calls sign)
// This will reduce the time if user calls sign later
const pre = await coreKit.precompute_secp256k1();
await coreKit.sign(msg, false, pre);

coreKit.setTssWalletIndex(1);
coreKit.getPubKey();
coreKit.setTssWalletIndex(0);

// Use with Web3 library like viem and etc.
// makeEthereumSigner calls sign(msgHash, true) — the provider already hashed.
const ethProvider = new EthereumSigningProvider({ config: { chainConfig } });
ethProvider.setupProvider(makeEthereumSigner(coreKit));
const web3 = new Web3(ethProvider);
await web3.eth.personal.sign("hello", (await web3.eth.getAccounts())[0], "");
```

---

### Session and account

| Method | Returns | What it does |
|---|---|---|
| `logout()` | `Promise<void>` | Ends the session and re-inits. Status is `INITIALIZED` (no rehydrate) |
| `getUserInfo()` | `UserInfo` | IdP claims and verifier |
| `getKeyDetails()` | `MPCKeyDetails` | Threshold, factor count, share descriptions, pubs |
| `getCurrentFactorKey()` | `{ factorKey, shareType }` | Factor currently used for TSS |
| `getDeviceFactor()` | `Promise<string \| undefined>` | Device factor hex from `storage` |
| `setDeviceFactor(factorKey, replace?)` | `Promise<void>` | Save a device factor. Throws if one exists unless `replace` |

```ts
coreKit.getUserInfo();
coreKit.getKeyDetails();
await coreKit.getDeviceFactor();
await coreKit.logout();
```

---

### Export (reconstructs the private key)

| Method | Returns | What it does |
|---|---|---|
| `_UNSAFE_exportTssKey()` | hex scalar | secp256k1 private key for the current account index |
| `_UNSAFE_exportTssEd25519Seed()` | `Buffer` | ed25519 seed. Needs client-generated or imported key |
| `_UNSAFE_recoverTssKey(factorKeys)` | hex | Reconstruct TSS key from DEVICE **and** RECOVERY factors. Same type twice fails |

Not recommended — these reconstruct the private key.

```ts
await coreKit._UNSAFE_exportTssKey();
await coreKit._UNSAFE_exportTssEd25519Seed();
await coreKit._UNSAFE_recoverTssKey([deviceHex, recoveryHex]);
```

---

## Helpers

| Export | What it does |
|---|---|
| `generateFactorKey()` | Random factor `{ private: BN, pub: Point }` |
| `keyToMnemonic(hex)` / `mnemonicToKey(mnemonic)` | Factor backup as BIP39 |
| `sigToRSV(sig)` | Split 65-byte secp256k1 sig into `{ r, s, v }` |
| `parseToken(jwt)` | Decode JWT payload |
| `MemoryStorage` | In-memory storage for tests / Node |
| `TssSecurityQuestion.setSecurityQuestion({ mpcCoreKit, question, answer, shareType? })` | Create a recovery factor from Q&A; returns factor hex |
| `TssSecurityQuestion.recoverFactor(coreKit, answer)` | Derive factor hex from the answer for `inputFactorKey` |
| `TssSecurityQuestion.getQuestion(coreKit)` | Return the stored question |
| `TssSecurityQuestion.changeSecurityQuestion({ mpcCoreKit, answer, newQuestion, newAnswer })` | Replace Q&A and rotate the factor |
| `TssSecurityQuestion.deleteSecurityQuestion(coreKit)` | Remove the Q&A factor |

This example uses a password (the answer) as the 2nd factor.

```ts
const sq = new TssSecurityQuestion();
await sq.setSecurityQuestion({ mpcCoreKit: coreKit, question, answer, shareType: TssShareType.RECOVERY });
const hex = await sq.recoverFactor(coreKit, answer);
await sq.changeSecurityQuestion({ mpcCoreKit: coreKit, answer, newQuestion, newAnswer });
await sq.deleteSecurityQuestion(coreKit);
```
