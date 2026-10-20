import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

const DEMO_LANDLORD_EMAIL = "demo@directlet.ng";
const DEMO_LANDLORD_PASSWORD = "DemoPass123!";

async function main() {
  const passwordHash = await hashPassword(DEMO_LANDLORD_PASSWORD);

  const landlord = await prisma.user.upsert({
    where: { email: DEMO_LANDLORD_EMAIL },
    update: {},
    create: {
      email: DEMO_LANDLORD_EMAIL,
      passwordHash,
      fullName: "Demo Landlord",
      role: "LANDLORD",
    },
  });

  const existingCount = await prisma.property.count({ where: { landlordId: landlord.id } });
  if (existingCount > 0) {
    console.log("Demo landlord already has properties, skipping seed.");
    return;
  }

  const properties = [
    {
      name: "Sunrise Villas",
      address: "15 Admiralty Way",
      area: "Lekki Phase 1",
      city: "Lagos",
      state: "Lagos",
      description: "Modern gated estate close to the Lekki toll gate.",
      units: [
        { label: "Flat A1", bedrooms: 2, bathrooms: 2, rentAmount: 2800000 },
        { label: "Flat A2", bedrooms: 3, bathrooms: 3, rentAmount: 3800000 },
      ],
    },
    {
      name: "Palm Court",
      address: "8 Herbert Macaulay Way",
      area: "Yaba",
      city: "Lagos",
      state: "Lagos",
      description: "Compact flats near Yabatech, popular with young professionals.",
      units: [
        { label: "Flat 1", bedrooms: 1, bathrooms: 1, rentAmount: 1200000 },
        { label: "Flat 2", bedrooms: 2, bathrooms: 2, rentAmount: 1800000 },
        { label: "Flat 3", bedrooms: 2, bathrooms: 2, rentAmount: 1800000 },
      ],
    },
    {
      name: "Golden Gate Apartments",
      address: "22 Allen Avenue",
      area: "Ikeja",
      city: "Lagos",
      state: "Lagos",
      description: "Well-maintained compound in the heart of Ikeja.",
      units: [
        { label: "Flat 101", bedrooms: 3, bathrooms: 2, rentAmount: 3200000 },
        { label: "Flat 102", bedrooms: 3, bathrooms: 2, rentAmount: 3200000 },
      ],
    },
  ];

  for (const { units, ...propertyData } of properties) {
    const property = await prisma.property.create({
      data: { ...propertyData, landlordId: landlord.id, isPublic: true },
    });

    for (const unit of units) {
      await prisma.unit.create({
        data: { ...unit, propertyId: property.id, rentFrequency: "ANNUAL" },
      });
    }

    console.log("Created " + property.name + " with " + units.length + " units.");
  }

  console.log("Seed complete. Demo landlord login: " + DEMO_LANDLORD_EMAIL + " / " + DEMO_LANDLORD_PASSWORD);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
