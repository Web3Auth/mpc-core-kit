import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(fs.readFileSync(path.join(scriptDir, "../package.json"), "utf8"));

const contents = `// Generated from package.json by scripts/sync-sdk-version.mjs. Do not edit.
export const ANALYTICS_SDK_VERSION = ${JSON.stringify(version)};
`;

fs.writeFileSync(path.join(scriptDir, "../src/sdkVersion.ts"), contents);
