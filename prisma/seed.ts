/**
 * Prisma Seed Script
 * 
 * Creates the two demo organizations and their agent identities.
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Settlement Network database...');

  // Create demo organizations
  const nordic = await prisma.organization.upsert({
    where: { orgNumber: '556789-0123' },
    update: {
      companyCode: 'NORDIC',
      role: 'BOTH',
      iban: 'SE4250000000054920000002',
    },
    create: {
      name: 'Nordic Components AB',
      orgNumber: '556789-0123',
      companyCode: 'NORDIC',
      role: 'BOTH',
      country: 'SE',
      iban: 'SE4250000000054920000002',
    },
  });
  console.log(`  ✓ Organization: ${nordic.name} (code: NORDIC)`);

  const aurora = await prisma.organization.upsert({
    where: { orgNumber: '559123-4568' },
    update: {
      companyCode: 'AURORA',
      role: 'BOTH',
      iban: 'SE3350000000054910000001',
    },
    create: {
      name: 'Aurora Retail AB',
      orgNumber: '559123-4568',
      companyCode: 'AURORA',
      role: 'BOTH',
      country: 'SE',
      iban: 'SE3350000000054910000001',
    },
  });
  console.log(`  ✓ Organization: ${aurora.name} (code: AURORA)`);

  // Create a third demo company for broader testing
  const stellar = await prisma.organization.upsert({
    where: { orgNumber: '558456-7890' },
    update: {
      companyCode: 'STELLAR',
      role: 'BOTH',
      iban: 'SE5550000000054930000003',
    },
    create: {
      name: 'Stellar Logistics AB',
      orgNumber: '558456-7890',
      companyCode: 'STELLAR',
      role: 'BOTH',
      country: 'SE',
      iban: 'SE5550000000054930000003',
    },
  });
  console.log(`  ✓ Organization: ${stellar.name} (code: STELLAR)`);

  console.log('\n🎉 Seed complete! Companies can log in with codes: NORDIC, AURORA, STELLAR');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
