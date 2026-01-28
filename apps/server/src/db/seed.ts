import { ensureNichePacksFile } from "../services/plan/nichePacks.js";

async function main() {
  await ensureNichePacksFile();
  // eslint-disable-next-line no-console
  console.log("Seed complete: niche packs file ensured.");
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
