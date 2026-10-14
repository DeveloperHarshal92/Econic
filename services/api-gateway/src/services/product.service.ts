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
   */
  async getProductById(id: string): Promise<IProduct> {
    const product = await ProductModel.findById(id);
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
}

// Singleton instance
export const productService = new ProductService();
