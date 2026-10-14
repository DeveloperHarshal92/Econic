import { z } from 'zod';

// ─── Variant validation ─────────────────────────────────

const productImageSchema = z.object({
  url: z.string().url('Image URL must be a valid URL'),
  alt: z.string().min(1, 'Image alt text is required'),
  isPrimary: z.boolean().default(false),
});

const productVariantSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(50, 'SKU cannot exceed 50 characters')
    .transform((v) => v.toUpperCase().trim()),
  name: z.string().min(1, 'Variant name is required').max(100),
  price: z.number().min(0, 'Price must be non-negative'),
  compareAtPrice: z.number().min(0).optional(),
  attributes: z.record(z.string()).default({}),
  inventory: z.number().int().min(0, 'Inventory cannot be negative').default(0),
  isAvailable: z.boolean().default(true),
});

// ─── Create Product ─────────────────────────────────────

export const createProductSchema = z.object({
  name: z
    .string()
    .min(1, 'Product name is required')
    .max(200, 'Product name cannot exceed 200 characters'),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only')
    .optional(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(5000, 'Description cannot exceed 5000 characters'),
  shortDescription: z
    .string()
    .min(1, 'Short description is required')
    .max(300, 'Short description cannot exceed 300 characters'),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).default([]),
  images: z.array(productImageSchema).default([]),
  variants: z
    .array(productVariantSchema)
    .min(1, 'At least one variant is required'),
  isActive: z.boolean().default(true),
});

// ─── Update Product ─────────────────────────────────────

export const updateProductSchema = createProductSchema.partial();

// ─── Query validation ───────────────────────────────────

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  tags: z
    .string()
    .transform((v) => v.split(',').map((t) => t.trim()))
    .optional(),
  isAvailable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sortBy: z.enum(['name', 'price', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Type exports ───────────────────────────────────────

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
