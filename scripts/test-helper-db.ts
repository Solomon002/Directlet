// Used by test-trust.ps1 for the things a test cannot do through the API.
// Run from apps/api so its .env is found:
//   pnpm --dir apps/api exec tsx ../../scripts/test-helper-db.ts <command> <args>
//     age-user <email> <days>        pretend the account was created that many days ago
//     expire-email-token <email>     make the user's confirmation link already expired
import { prisma } from "../apps/api/src/lib/prisma.ts";

const [command, a, b] = process.argv.slice(2);

if (command === "age-user") {
  await prisma.user.update({ where: { email: a }, data: { createdAt: new Date(Date.now() - Number(b) * 86_400_000) } });
} else if (command === "expire-email-token") {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: a }, select: { id: true } });
  await prisma.emailVerification.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
} else {
  throw new Error(`unknown command ${command}`);
}
console.log("done");
process.exit(0);
