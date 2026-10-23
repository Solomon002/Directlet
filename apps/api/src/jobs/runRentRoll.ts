// Runs the rent roll once and exits. Used for testing and for an external cron.
import { prisma } from "../lib/prisma";
import { runRentRoll } from "./rentRoll";

try {
  const result = await runRentRoll();
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
