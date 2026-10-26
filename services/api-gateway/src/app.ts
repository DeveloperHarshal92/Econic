import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { errorHandler } from "./middleware";
import { httpLogStream } from "./utils/logger";
import productRoutes from "./routes/product.routes";
import cartRoutes from "./routes/cart.routes";
import orderRoutes from "./routes/order.routes";
import analyticsRoutes from "./routes/analytics.routes";
import healthRoutes from "./routes/health.routes";

export function createApp(): express.Application {
  const app = express();

  // ─── Security ───────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: [...config.cors.origins],
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-cart-session",
        "idempotency-key",
        "stripe-signature",
      ],
    }),
  );

  // ─── Rate Limiting ─────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
      },
    },
  });
  app.use("/api/", limiter);

  // ─── Body Parsing ──────────────────────────────────────
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ─── HTTP Request Logging ──────────────────────────────
  app.use(morgan("dev"));

  // ─── Routes ────────────────────────────────────────────
  app.use("/api/health", healthRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/analytics", analyticsRoutes);

  // ─── 404 Handler ───────────────────────────────────────
  app.use("/api/*", (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "API endpoint not found",
      },
    });
  });

  // ─── Global Error Handler ─────────────────────────────
  app.use(errorHandler);

  return app;
}
