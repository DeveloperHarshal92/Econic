import mongoose, { Schema, Document, Model } from 'mongoose';

// ─── Interfaces ─────────────────────────────────────────

export interface IProductImage {
  url: string;
  alt: string;
  isPrimary: boolean;
}

export interface IProductVariant {
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  attributes: Map<string, string>;
  inventory: number;
  isAvailable: boolean;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: string;
  tags: string[];
  images: IProductImage[];
  variants: IProductVariant[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-Schemas ────────────────────────────────────────

const ProductImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    alt: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price must be non-negative'],
    },
    compareAtPrice: {
      type: Number,
      min: [0, 'Compare-at price must be non-negative'],
    },
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
    inventory: {
      type: Number,
      required: true,
      min: [0, 'Inventory cannot be negative'],
      default: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

// ─── Product Schema ─────────────────────────────────────

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    shortDescription: {
      type: String,
      required: true,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    images: {
      type: [ProductImageSchema],
      default: [],
    },
    variants: {
      type: [ProductVariantSchema],
      required: true,
      validate: {
        validator: (v: IProductVariant[]) => v.length > 0,
        message: 'Product must have at least one variant',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        // Convert Map to plain object for variants
        if (ret.variants) {
          ret.variants = ret.variants.map((v: any) => ({
            ...v,
            attributes: v.attributes instanceof Map
              ? Object.fromEntries(v.attributes)
              : v.attributes,
          }));
        }
        return ret;
      },
    },
  },
);

// ─── Indexes ────────────────────────────────────────────

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ 'variants.sku': 1 }, { unique: true });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ createdAt: -1 });

// ─── Pre-save: auto-generate slug ──────────────────────

ProductSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.isModified('slug')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

// ─── Model ──────────────────────────────────────────────

export const ProductModel: Model<IProduct> = mongoose.model<IProduct>('Product', ProductSchema);
