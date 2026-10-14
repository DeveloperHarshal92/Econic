import mongoose from 'mongoose';
import { config } from '../config';
import { ProductModel } from '../models';
import { logger } from '../utils/logger';

const seedProducts = [
  {
    name: 'Classic Leather Jacket',
    slug: 'classic-leather-jacket',
    description:
      'Premium full-grain leather jacket with a timeless design. Features a YKK zipper, interior pockets, and a satin lining for comfort. Built to age beautifully over time.',
    shortDescription: 'Premium full-grain leather jacket with timeless design.',
    category: 'Outerwear',
    tags: ['leather', 'jacket', 'premium', 'mens'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800',
        alt: 'Classic leather jacket front view',
        isPrimary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1559551409-dadc959f76b8?w=800',
        alt: 'Classic leather jacket side view',
        isPrimary: false,
      },
    ],
    variants: [
      {
        sku: 'CLJ-S-BLK',
        name: 'Small / Black',
        price: 299.99,
        compareAtPrice: 399.99,
        attributes: { size: 'S', color: 'Black' },
        inventory: 15,
        isAvailable: true,
      },
      {
        sku: 'CLJ-M-BLK',
        name: 'Medium / Black',
        price: 299.99,
        compareAtPrice: 399.99,
        attributes: { size: 'M', color: 'Black' },
        inventory: 23,
        isAvailable: true,
      },
      {
        sku: 'CLJ-L-BLK',
        name: 'Large / Black',
        price: 299.99,
        compareAtPrice: 399.99,
        attributes: { size: 'L', color: 'Black' },
        inventory: 18,
        isAvailable: true,
      },
      {
        sku: 'CLJ-M-BRN',
        name: 'Medium / Brown',
        price: 319.99,
        compareAtPrice: 399.99,
        attributes: { size: 'M', color: 'Brown' },
        inventory: 12,
        isAvailable: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Minimalist Running Shoes',
    slug: 'minimalist-running-shoes',
    description:
      'Lightweight engineered mesh running shoes with responsive cushioning. Zero-drop design promotes natural foot movement. Reflective details for low-light visibility.',
    shortDescription: 'Lightweight zero-drop running shoes with responsive cushioning.',
    category: 'Footwear',
    tags: ['shoes', 'running', 'athletic', 'minimalist'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
        alt: 'Minimalist running shoes side view',
        isPrimary: true,
      },
    ],
    variants: [
      {
        sku: 'MRS-9-WHT',
        name: 'US 9 / White',
        price: 129.99,
        attributes: { size: 'US 9', color: 'White' },
        inventory: 30,
        isAvailable: true,
      },
      {
        sku: 'MRS-10-WHT',
        name: 'US 10 / White',
        price: 129.99,
        attributes: { size: 'US 10', color: 'White' },
        inventory: 25,
        isAvailable: true,
      },
      {
        sku: 'MRS-11-WHT',
        name: 'US 11 / White',
        price: 129.99,
        attributes: { size: 'US 11', color: 'White' },
        inventory: 20,
        isAvailable: true,
      },
      {
        sku: 'MRS-10-BLK',
        name: 'US 10 / Black',
        price: 129.99,
        attributes: { size: 'US 10', color: 'Black' },
        inventory: 28,
        isAvailable: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Organic Cotton T-Shirt',
    slug: 'organic-cotton-tshirt',
    description:
      'Super-soft 100% organic cotton t-shirt with a relaxed fit. GOTS certified, pre-shrunk, and dyed with eco-friendly processes. Available in earth-tone colors.',
    shortDescription: 'GOTS-certified 100% organic cotton tee with relaxed fit.',
    category: 'Tops',
    tags: ['tshirt', 'organic', 'cotton', 'sustainable', 'unisex'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
        alt: 'Organic cotton t-shirt front',
        isPrimary: true,
      },
    ],
    variants: [
      {
        sku: 'OCT-S-OLV',
        name: 'Small / Olive',
        price: 39.99,
        attributes: { size: 'S', color: 'Olive' },
        inventory: 50,
        isAvailable: true,
      },
      {
        sku: 'OCT-M-OLV',
        name: 'Medium / Olive',
        price: 39.99,
        attributes: { size: 'M', color: 'Olive' },
        inventory: 65,
        isAvailable: true,
      },
      {
        sku: 'OCT-L-OLV',
        name: 'Large / Olive',
        price: 39.99,
        attributes: { size: 'L', color: 'Olive' },
        inventory: 40,
        isAvailable: true,
      },
      {
        sku: 'OCT-M-SNS',
        name: 'Medium / Sand Stone',
        price: 39.99,
        attributes: { size: 'M', color: 'Sand Stone' },
        inventory: 55,
        isAvailable: true,
      },
      {
        sku: 'OCT-L-SNS',
        name: 'Large / Sand Stone',
        price: 39.99,
        attributes: { size: 'L', color: 'Sand Stone' },
        inventory: 35,
        isAvailable: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Canvas Weekender Bag',
    slug: 'canvas-weekender-bag',
    description:
      'Durable waxed canvas weekender bag with vegetable-tanned leather accents. Features padded laptop compartment, brass hardware, and removable shoulder strap. Water-resistant finish.',
    shortDescription: 'Waxed canvas weekender with leather accents and laptop compartment.',
    category: 'Bags',
    tags: ['bag', 'weekender', 'canvas', 'travel', 'unisex'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',
        alt: 'Canvas weekender bag',
        isPrimary: true,
      },
    ],
    variants: [
      {
        sku: 'CWB-STD-OLV',
        name: 'Standard / Olive',
        price: 189.99,
        compareAtPrice: 229.99,
        attributes: { size: 'Standard', color: 'Olive' },
        inventory: 20,
        isAvailable: true,
      },
      {
        sku: 'CWB-STD-NVY',
        name: 'Standard / Navy',
        price: 189.99,
        compareAtPrice: 229.99,
        attributes: { size: 'Standard', color: 'Navy' },
        inventory: 15,
        isAvailable: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Merino Wool Beanie',
    slug: 'merino-wool-beanie',
    description:
      'Ultra-soft 100% merino wool beanie with a double-layer knit for warmth. Naturally temperature-regulating, moisture-wicking, and odor-resistant.',
    shortDescription: 'Double-layer merino wool beanie — warm and breathable.',
    category: 'Accessories',
    tags: ['beanie', 'wool', 'merino', 'winter', 'unisex'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800',
        alt: 'Merino wool beanie',
        isPrimary: true,
      },
    ],
    variants: [
      {
        sku: 'MWB-OS-CHR',
        name: 'One Size / Charcoal',
        price: 44.99,
        attributes: { size: 'One Size', color: 'Charcoal' },
        inventory: 75,
        isAvailable: true,
      },
      {
        sku: 'MWB-OS-BRG',
        name: 'One Size / Burgundy',
        price: 44.99,
        attributes: { size: 'One Size', color: 'Burgundy' },
        inventory: 60,
        isAvailable: true,
      },
      {
        sku: 'MWB-OS-FGR',
        name: 'One Size / Forest Green',
        price: 44.99,
        attributes: { size: 'One Size', color: 'Forest Green' },
        inventory: 45,
        isAvailable: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Stainless Steel Water Bottle',
    slug: 'stainless-steel-water-bottle',
    description:
      'Double-walled vacuum-insulated water bottle made from 18/8 food-grade stainless steel. Keeps drinks cold for 24 hours or hot for 12. BPA-free cap with leak-proof seal.',
    shortDescription: '24hr cold / 12hr hot vacuum-insulated steel bottle.',
    category: 'Accessories',
    tags: ['water-bottle', 'stainless-steel', 'eco-friendly', 'insulated'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800',
        alt: 'Stainless steel water bottle',
        isPrimary: true,
      },
    ],
    variants: [
      {
        sku: 'SSWB-500-MBK',
        name: '500ml / Matte Black',
        price: 34.99,
        attributes: { capacity: '500ml', color: 'Matte Black' },
        inventory: 100,
        isAvailable: true,
      },
      {
        sku: 'SSWB-750-MBK',
        name: '750ml / Matte Black',
        price: 39.99,
        attributes: { capacity: '750ml', color: 'Matte Black' },
        inventory: 80,
        isAvailable: true,
      },
      {
        sku: 'SSWB-500-SLV',
        name: '500ml / Silver',
        price: 34.99,
        attributes: { capacity: '500ml', color: 'Silver' },
        inventory: 90,
        isAvailable: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Denim Trucker Jacket',
    slug: 'denim-trucker-jacket',
    description:
      'Heavyweight 14oz selvedge denim trucker jacket with copper buttons. Raw unwashed finish that develops unique fading patterns with wear. Made in Portugal.',
    shortDescription: '14oz selvedge denim trucker — raw, unwashed, made in Portugal.',
    category: 'Outerwear',
    tags: ['denim', 'jacket', 'selvedge', 'raw', 'mens'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800',
        alt: 'Denim trucker jacket',
        isPrimary: true,
      },
    ],
    variants: [
      {
        sku: 'DTJ-S-IND',
        name: 'Small / Indigo',
        price: 219.99,
        attributes: { size: 'S', color: 'Indigo' },
        inventory: 10,
        isAvailable: true,
      },
      {
        sku: 'DTJ-M-IND',
        name: 'Medium / Indigo',
        price: 219.99,
        attributes: { size: 'M', color: 'Indigo' },
        inventory: 18,
        isAvailable: true,
      },
      {
        sku: 'DTJ-L-IND',
        name: 'Large / Indigo',
        price: 219.99,
        attributes: { size: 'L', color: 'Indigo' },
        inventory: 14,
        isAvailable: true,
      },
      {
        sku: 'DTJ-XL-IND',
        name: 'XL / Indigo',
        price: 219.99,
        attributes: { size: 'XL', color: 'Indigo' },
        inventory: 8,
        isAvailable: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Slim Fit Chinos',
    slug: 'slim-fit-chinos',
    description:
      'Stretch cotton-blend chinos with a modern slim fit. Garment-dyed for a rich color that softens naturally. Features a hidden coin pocket and reinforced belt loops.',
    shortDescription: 'Stretch cotton-blend slim-fit chinos with garment-dyed finish.',
    category: 'Bottoms',
    tags: ['chinos', 'pants', 'slim-fit', 'stretch', 'mens'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800',
        alt: 'Slim fit chinos',
        isPrimary: true,
      },
    ],
    variants: [
      {
        sku: 'SFC-30-KHK',
        name: '30W / Khaki',
        price: 79.99,
        attributes: { waist: '30', color: 'Khaki' },
        inventory: 35,
        isAvailable: true,
      },
      {
        sku: 'SFC-32-KHK',
        name: '32W / Khaki',
        price: 79.99,
        attributes: { waist: '32', color: 'Khaki' },
        inventory: 40,
        isAvailable: true,
      },
      {
        sku: 'SFC-34-KHK',
        name: '34W / Khaki',
        price: 79.99,
        attributes: { waist: '34', color: 'Khaki' },
        inventory: 30,
        isAvailable: true,
      },
      {
        sku: 'SFC-32-NVY',
        name: '32W / Navy',
        price: 79.99,
        attributes: { waist: '32', color: 'Navy' },
        inventory: 38,
        isAvailable: true,
      },
      {
        sku: 'SFC-34-NVY',
        name: '34W / Navy',
        price: 79.99,
        attributes: { waist: '34', color: 'Navy' },
        inventory: 25,
        isAvailable: true,
      },
    ],
    isActive: true,
  },
];

async function seed(): Promise<void> {
  try {
    logger.info('🌱 Connecting to database...');
    await mongoose.connect(config.mongodb.uri);

    logger.info('🗑️  Clearing existing products...');
    await ProductModel.deleteMany({});

    logger.info(`📦 Seeding ${seedProducts.length} products...`);
    const products = await ProductModel.insertMany(seedProducts);

    logger.info(`✅ Seeded ${products.length} products successfully`);

    for (const product of products) {
      logger.info(`   → ${product.name} (${product.variants.length} variants)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Seed failed', { error: message });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Database disconnected');
  }
}

seed();
