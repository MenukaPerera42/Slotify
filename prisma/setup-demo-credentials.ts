import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const path = resolve(".env");
  let content = await readFile(path, "utf8");
  let generated = 0;
  for (const name of ["AUTH_SECRET", "SLOTIFY_DEMO_ADMIN_PASSWORD", "SLOTIFY_DEMO_MEMBER_PASSWORD"]) {
    const line = new RegExp(`^${name}=(.*)$`, "m");
    const match = content.match(line);
    if (match && match[1].trim() !== '""' && match[1].trim() !== "") continue;
    const value = randomBytes(32).toString("base64url");
    content = match ? content.replace(line, `${name}="${value}"`) : `${content.trimEnd()}\n${name}="${value}"\n`;
    generated++;
  }
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
  console.log(`${generated} missing local authentication secrets generated in ignored .env. Existing values were preserved.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Could not prepare local credentials.");
  process.exitCode = 1;
});
