import { Router, Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cart.service';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// Validation Schemas
const AddItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantSku: z.string().min(1, 'Variant SKU is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

const UpdateQuantitySchema = z.object({
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
});

function getSessionId(req: Request): string {
  const sessionId =
    (req.headers['x-cart-session'] as string) ||
    (req.query.sessionId as string) ||
    req.body?.sessionId;

  if (!sessionId) {
    throw new AppError('x-cart-session header or sessionId parameter is required', 400);
  }

  return sessionId;
}

// GET /api/cart
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = getSessionId(req);
    const cart = await cartService.getOrCreateCart(sessionId);
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
});

// POST /api/cart/items
router.post('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = getSessionId(req);
    const validated = AddItemSchema.parse(req.body);
    const cart = await cartService.addItem(sessionId, validated);
    res.status(201).json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/cart/items/:sku
router.patch('/items/:sku', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = getSessionId(req);
    const { sku } = req.params;
    const { quantity } = UpdateQuantitySchema.parse(req.body);
    const cart = await cartService.updateQuantity(sessionId, sku!, quantity);
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart/items/:sku
router.delete('/items/:sku', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = getSessionId(req);
    const { sku } = req.params;
    const cart = await cartService.removeItem(sessionId, sku!);
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = getSessionId(req);
    const cart = await cartService.clearCart(sessionId);
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
});

export default router;
