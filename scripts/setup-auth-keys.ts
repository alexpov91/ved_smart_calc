/**
 * Generate and set JWT auth keys for Convex self-hosted.
 *
 * Uses the admin API directly (not `npx convex env set`) to preserve
 * newlines in PEM keys — the CLI strips them, breaking RSA parsing.
 *
 * Usage: npx tsx scripts/setup-auth-keys.ts
 *
 * Reads CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY from .env.local
 */

import { generateKeyPairSync, createPublicKey, createPrivateKey } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv(): { url: string; adminKey: string } {
  const envPath = join(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found");
  }
  const content = readFileSync(envPath, "utf-8");
  const urlMatch = content.match(/CONVEX_SELF_HOSTED_URL\s*=\s*(.+)/);
  const keyMatch = content.match(/CONVEX_SELF_HOSTED_ADMIN_KEY\s*=\s*(.+)/);
  if (!urlMatch || !keyMatch) {
    throw new Error(
      "Missing CONVEX_SELF_HOSTED_URL or CONVEX_SELF_HOSTED_ADMIN_KEY in .env.local",
    );
  }
  return { url: urlMatch[1].trim(), adminKey: keyMatch[1].trim() };
}

async function main() {
  const { url, adminKey } = loadEnv();
  console.log(`Convex URL: ${url}`);

  // Check if keys already exist and work
  console.log("\nTesting existing keys...");
  const testResp = await fetch(`${url}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "auth:signIn",
      args: {
        provider: "password",
        params: {
          email: "test-key-check@nonexistent.example",
          password: "x",
          flow: "signIn",
        },
      },
      format: "json",
    }),
  });
  const testResult = await testResp.json();

  // If error is about user not found (not about key), keys are fine
  if (
    testResult.status === "error" &&
    !testResult.errorMessage?.includes("PrivateKey") &&
    !testResult.errorMessage?.includes("OIDC")
  ) {
    console.log("✓ Existing auth keys are valid. No action needed.");
    console.log(
      "  (Use --force flag to regenerate anyway)",
    );
    if (!process.argv.includes("--force")) {
      return;
    }
    console.log("  --force detected, regenerating...\n");
  } else {
    console.log("✗ Auth keys are missing or invalid. Generating new ones...\n");
  }

  // Generate RSA key pair
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // Validate key
  createPrivateKey(privateKey);
  console.log("✓ RSA 2048-bit key pair generated and validated");

  // Build JWKS from public key
  const pubKeyObj = createPublicKey(privateKey);
  const jwk = pubKeyObj.export({ format: "jwk" });
  (jwk as Record<string, string>).alg = "RS256";
  (jwk as Record<string, string>).use = "sig";
  (jwk as Record<string, string>).kid = "convex-auth-key";
  const jwks = JSON.stringify({ keys: [jwk] });

  // Set via admin API (preserves newlines in PEM, unlike `npx convex env set`)
  const resp = await fetch(`${url}/api/update_environment_variables`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${adminKey}`,
    },
    body: JSON.stringify({
      changes: [
        { name: "JWT_PRIVATE_KEY", value: privateKey.trim() },
        { name: "JWKS", value: jwks },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to set env vars: ${resp.status} ${errText}`);
  }
  console.log("✓ JWT_PRIVATE_KEY and JWKS set via admin API");

  // Verify
  await new Promise((r) => setTimeout(r, 2000));
  const verifyResp = await fetch(`${url}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "auth:signIn",
      args: {
        provider: "password",
        params: {
          email: "test-key-check@nonexistent.example",
          password: "x",
          flow: "signIn",
        },
      },
      format: "json",
    }),
  });
  const verifyResult = await verifyResp.json();

  if (
    verifyResult.errorMessage?.includes("PrivateKey") ||
    verifyResult.errorMessage?.includes("OIDC")
  ) {
    console.log("✗ Verification FAILED — keys still broken");
    process.exit(1);
  }

  console.log("✓ Verification passed — auth keys working\n");
  console.log(
    "Note: Existing user sessions will be invalidated. Users need to log in again.",
  );
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
