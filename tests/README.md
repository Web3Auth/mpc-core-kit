# Running the tests

The suite signs mock JWTs for the `torus-test-health` verifier, so it needs that verifier's
signing key. The key is **not** committed - supply it through the environment.

## Getting the credentials

Both values live in **1Password**. Grab them from there rather than asking a teammate to paste
them into Slack or a PR - they are shared test credentials, and anything pasted into a chat tends
to outlive the conversation.

| Variable | What it is |
| --- | --- |
| `JWT_PRIVATE_KEY` | PEM signing key for the `torus-test-health` test verifier |
| `JWT_KEY_ID` | `kid` of the matching JWKS entry |

If you cannot find the 1Password entry, ask the SDK team for access - do not generate your own key,
since the verifier only accepts the one whose public half is published in its JWKS.

## Local

Create a `.env` file in the repo root (it is gitignored):

```sh
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<test signing key>\n-----END PRIVATE KEY-----"
JWT_KEY_ID="<kid of the matching JWKS entry>"
```

`JWT_PRIVATE_KEY` accepts either a full PEM - newlines may be escaped as `\n`, which keeps it on a
single line - or just the bare base64 body. `JWT_KEY_ID` is optional; set it so the verifier can
select the right key out of a multi-key JWKS.

Then:

```sh
npm install
npm run test
```

## CI

`.github/workflows/test.yml` reads the same two variables from repository secrets, under
**Settings → Secrets and variables → Actions**.

Paste the value **without surrounding quotes**. Quotes are `.env` syntax that dotenv strips; GitHub
stores the secret verbatim, so stray quotes become part of the PEM and break key parsing.

Rotating the verifier key means updating the 1Password entry, the repository secrets, and every
local `.env`.

## Test identities

Test verifiers only accept identities ending in `@example.com`; anything else is rejected with
`test verifiers can only be used with test identities`. `toTestIdentity()` in `setup.ts` puts every
mock identity in that domain, so pass a bare name and let it normalise.

## Known failures

New key assignment is currently disabled server-side, so any test needing a brand-new secp256k1
identity fails with `new key assignment is temporarily disabled`. This affects the mainnet cases in
`gating.spec.ts` and `sessionTime.spec.ts`. It is a server-side flag, not a problem with your setup.
