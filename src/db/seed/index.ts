import { seedTemplates } from './templates';

async function main() {
  console.log('[seed] Starting seed...');
  await seedTemplates();
  console.log('[seed] All seeds complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
