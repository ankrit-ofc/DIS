import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ACTIVE_DISTRICTS = [
  { name: 'Kathmandu',  deliveryFee: 0,   active: true,  estimatedDays: 1 },
  { name: 'Lalitpur',   deliveryFee: 0,   active: true,  estimatedDays: 1 },
  { name: 'Bhaktapur',  deliveryFee: 0,   active: true,  estimatedDays: 1 },
  { name: 'Pokhara',    deliveryFee: 500, active: true,  estimatedDays: 2 },
  { name: 'Chitwan',    deliveryFee: 600, active: true,  estimatedDays: 2 },
  { name: 'Butwal',     deliveryFee: 700, active: true,  estimatedDays: 3 },
  { name: 'Biratnagar', deliveryFee: 800, active: true,  estimatedDays: 3 },
  { name: 'Birgunj',    deliveryFee: 700, active: true,  estimatedDays: 3 },
  { name: 'Dharan',     deliveryFee: 850, active: true,  estimatedDays: 3 },
  { name: 'Hetauda',    deliveryFee: 650, active: true,  estimatedDays: 2 },
];

const INACTIVE_DISTRICTS = [
  'Achham', 'Arghakhanchi', 'Baglung', 'Baitadi', 'Bajhang', 'Bajura',
  'Banke', 'Bara', 'Bardiya', 'Bhojpur', 'Dailekh', 'Dang', 'Darchula',
  'Dhading', 'Dhankuta', 'Dhanusa', 'Dolakha', 'Dolpa', 'Doti', 'Gorkha',
  'Gulmi', 'Humla', 'Ilam', 'Jajarkot', 'Jhapa', 'Jumla', 'Kailali',
  'Kalikot', 'Kaski', 'Kavrepalanchok', 'Khotang', 'Lamjung', 'Mahottari',
  'Makwanpur', 'Manang', 'Morang', 'Mugu', 'Mustang', 'Myagdi', 'Nawalpur',
  'Nuwakot', 'Okhaldhunga', 'Palpa', 'Panchthar', 'Parbat', 'Parsa',
  'Pyuthan', 'Ramechhap', 'Rasuwa', 'Rautahat', 'Rolpa', 'Rupandehi',
  'Salyan', 'Sankhuwasabha', 'Saptari', 'Sarlahi', 'Sindhuli',
  'Sindhupalchok', 'Siraha', 'Solukhumbu', 'Sunsari', 'Surkhet', 'Syangja',
  'Taplejung', 'Tehrathum', 'Udayapur',
];

async function main() {
  const isProd = process.env.NODE_ENV === 'production';
  const allowReset = process.env.SEED_RESET === '1';

  console.log(`Seeding database... (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);

  // ── 1. Delete all data (dev only, or prod with explicit opt-in) ───────────
  if (!isProd || allowReset) {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.emailLog.deleteMany();
    await prisma.orderActivity.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.ledger.deleteMany();
    await prisma.order.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.priceHistory.deleteMany();
    await prisma.customerNote.deleteMany();
    await prisma.session.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.district.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.setting.deleteMany();
    console.log('  Cleared existing data.');
  } else {
    console.log('  Skipping reset (prod — set SEED_RESET=1 to force).');
  }

  // In prod without reset, skip catalog seeding if it has already run once.
  const existingCategoryCount = await prisma.category.count();
  const skipCatalog = isProd && !allowReset && existingCategoryCount > 0;
  if (skipCatalog) {
    console.log('  Catalog data already present — skipping categories/districts/products/settings.');
  }

  // ── 2. Categories ──────────────────────────────────────────────────────────
  const catLiquor = skipCatalog
    ? await prisma.category.findFirstOrThrow({ where: { name: 'Liquor' } })
    : await prisma.category.create({ data: { name: 'Liquor', emoji: '🍶' } });
  const catBeer = skipCatalog
    ? await prisma.category.findFirstOrThrow({ where: { name: 'Beer' } })
    : await prisma.category.create({ data: { name: 'Beer', emoji: '🍺' } });
  const catEnergy = skipCatalog
    ? await prisma.category.findFirstOrThrow({ where: { name: 'Energy Drinks' } })
    : await prisma.category.create({ data: { name: 'Energy Drinks', emoji: '⚡' } });

  if (!skipCatalog) console.log('  Categories: 3');

  // ── 3. Profiles ────────────────────────────────────────────────────────────
  const adminPhone    = process.env.ADMIN_SEED_PHONE    ?? '9800000000';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? (isProd ? '' : 'admin123');
  if (isProd && !process.env.ADMIN_SEED_PASSWORD) {
    throw new Error('ADMIN_SEED_PASSWORD env var is required in production');
  }

  const existingAdmin = await prisma.profile.findUnique({ where: { phone: adminPhone } });
  if (!existingAdmin) {
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await prisma.profile.create({
      data: {
        phone: adminPhone,
        passwordHash: adminHash,
        role: 'ADMIN',
        ownerName: 'DISTRO Admin',
        phoneVerified: true,
        status: 'ACTIVE',
      },
    });
    console.log(`  Admin profile created (${adminPhone}).`);
  } else {
    console.log(`  Admin profile already exists (${adminPhone}) — left unchanged.`);
  }

  if (!isProd) {
    const buyerHash = await bcrypt.hash('distro123', 12);
    await prisma.profile.create({
      data: {
        phone: '9841100001',
        passwordHash: buyerHash,
        role: 'BUYER',
        storeName: 'Demo Store',
        ownerName: 'Demo Owner',
        district: 'Kathmandu',
        phoneVerified: true,
        status: 'ACTIVE',
      },
    });
    console.log('  Demo buyer profile created (9841100001).');
  } else {
    console.log('  Skipping demo buyer (prod).');
  }

  // ── 4. Districts ──────────────────────────────────────────────────────────
  if (!skipCatalog) {
    for (const d of ACTIVE_DISTRICTS) {
      await prisma.district.create({ data: d });
    }
    for (const name of INACTIVE_DISTRICTS) {
      await prisma.district.create({
        data: { name, active: false, estimatedDays: 5, deliveryFee: 0 },
      });
    }
    console.log(`  Districts: ${ACTIVE_DISTRICTS.length + INACTIVE_DISTRICTS.length} (${ACTIVE_DISTRICTS.length} active)`);
  }

  // ── 5. Products ───────────────────────────────────────────────────────────
  const liquorProducts = [
    { sku: '2.52',  name: '20-20 Red Apple 300ml',                    brand: '20-20',      price: 38.33,    mrp: 44.0,     moq: 30, unit: 'bottle 300ml',  stockQty: 500, description: 'Carton price: Rs 1,150' },
    { sku: '2.21',  name: '8848 Vodka 750ml',                         brand: '8848 Vodka', price: 2150,     mrp: 2472.5,   moq: 12, unit: 'bottle 750ml',  stockQty: 200, description: 'Carton price: Rs 25,800' },
    { sku: '2.42',  name: '8848 Vodka 375ml',                         brand: '8848 Vodka', price: 1075,     mrp: 1236.25,  moq: 24, unit: 'bottle 375ml',  stockQty: 200, description: 'Carton price: Rs 25,800' },
    { sku: '2.22',  name: '8848 Vodka 180ml',                         brand: '8848 Vodka', price: 537.5,    mrp: 618.13,   moq: 48, unit: 'bottle 180ml',  stockQty: 300, description: 'Carton price: Rs 25,800' },
    { sku: '2.40',  name: 'Mustang Black 180ml',                      brand: 'Mustang',    price: 1300,     mrp: 1495,     moq: 12, unit: 'bottle 180ml',  stockQty: 150, description: 'Carton price: Rs 15,600' },
    { sku: '2.50',  name: 'Mustang Black 375ml',                      brand: 'Mustang',    price: 1560,     mrp: 1794,     moq: 10, unit: 'bottle 375ml',  stockQty: 150, description: 'Carton price: Rs 15,600' },
    { sku: '2.60',  name: 'Mustang Black 750ml',                      brand: 'Mustang',    price: 2600,     mrp: 2990,     moq: 6,  unit: 'bottle 750ml',  stockQty: 100, description: 'Carton price: Rs 15,600' },
    { sku: '2.70',  name: 'Mustang Gold 180ml',                       brand: 'Mustang',    price: 1050,     mrp: 1207.5,   moq: 12, unit: 'bottle 180ml',  stockQty: 150, description: 'Carton price: Rs 12,600' },
    { sku: '2.80',  name: 'Mustang Gold 375ml',                       brand: 'Mustang',    price: 1260,     mrp: 1449,     moq: 10, unit: 'bottle 375ml',  stockQty: 150, description: 'Carton price: Rs 12,600' },
    { sku: '2.90',  name: 'Mustang Gold 750ml',                       brand: 'Mustang',    price: 2100,     mrp: 2415,     moq: 6,  unit: 'bottle 750ml',  stockQty: 100, description: 'Carton price: Rs 12,600' },
    { sku: '2.23',  name: 'Sagun Apple 330ml',                        brand: 'Sagun',      price: 96,       mrp: 110,      moq: 12, unit: 'bottle 330ml',  stockQty: 300, description: 'Carton price: Rs 1,150' },
    { sku: '2.55',  name: 'Signature Premier Grain Whiskey 180ml',    brand: 'Signature',  price: 604.17,   mrp: 694.8,    moq: 48, unit: 'bottle 180ml',  stockQty: 200, description: 'Carton price: Rs 29,000' },
    { sku: '2.54',  name: 'Signature Premier Grain Whiskey 375ml',    brand: 'Signature',  price: 1208.33,  mrp: 1389.58,  moq: 24, unit: 'bottle 375ml',  stockQty: 150, description: 'Carton price: Rs 29,000' },
    { sku: '2.53',  name: 'Signature Premier Grain Whiskey 750ml',    brand: 'Signature',  price: 2416.67,  mrp: 2779.17,  moq: 12, unit: 'bottle 750ml',  stockQty: 100, description: 'Carton price: Rs 29,000' },
    { sku: '2.40b', name: 'Signature Premier Whisky 1000ml',          brand: 'Signature',  price: 3111.11,  mrp: 3577.78,  moq: 9,  unit: 'bottle 1000ml', stockQty: 80,  description: 'Carton price: Rs 28,000' },
    { sku: '2.59',  name: 'Signature Rare Whiskey 180ml',             brand: 'Signature',  price: 583.33,   mrp: 670.83,   moq: 48, unit: 'bottle 180ml',  stockQty: 200, description: 'Carton price: Rs 28,000' },
    { sku: '2.58',  name: 'Signature Rare Whiskey 375ml',             brand: 'Signature',  price: 1166.67,  mrp: 1341.67,  moq: 24, unit: 'bottle 375ml',  stockQty: 150, description: 'Carton price: Rs 28,000' },
    { sku: '2.57',  name: 'Signature Rare Whiskey 750ml',             brand: 'Signature',  price: 2333.33,  mrp: 2683.33,  moq: 12, unit: 'bottle 750ml',  stockQty: 100, description: 'Carton price: Rs 28,000' },
    { sku: '2.39',  name: 'Signature Rare Whisky 1000ml',             brand: 'Signature',  price: 3000,     mrp: 3450,     moq: 9,  unit: 'bottle 1000ml', stockQty: 80,  description: 'Carton price: Rs 27,000' },
  ];

  const beerProducts = [
    { sku: '2.16',  name: 'Barahsinghe Pilsner 330ml',         brand: 'Barahsinghe', price: 187.5,  mrp: 215.63, moq: 24, unit: 'bottle 330ml', stockQty: 500, description: 'Carton price: Rs 4,500' },
    { sku: '2.17',  name: 'Barahsinghe Pilsner 650ml',         brand: 'Barahsinghe', price: 370.83, mrp: 426.46, moq: 12, unit: 'bottle 650ml', stockQty: 400, description: 'Carton price: Rs 4,450' },
    { sku: '2.18',  name: 'Barahsinghe Super Strong 650ml',    brand: 'Barahsinghe', price: 275,    mrp: 316.25, moq: 12, unit: 'bottle 650ml', stockQty: 400, description: 'Carton price: Rs 3,300' },
    { sku: '2.34',  name: 'Carlsberg 650ml',                   brand: 'Carlsberg',   price: 447.5,  mrp: 514.63, moq: 12, unit: 'bottle 650ml', stockQty: 300, description: 'Carton price: Rs 5,370' },
    { sku: '2.10',  name: 'Carlsberg Can 500ml',               brand: 'Carlsberg',   price: 346,    mrp: 397.9,  moq: 12, unit: 'can 500ml',    stockQty: 300, description: 'Carton price: Rs 4,150' },
    { sku: '2.35',  name: 'Gorkha Extra Strong 330ml',         brand: 'Gorkha',      price: 167.5,  mrp: 192.63, moq: 24, unit: 'bottle 330ml', stockQty: 500, description: 'Carton price: Rs 4,020' },
    { sku: '2.20b', name: 'Gorkha Strong 650ml',               brand: 'Gorkha',      price: 322.5,  mrp: 370.88, moq: 12, unit: 'bottle 650ml', stockQty: 400, description: 'Carton price: Rs 3,870' },
    { sku: '2.30',  name: 'Gorkha Strong Can 500ml',           brand: 'Gorkha',      price: 245.83, mrp: 282.71, moq: 12, unit: 'can 500ml',    stockQty: 400, description: 'Carton price: Rs 2,950' },
    { sku: '2.56',  name: 'Gorkha Strong Unfiltered 330ml',    brand: 'Gorkha',      price: 167.92, mrp: 193.11, moq: 24, unit: 'bottle 330ml', stockQty: 300, description: 'Carton price: Rs 4,030' },
    { sku: '2.20',  name: 'Nepal Ice Strong 650ml',            brand: 'Nepal Ice',   price: 304.17, mrp: 349.8,  moq: 12, unit: 'bottle 650ml', stockQty: 400, description: 'Carton price: Rs 3,650' },
    { sku: '2.45',  name: 'Nepal Ice Extra Strong 330ml',      brand: 'Nepal Ice',   price: 156.25, mrp: 179.69, moq: 24, unit: 'bottle 330ml', stockQty: 500, description: 'Carton price: Rs 3,750' },
    { sku: '2.46',  name: 'Nepal Ice Can 500ml',               brand: 'Nepal Ice',   price: 229.17, mrp: 263.55, moq: 12, unit: 'can 500ml',    stockQty: 400, description: 'Carton price: Rs 2,750' },
    { sku: '2.38',  name: 'Tuborg 330ml',                      brand: 'Tuborg',      price: 197.92, mrp: 227.61, moq: 24, unit: 'bottle 330ml', stockQty: 500, description: 'Carton price: Rs 4,750' },
    { sku: '2.14',  name: 'Tuborg 650ml',                      brand: 'Tuborg',      price: 404.17, mrp: 464.8,  moq: 12, unit: 'bottle 650ml', stockQty: 300, description: 'Carton price: Rs 4,850' },
    { sku: '2.15',  name: 'Tuborg Can 500ml',                  brand: 'Tuborg',      price: 304.17, mrp: 349.8,  moq: 12, unit: 'can 500ml',    stockQty: 300, description: 'Carton price: Rs 3,650' },
  ];

  const energyProducts = [
    { sku: '4.80', name: 'Max Tiger 250ml',  brand: 'Max Tiger', price: 74.17,  mrp: 85.3,   moq: 24, unit: 'can 250ml', stockQty: 500, description: 'Carton price: Rs 1,780' },
    { sku: '4.90', name: 'Max Tiger 330ml',  brand: 'Max Tiger', price: 95.83,  mrp: 110.2,  moq: 24, unit: 'can 330ml', stockQty: 500, description: 'Carton price: Rs 2,300' },
    { sku: '2.41', name: 'Red Bull 250ml',   brand: 'Red Bull',  price: 85.42,  mrp: 98.23,  moq: 24, unit: 'can 250ml', stockQty: 400, description: 'Carton price: Rs 2,050' },
    { sku: '2.44', name: 'Red Bull 330ml',   brand: 'Red Bull',  price: 110.42, mrp: 126.98, moq: 24, unit: 'can 330ml', stockQty: 400, description: 'Carton price: Rs 2,650' },
    { sku: '4.11', name: 'Xtreme 330ml',     brand: 'Xtreme',    price: 106.25, mrp: 122.19, moq: 24, unit: 'can 330ml', stockQty: 500, description: 'Carton price: Rs 2,550' },
  ];

  // Carton fields are derived from existing per-piece price * moq.
  // moq IS the pieces-per-carton in the legacy data, so this is a faithful translation.
  const withCartonFields = <T extends { price: number; moq: number }>(p: T) => ({
    ...p,
    piecesPerCarton: p.moq,
    pricePerCarton: Number((p.price * p.moq).toFixed(2)),
  });

  if (!skipCatalog) {
    for (const p of liquorProducts) {
      await prisma.product.create({ data: { ...withCartonFields(p), categoryId: catLiquor.id } });
    }
    for (const p of beerProducts) {
      await prisma.product.create({ data: { ...withCartonFields(p), categoryId: catBeer.id } });
    }
    for (const p of energyProducts) {
      await prisma.product.create({ data: { ...withCartonFields(p), categoryId: catEnergy.id } });
    }
    const total = liquorProducts.length + beerProducts.length + energyProducts.length;
    console.log(`  Products: ${total} (Liquor: ${liquorProducts.length}, Beer: ${beerProducts.length}, Energy: ${energyProducts.length})`);

    // ── 6. Announcement ─────────────────────────────────────────────────────
    await prisma.announcement.create({
      data: {
        text: "Welcome to DISTRO — Nepal's wholesale ordering platform. Free delivery in Kathmandu, Lalitpur and Bhaktapur!",
        active: true,
      },
    });

    // ── 7. Settings ─────────────────────────────────────────────────────────
    await prisma.setting.createMany({
      data: [
        { key: 'minOrderAmount', value: '1000' },
        { key: 'companyName',    value: 'DISTRO Nepal Pvt Ltd' },
        { key: 'vatRate',        value: '0.13' },
      ],
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
