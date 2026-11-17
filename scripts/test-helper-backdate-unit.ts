// Used by test-verification.ps1 to pretend a flat was last confirmed N days ago.
// Run from apps/api so its .env is found:
//   pnpm --dir apps/api exec tsx ../../scripts/test-helper-backdate-unit.ts <unitId> <days>
import { prisma } from "../apps/api/src/lib/prisma.ts";

const [unitId, days] = process.argv.slice(2);
await prisma.unit.update({
  where: { id: unitId },
  data: { availabilityConfirmedAt: new Date(Date.now() - Number(days) * 86_400_000) },
});
console.log(`backdated ${days}d`);
process.exit(0);
