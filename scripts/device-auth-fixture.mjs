// Generates src-tauri/tests/device-auth-fixture.json using OpenClaw's own
// implementation (the installed npm package), so the Rust handshake is tested
// against the reference rather than against itself.
//
//   node scripts/device-auth-fixture.mjs [/path/to/openclaw]
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? "/opt/homebrew/lib/node_modules/openclaw";
const distDir = path.join(root, "dist");
const file = fs.readdirSync(distDir).find((f) => /^device-auth-.*\.mjs$/.test(f));
if (!file) throw new Error(`device-auth chunk not found in ${distDir}`);
const mod = await import(path.join(distDir, file));
const buildV3 = Object.values(mod).find(
  (fn) => typeof fn === "function" && fn.toString().includes('"v3"'),
);
if (!buildV3) throw new Error("buildDeviceAuthPayloadV3 not found");

const seed = Buffer.alloc(32, 7);
const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
const privateKey = crypto.createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
const publicRaw = crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32);

const deviceId = crypto.createHash("sha256").update(publicRaw).digest("hex");
const scopes = ["operator.read", "operator.write", "operator.admin", "operator.approvals"];
const payload = buildV3({
  deviceId,
  clientId: "openclaw-macos",
  clientMode: "ui",
  role: "operator",
  scopes,
  signedAtMs: 1737264000000,
  token: "shared-token",
  nonce: "nonce-123",
  platform: " MacOS ",
  deviceFamily: "Mac",
});
const signature = crypto.sign(null, Buffer.from(payload, "utf8"), privateKey).toString("base64url");

const out = path.join(import.meta.dirname, "..", "src-tauri", "tests", "device-auth-fixture.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify({ deviceId, publicKey: publicRaw.toString("base64url"), scopes, payload, signature }, null, 2) + "\n",
);
console.log(`wrote ${out}`);
