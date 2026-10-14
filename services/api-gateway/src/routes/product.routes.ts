import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware';
import { productService } from '../services/product.service';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from '../validators/product.validator';
import { ZodError } from 'zod';

const router = Router();

/**
 * Parse and validate Zod schema, throwing AppError on failure.
 */
function validate<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw AppError.badRequest('Validation failed', details);
    }
    throw err;
  }
}

// ─── GET /api/products ──────────────────────────────────

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = validate(productQuerySchema, req.query);
    const result = await productService.getProducts(query);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// ─── GET /api/products/categories ───────────────────────

router.get(
  '/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await productService.getCategories();
    res.json({
      success: true,
      data: categories,
    });
  }),
);

// ─── GET /api/products/slug/:slug ───────────────────────

router.get(
  '/slug/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getProductBySlug(req.params.slug!);
    res.json({
      success: true,
      data: product,
    });
  }),
);

// ─── GET /api/products/:id ──────────────────────────────

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getProductById(req.params.id!);
    res.json({
      success: true,
      data: product,
    });
  }),
);

// ─── POST /api/products ─────────────────────────────────

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const input = validate(createProductSchema, req.body);
    const product = await productService.createProduct(input);

    res.status(201).json({
      success: true,
      data: product,
    });
  }),
);

// ─── PATCH /api/products/:id ────────────────────────────

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const input = validate(updateProductSchema, req.body);
    const product = await productService.updateProduct(req.params.id!, input);

    res.json({
      success: true,
      data: product,
    });
  }),
);

// ─── DELETE /api/products/:id ───────────────────────────

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await productService.deleteProduct(req.params.id!);
    res.status(204).send();
  }),
);

export default router;
