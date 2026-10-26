import { Router, Request, Response } from 'express';
import { asyncHandler, AppError, requireAdmin, getOptionalAuth } from '../middleware';
import { productService } from '../services/product.service';
import { logger } from '../utils/logger';
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
    let includeInactive = false;
    if (req.query.includeInactive === 'true') {
      const authUser = getOptionalAuth(req);
      if (authUser && authUser.role === 'admin') {
        includeInactive = true;
      }
    }

    const product = await productService.getProductById(req.params.id!, includeInactive);
    res.json({
      success: true,
      data: product,
    });
  }),
);

// ─── POST /api/products (Admin Only) ────────────────────

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const input = validate(createProductSchema, req.body);
    const product = await productService.createProduct(input);

    logger.info('Product created by admin', {
      adminId: req.user?.id,
      productId: product.id,
      name: product.name,
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  }),
);

// ─── PATCH /api/products/:id (Admin Only) ───────────────

router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const input = validate(updateProductSchema, req.body);
    const product = await productService.updateProduct(req.params.id!, input);

    logger.info('Product updated by admin', {
      adminId: req.user?.id,
      productId: product.id,
    });

    res.json({
      success: true,
      data: product,
    });
  }),
);

// ─── DELETE /api/products/:id (Admin Only) ──────────────

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    await productService.deleteProduct(req.params.id!);

    logger.info('Product soft-deleted by admin', {
      adminId: req.user?.id,
      productId: req.params.id,
    });

    res.status(204).send();
  }),
);

export default router;
