// Used by test-viewings.ps1 to pretend a viewing was set for N days ago, so the
// "did not show up" rules can be tested without waiting.
// Run from apps/api so its .env is found:
//   pnpm --dir apps/api exec tsx ../../scripts/test-helper-backdate-viewing.ts <viewingId> <days>
import { prisma } from "../apps/api/src/lib/prisma.ts";

const [viewingId, days] = process.argv.slice(2);
await prisma.inspectionRequest.update({
  where: { id: viewingId },
  data: { scheduledFor: new Date(Date.now() - Number(days) * 86_400_000) },
});
console.log(`moved ${days}d back`);
process.exit(0);
