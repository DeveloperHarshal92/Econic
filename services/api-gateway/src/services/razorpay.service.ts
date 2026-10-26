import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export interface CreateRazorpayOrderInput {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface VerifySignatureInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export class RazorpayService {
  private client: Razorpay | null = null;

  /**
   * Lazily validate credentials and initialize Razorpay client
   */
  private getClient(): Razorpay {
    if (!this.client) {
      const { keyId, keySecret } = config.razorpay;

      if (!keyId || !keySecret) {
        logger.error('Razorpay initialization failed: Missing credentials in configuration');
        throw new AppError(
          'Payment gateway configuration is missing or invalid on the server',
          500
        );
      }

      this.client = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      logger.info('Razorpay client initialized successfully', { keyIdPrefix: keyId.substring(0, 8) });
    }

    return this.client;
  }

  /**
   * Get public Key ID safely for frontend checkout initialization
   */
  getPublicKeyId(): string {
    const { keyId } = config.razorpay;
    if (!keyId) {
      throw new AppError('Payment gateway configuration is missing or invalid on the server', 500);
    }
    return keyId;
  }

  /**
   * Create an order in Razorpay
   */
  async createRazorpayOrder(input: CreateRazorpayOrderInput): Promise<any> {
    const client = this.getClient();
    const currency = input.currency || config.razorpay.currency || 'INR';

    try {
      const order = await client.orders.create({
        amount: input.amountPaise,
        currency,
        receipt: input.receipt,
        notes: input.notes,
      });

      logger.info('Razorpay order created successfully', {
        razorpayOrderId: order.id,
        receipt: input.receipt,
        amount: input.amountPaise,
        currency,
      });

      return order;
    } catch (err) {
      logger.error('Failed to create Razorpay order', {
        receipt: input.receipt,
        error: err instanceof Error ? err.message : 'Unknown Razorpay error',
      });
      throw new AppError('Failed to initiate payment with payment gateway', 502);
    }
  }

  /**
   * Verifies Razorpay payment signature using timing-safe HMAC-SHA256 comparison.
   * Signature format: HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, secret)
   */
  verifyPaymentSignature(input: VerifySignatureInput): boolean {
    const { keySecret } = config.razorpay;
    if (!keySecret) {
      logger.error('Signature verification failed: Missing secret key');
      throw new AppError('Payment gateway configuration is missing on the server', 500);
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return false;
    }

    // Razorpay signature payload: "<order_id>|<payment_id>"
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(razorpaySignature, 'utf8');

    // Safe comparison: ensure buffers have equal byte length before timingSafeEqual
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  /**
   * Fetch payment details from Razorpay API for server-side verification
   */
  async fetchPayment(paymentId: string): Promise<any> {
    const client = this.getClient();
    try {
      return await client.payments.fetch(paymentId);
    } catch (err) {
      logger.error('Failed to fetch payment from Razorpay API', {
        paymentId,
        error: err instanceof Error ? err.message : 'Unknown Razorpay fetch error',
      });
      throw new AppError('Failed to verify payment with payment gateway', 502);
    }
  }
}

export const razorpayService = new RazorpayService();
