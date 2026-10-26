import mongoose from 'mongoose';
import { ProductModel, IProduct } from '../models';
import { AppError } from '../middleware';
import { logger } from '../utils/logger';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryInput,
} from '../validators/product.validator';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class ProductService {
  /**
   * Get paginated, filtered, and searchable product list.
   */
  async getProducts(query: ProductQueryInput): Promise<PaginatedResult<IProduct>> {
    const {
      page,
      limit,
      search,
      category,
      minPrice,
      maxPrice,
      tags,
      isAvailable,
      sortBy,
      sortOrder,
    } = query;

    // Build filter
    const filter: Record<string, unknown> = { isActive: true };

    if (search) {
      filter.$text = { $search: search };
    }

    if (category) {
      filter.category = category;
    }

    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    if (isAvailable !== undefined) {
      filter['variants.isAvailable'] = isAvailable;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter['variants.price'] = {};
      if (minPrice !== undefined) {
        (filter['variants.price'] as Record<string, number>).$gte = minPrice;
      }
      if (maxPrice !== undefined) {
        (filter['variants.price'] as Record<string, number>).$lte = maxPrice;
      }
    }

    // Build sort
    const sortField = sortBy === 'price' ? 'variants.price' : sortBy;
    const sort: Record<string, 1 | -1> = {
      [sortField]: sortOrder === 'asc' ? 1 : -1,
    };

    // Execute query
    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      ProductModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      ProductModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.debug('Products queried', { total, page, limit, filters: Object.keys(filter) });

    return {
      data: products as unknown as IProduct[],
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get a product by ID.
   * By default, public queries filter out inactive products (isActive: true).
   * Authorized administrative callers can specify includeInactive = true.
   */
  async getProductById(id: string, includeInactive = false): Promise<IProduct> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid product ID');
    }

    const filter: Record<string, unknown> = { _id: id };
    if (!includeInactive) {
      filter.isActive = true;
    }

    const product = await ProductModel.findOne(filter);
    if (!product) {
      throw AppError.notFound('Product');
    }
    return product;
  }

  /**
   * Get a product by slug.
   */
  async getProductBySlug(slug: string): Promise<IProduct> {
    const product = await ProductModel.findOne({ slug, isActive: true });
    if (!product) {
      throw AppError.notFound('Product');
    }
    return product;
  }

  /**
   * Create a new product.
   */
  async createProduct(input: CreateProductInput): Promise<IProduct> {
    // Generate slug if not provided
    if (!input.slug) {
      input.slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    // Validate unique SKUs within variants
    const skus = input.variants.map((v) => v.sku);
    const uniqueSkus = new Set(skus);
    if (uniqueSkus.size !== skus.length) {
      throw AppError.badRequest('Variant SKUs must be unique within a product');
    }

    const product = new ProductModel(input);
    await product.save();

    logger.info('Product created', { id: product.id, name: product.name });
    return product;
  }

  /**
   * Update an existing product.
   */
  async updateProduct(id: string, input: UpdateProductInput): Promise<IProduct> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid product ID');
    }

    const product = await ProductModel.findByIdAndUpdate(
      id,
      { $set: input },
      { new: true, runValidators: true },
    );

    if (!product) {
      throw AppError.notFound('Product');
    }

    logger.info('Product updated', { id: product.id, name: product.name });
    return product;
  }

  /**
   * Soft-delete a product by setting isActive to false.
   */
  async deleteProduct(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid product ID');
    }

    const product = await ProductModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!product) {
      throw AppError.notFound('Product');
    }

    logger.info('Product soft-deleted', { id: product.id });
  }

  /**
   * Get all unique categories.
   */
  async getCategories(): Promise<string[]> {
    const categories = await ProductModel.distinct('category', { isActive: true });
    return categories.sort();
  }

  /**
   * Atomically adjust variant inventory in MongoDB.
   * Decrements require stock to be >= quantityDelta (never negative).
   * Increments (restocks) increase stock and ensure isAvailable is set to true.
   */
  async adjustVariantInventory(
    sku: string,
    quantityDelta: number,
    session?: mongoose.ClientSession | null
  ): Promise<{
    success: boolean;
    sku: string;
    previousInventory: number;
    newInventory: number;
    error?: 'INSUFFICIENT_STOCK' | 'VARIANT_NOT_FOUND';
    product: IProduct | null;
  }> {
    const upperSku = sku.toUpperCase();

    if (quantityDelta === 0) {
      const product = await ProductModel.findOne({ 'variants.sku': upperSku });
      const variant = product?.variants.find((v) => v.sku.toUpperCase() === upperSku);
      return {
        success: true,
        sku: upperSku,
        previousInventory: variant ? variant.inventory : 0,
        newInventory: variant ? variant.inventory : 0,
        product,
      };
    }

    if (quantityDelta < 0) {
      const required = Math.abs(quantityDelta);
      const updateOptions: mongoose.QueryOptions = { new: true };
      if (session) updateOptions.session = session;

      // Conditional atomic decrement: matched document must have inventory >= required for that exact variant
      const updatedProduct = await ProductModel.findOneAndUpdate(
        {
          variants: {
            $elemMatch: {
              sku: upperSku,
              inventory: { $gte: required },
            },
          },
        },
        {
          $inc: { 'variants.$.inventory': quantityDelta },
        },
        updateOptions
      );

      if (!updatedProduct) {
        // Document didn't match: check if variant exists but has insufficient inventory
        const existing = await ProductModel.findOne({ 'variants.sku': upperSku });
        if (!existing) {
          return {
            success: false,
            sku: upperSku,
            previousInventory: 0,
            newInventory: 0,
            error: 'VARIANT_NOT_FOUND',
            product: null,
          };
        }

        const variant = existing.variants.find((v) => v.sku.toUpperCase() === upperSku);
        const currentInventory = variant ? variant.inventory : 0;
        return {
          success: false,
          sku: upperSku,
          previousInventory: currentInventory,
          newInventory: currentInventory,
          error: 'INSUFFICIENT_STOCK',
          product: existing,
        };
      }

      // Check remaining stock and update isAvailable if depleted
      const variant = updatedProduct.variants.find((v) => v.sku.toUpperCase() === upperSku);
      const newInventory = variant ? variant.inventory : 0;
      if (newInventory === 0 && variant?.isAvailable) {
        await ProductModel.updateOne(
          { variants: { $elemMatch: { sku: upperSku } } },
          { $set: { 'variants.$.isAvailable': false } },
          session ? { session } : {}
        );
        variant.isAvailable = false;
      }

      logger.info('Variant inventory atomically decremented', {
        sku: upperSku,
        delta: quantityDelta,
        newInventory,
      });

      return {
        success: true,
        sku: upperSku,
        previousInventory: newInventory + required,
        newInventory,
        product: updatedProduct,
      };
    } else {
      // Restock: increment stock and ensure isAvailable is true
      const updateOptions: mongoose.QueryOptions = { new: true };
      if (session) updateOptions.session = session;

      const updatedProduct = await ProductModel.findOneAndUpdate(
        { variants: { $elemMatch: { sku: upperSku } } },
        {
          $inc: { 'variants.$.inventory': quantityDelta },
          $set: { 'variants.$.isAvailable': true },
        },
        updateOptions
      );

      if (!updatedProduct) {
        return {
          success: false,
          sku: upperSku,
          previousInventory: 0,
          newInventory: 0,
          error: 'VARIANT_NOT_FOUND',
          product: null,
        };
      }

      const variant = updatedProduct.variants.find((v) => v.sku.toUpperCase() === upperSku);
      const newInventory = variant ? variant.inventory : 0;

      logger.info('Variant inventory atomically incremented', {
        sku: upperSku,
        delta: quantityDelta,
        newInventory,
      });

      return {
        success: true,
        sku: upperSku,
        previousInventory: newInventory - quantityDelta,
        newInventory,
        product: updatedProduct,
      };
    }
  }
}

// Singleton instance
export const productService = new ProductService();
