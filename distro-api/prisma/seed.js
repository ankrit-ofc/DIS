"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const ALL_DISTRICTS = [
    // Active — with delivery fees
    { name: 'Kathmandu', deliveryFee: 0, active: true, estimatedDays: 1 },
    { name: 'Lalitpur', deliveryFee: 0, active: true, estimatedDays: 1 },
    { name: 'Bhaktapur', deliveryFee: 0, active: true, estimatedDays: 1 },
    { name: 'Pokhara', deliveryFee: 500, active: true, estimatedDays: 2 },
    { name: 'Chitwan', deliveryFee: 600, active: true, estimatedDays: 2 },
    { name: 'Butwal', deliveryFee: 700, active: true, estimatedDays: 3 },
    { name: 'Biratnagar', deliveryFee: 800, active: true, estimatedDays: 3 },
    { name: 'Birgunj', deliveryFee: 700, active: true, estimatedDays: 3 },
    { name: 'Dharan', deliveryFee: 850, active: true, estimatedDays: 3 },
    { name: 'Hetauda', deliveryFee: 650, active: true, estimatedDays: 2 },
    // Inactive — all remaining Nepal districts
    { name: 'Achham' }, { name: 'Arghakhanchi' }, { name: 'Baglung' },
    { name: 'Baitadi' }, { name: 'Bajhang' }, { name: 'Bajura' },
    { name: 'Banke' }, { name: 'Bara' }, { name: 'Bardiya' },
    { name: 'Bhojpur' }, { name: 'Dailekh' }, { name: 'Dang' },
    { name: 'Darchula' }, { name: 'Dhading' }, { name: 'Dhankuta' },
    { name: 'Dholkha' }, { name: 'Dolpa' }, { name: 'Doti' },
    { name: 'Gorkha' }, { name: 'Gulmi' }, { name: 'Humla' },
    { name: 'Ilam' }, { name: 'Jajarkot' }, { name: 'Jhapa' },
    { name: 'Jumla' }, { name: 'Kailali' }, { name: 'Kalikot' },
    { name: 'Kanchanpur' }, { name: 'Kapilvastu' }, { name: 'Kaski' },
    { name: 'Kavrepalanchok' }, { name: 'Khotang' }, { name: 'Lamjung' },
    { name: 'Mahottari' }, { name: 'Makwanpur' }, { name: 'Manang' },
    { name: 'Morang' }, { name: 'Mugu' }, { name: 'Mustang' },
    { name: 'Myagdi' }, { name: 'Nawalparasi East' }, { name: 'Nawalparasi West' },
    { name: 'Nuwakot' }, { name: 'Okhaldhunga' }, { name: 'Palpa' },
    { name: 'Panchthar' }, { name: 'Parbat' }, { name: 'Parsa' },
    { name: 'Pyuthan' }, { name: 'Ramechhap' }, { name: 'Rasuwa' },
    { name: 'Rautahat' }, { name: 'Rolpa' }, { name: 'Rukum East' },
    { name: 'Rukum West' }, { name: 'Rupandehi' }, { name: 'Salyan' },
    { name: 'Sankhuwasabha' }, { name: 'Saptari' }, { name: 'Sarlahi' },
    { name: 'Sindhuli' }, { name: 'Sindhupalchok' }, { name: 'Siraha' },
    { name: 'Solukhumbu' }, { name: 'Sunsari' }, { name: 'Surkhet' },
    { name: 'Syangja' }, { name: 'Taplejung' }, { name: 'Terhathum' },
    { name: 'Udayapur' },
];
async function main() {
    console.log('Seeding database...');
    // --- Profiles ---
    const adminHash = await bcryptjs_1.default.hash('admin123', 12);
    const buyerHash = await bcryptjs_1.default.hash('distro123', 12);
    const admin = await prisma.profile.upsert({
        where: { phone: '9800000000' },
        update: {},
        create: {
            phone: '9800000000',
            passwordHash: adminHash,
            role: 'ADMIN',
            ownerName: 'DISTRO Admin',
            status: 'ACTIVE',
        },
    });
    const buyer = await prisma.profile.upsert({
        where: { phone: '9841100001' },
        update: {},
        create: {
            phone: '9841100001',
            passwordHash: buyerHash,
            role: 'BUYER',
            storeName: 'Demo Store',
            ownerName: 'Demo Buyer',
            district: 'Kathmandu',
            address: 'Thamel, Kathmandu',
            status: 'ACTIVE',
        },
    });
    console.log(`  Admin: ${admin.phone} | Buyer: ${buyer.phone}`);
    // --- Categories ---
    const categories = await Promise.all([
        prisma.category.upsert({ where: { id: 'cat-liquor' }, update: {}, create: { id: 'cat-liquor', name: 'Liquor', emoji: '🍶' } }),
        prisma.category.upsert({ where: { id: 'cat-beverages' }, update: {}, create: { id: 'cat-beverages', name: 'Beverages', emoji: '🥤' } }),
        prisma.category.upsert({ where: { id: 'cat-snacks' }, update: {}, create: { id: 'cat-snacks', name: 'Snacks', emoji: '🍿' } }),
        prisma.category.upsert({ where: { id: 'cat-dairy' }, update: {}, create: { id: 'cat-dairy', name: 'Dairy', emoji: '🥛' } }),
        prisma.category.upsert({ where: { id: 'cat-grains' }, update: {}, create: { id: 'cat-grains', name: 'Grains', emoji: '🌾' } }),
        prisma.category.upsert({ where: { id: 'cat-household' }, update: {}, create: { id: 'cat-household', name: 'Household', emoji: '🧴' } }),
    ]);
    console.log(`  Categories: ${categories.length}`);
    // --- Products ---
    const products = [
        { sku: 'LIQ-001', name: 'Ruslan Vodka 750ml', brand: 'Ruslan', categoryId: 'cat-liquor', price: 950, mrp: 1100, unit: 'bottle', moq: 6, stockQty: 240 },
        { sku: 'LIQ-002', name: 'Old Durbar Whisky 750ml', brand: 'Khukuri', categoryId: 'cat-liquor', price: 1450, mrp: 1650, unit: 'bottle', moq: 6, stockQty: 180 },
        { sku: 'BEV-001', name: 'Coca-Cola 330ml (24pk)', brand: 'Coca-Cola', categoryId: 'cat-beverages', price: 1080, mrp: 1200, unit: 'case', moq: 2, stockQty: 320 },
        { sku: 'BEV-002', name: 'Real Juice Mango 1L', brand: 'Real', categoryId: 'cat-beverages', price: 85, mrp: 95, unit: 'piece', moq: 12, stockQty: 500 },
        { sku: 'BEV-003', name: 'Wai Wai Mineral Water 1L', brand: 'Wai Wai', categoryId: 'cat-beverages', price: 25, mrp: 30, unit: 'piece', moq: 24, stockQty: 1000 },
        { sku: 'SNK-001', name: 'Lays Classic 26g (24pk)', brand: 'PepsiCo', categoryId: 'cat-snacks', price: 720, mrp: 816, unit: 'box', moq: 2, stockQty: 200 },
        { sku: 'SNK-002', name: 'Uncle Chips Spicy 30g', brand: 'PepsiCo', categoryId: 'cat-snacks', price: 25, mrp: 30, unit: 'piece', moq: 24, stockQty: 600 },
        { sku: 'DAI-001', name: 'Sujal Milk 1L', brand: 'Sujal', categoryId: 'cat-dairy', price: 75, mrp: 85, unit: 'piece', moq: 12, stockQty: 300 },
        { sku: 'DAI-002', name: 'Aakash Ghee 1kg', brand: 'Aakash', categoryId: 'cat-dairy', price: 750, mrp: 850, unit: 'piece', moq: 6, stockQty: 150 },
        { sku: 'GRN-001', name: 'Aashirvaad Atta 5kg', brand: 'Aashirvaad', categoryId: 'cat-grains', price: 430, mrp: 480, unit: 'piece', moq: 4, stockQty: 400 },
        { sku: 'HSH-001', name: 'Surf Excel 1kg', brand: 'HUL', categoryId: 'cat-household', price: 210, mrp: 240, unit: 'piece', moq: 12, stockQty: 480 },
        { sku: 'HSH-002', name: 'Dettol Soap 75g (4pk)', brand: 'Dettol', categoryId: 'cat-household', price: 220, mrp: 260, unit: 'pack', moq: 6, stockQty: 360 },
    ];
    for (const p of products) {
        await prisma.product.upsert({
            where: { sku: p.sku },
            update: {},
            create: p,
        });
    }
    console.log(`  Products: ${products.length}`);
    // --- Districts ---
    for (const d of ALL_DISTRICTS) {
        await prisma.district.upsert({
            where: { name: d.name },
            update: {},
            create: {
                name: d.name,
                deliveryFee: d.deliveryFee ?? 0,
                active: d.active ?? false,
                estimatedDays: d.estimatedDays ?? 3,
            },
        });
    }
    console.log(`  Districts: ${ALL_DISTRICTS.length} (10 active)`);
    // --- Announcement ---
    await prisma.announcement.upsert({
        where: { id: 'ann-welcome' },
        update: {},
        create: {
            id: 'ann-welcome',
            text: 'Welcome to DISTRO — Nepal\'s wholesale ordering platform',
            active: true,
        },
    });
    // --- Setting ---
    await prisma.setting.upsert({
        where: { key: 'minOrderAmount' },
        update: {},
        create: { key: 'minOrderAmount', value: '10000' },
    });
    console.log('Seeding complete.');
}
main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
