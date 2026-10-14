import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { ProductModel } from '../models';

const app = createApp();

const validProduct = {
  name: 'Test Product',
  slug: 'test-product',
  description: 'A test product description that is long enough',
  shortDescription: 'A test product',
  category: 'Test Category',
  tags: ['test'],
  images: [
    {
      url: 'https://example.com/image.jpg',
      alt: 'Test image',
      isPrimary: true,
    },
  ],
  variants: [
    {
      sku: 'TEST-001',
      name: 'Default',
      price: 29.99,
      attributes: { size: 'M' },
      inventory: 10,
      isAvailable: true,
    },
  ],
};

describe('Product API', () => {
  // ─── POST /api/products ───────────────────────────────

  describe('POST /api/products', () => {
    it('should create a product with valid data', async () => {
      const res = await request(app)
        .post('/api/products')
        .send(validProduct)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Product');
      expect(res.body.data.slug).toBe('test-product');
      expect(res.body.data.variants).toHaveLength(1);
      expect(res.body.data.variants[0].sku).toBe('TEST-001');
    });

    it('should auto-generate slug from name when not provided', async () => {
      const product = { ...validProduct, slug: undefined, name: 'My Great Product' };
      const res = await request(app)
        .post('/api/products')
        .send(product)
        .expect(201);

      expect(res.body.data.slug).toBe('my-great-product');
    });

    it('should reject product without variants', async () => {
      const product = { ...validProduct, variants: [] };
      const res = await request(app)
        .post('/api/products')
        .send(product)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('should reject product with missing name', async () => {
      const product = { ...validProduct, name: '' };
      const res = await request(app)
        .post('/api/products')
        .send(product)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject product with negative price', async () => {
      const product = {
        ...validProduct,
        variants: [{ ...validProduct.variants[0], price: -10 }],
      };
      const res = await request(app)
        .post('/api/products')
        .send(product)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject duplicate SKUs within product', async () => {
      const product = {
        ...validProduct,
        variants: [
          { ...validProduct.variants[0], sku: 'DUP-SKU' },
          { ...validProduct.variants[0], sku: 'DUP-SKU', name: 'Other' },
        ],
      };
      const res = await request(app)
        .post('/api/products')
        .send(product)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject duplicate slugs', async () => {
      await request(app).post('/api/products').send(validProduct).expect(201);

      const res = await request(app)
        .post('/api/products')
        .send(validProduct)
        .expect(409);

      expect(res.body.error.code).toBe('DUPLICATE_KEY');
    });
  });

  // ─── GET /api/products ────────────────────────────────

  describe('GET /api/products', () => {
    beforeEach(async () => {
      await ProductModel.create([
        {
          ...validProduct,
          name: 'Alpha Shirt',
          slug: 'alpha-shirt',
          category: 'Tops',
          tags: ['shirt', 'cotton'],
          variants: [
            { sku: 'AS-001', name: 'Small', price: 29.99, inventory: 10, isAvailable: true },
          ],
        },
        {
          ...validProduct,
          name: 'Beta Jacket',
          slug: 'beta-jacket',
          category: 'Outerwear',
          tags: ['jacket'],
          variants: [
            { sku: 'BJ-001', name: 'Medium', price: 199.99, inventory: 5, isAvailable: true },
          ],
        },
        {
          ...validProduct,
          name: 'Gamma Pants',
          slug: 'gamma-pants',
          category: 'Bottoms',
          tags: ['pants'],
          variants: [
            { sku: 'GP-001', name: 'Large', price: 89.99, inventory: 0, isAvailable: false },
          ],
        },
      ]);
    });

    it('should return paginated products', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.meta.page).toBe(1);
    });

    it('should filter by category', async () => {
      const res = await request(app)
        .get('/api/products?category=Tops')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].category).toBe('Tops');
    });

    it('should filter by price range', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=50&maxPrice=200')
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });

    it('should paginate correctly', async () => {
      const res = await request(app)
        .get('/api/products?page=1&limit=2')
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.totalPages).toBe(2);
      expect(res.body.meta.hasNext).toBe(true);
    });

    it('should reject invalid page numbers', async () => {
      const res = await request(app)
        .get('/api/products?page=0')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /api/products/:id ────────────────────────────

  describe('GET /api/products/:id', () => {
    it('should return a product by ID', async () => {
      const created = await ProductModel.create(validProduct);
      const res = await request(app)
        .get(`/api/products/${created.id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Product');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── GET /api/products/slug/:slug ─────────────────────

  describe('GET /api/products/slug/:slug', () => {
    it('should return a product by slug', async () => {
      await ProductModel.create(validProduct);
      const res = await request(app)
        .get('/api/products/slug/test-product')
        .expect(200);

      expect(res.body.data.slug).toBe('test-product');
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app)
        .get('/api/products/slug/nonexistent')
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── PATCH /api/products/:id ──────────────────────────

  describe('PATCH /api/products/:id', () => {
    it('should update a product', async () => {
      const created = await ProductModel.create(validProduct);
      const res = await request(app)
        .patch(`/api/products/${created.id}`)
        .send({ name: 'Updated Product' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated Product');
    });

    it('should return 404 when updating non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .patch(`/api/products/${fakeId}`)
        .send({ name: 'Nope' })
        .expect(404);
    });
  });

  // ─── DELETE /api/products/:id ─────────────────────────

  describe('DELETE /api/products/:id', () => {
    it('should soft-delete a product', async () => {
      const created = await ProductModel.create(validProduct);
      await request(app)
        .delete(`/api/products/${created.id}`)
        .expect(204);

      // Verify soft delete
      const product = await ProductModel.findById(created.id);
      expect(product?.isActive).toBe(false);
    });
  });

  // ─── GET /api/products/categories ─────────────────────

  describe('GET /api/products/categories', () => {
    it('should return unique categories', async () => {
      await ProductModel.create([
        { ...validProduct, slug: 'p1', category: 'Tops', variants: [{ sku: 'C1', name: 'V', price: 10, inventory: 1, isAvailable: true }] },
        { ...validProduct, slug: 'p2', category: 'Bottoms', variants: [{ sku: 'C2', name: 'V', price: 10, inventory: 1, isAvailable: true }] },
        { ...validProduct, slug: 'p3', category: 'Tops', variants: [{ sku: 'C3', name: 'V', price: 10, inventory: 1, isAvailable: true }] },
      ]);

      const res = await request(app)
        .get('/api/products/categories')
        .expect(200);

      expect(res.body.data).toEqual(['Bottoms', 'Tops']);
    });
  });
});

// ─── Health Check ───────────────────────────────────────

describe('Health Check', () => {
  it('should return health status', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBeDefined();
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.services).toBeDefined();
  });
});

// ─── 404 Handler ────────────────────────────────────────

describe('404 Handler', () => {
  it('should return 404 for unknown API routes', async () => {
    const res = await request(app)
      .get('/api/nonexistent')
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
