// Makes an existing account an admin, or takes admin away:
//   pnpm --filter @directlet/api admin:grant you@example.com
//   pnpm --filter @directlet/api admin:grant you@example.com --revoke
// Admin is never available through sign-up; only someone with database access
// (this script) can grant it. Sign up first (as a house hunter), then run this.
import { prisma } from "../lib/prisma";

const [email, flag] = process.argv.slice(2);

if (!email) {
  console.error("Usage: admin:grant <email> [--revoke]");
  process.exit(1);
}

try {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    console.error(`No account with the email ${email}. Sign up on the site first, then run this again.`);
    process.exitCode = 1;
  } else if (flag === "--revoke") {
    // Back to a plain house hunter account.
    await prisma.user.update({ where: { id: user.id }, data: { role: "HUNTER" } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    console.log(`${user.email} is no longer an admin (now a house hunter account).`);
  } else if (user.role === "LANDLORD" || user.role === "TENANT") {
    // Changing these would cut them off from their properties or tenancy.
    console.error(
      `${user.email} is a ${user.role.toLowerCase()} account. Use a separate account for admin, signed up as a house hunter.`,
    );
    process.exitCode = 1;
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN", suspendedAt: null } });
    // Sign them out so their next login carries the admin role.
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    console.log(`${user.email} is now an admin. Log in again and open /admin.`);
  }
} finally {
  await prisma.$disconnect();
}
