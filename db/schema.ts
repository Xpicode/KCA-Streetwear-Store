import {
  jsonb,
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AddressParts } from "../lib/address";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRole = pgEnum("user_role", ["owner", "staff"]);
export const customerStatus = pgEnum("customer_status", ["pending", "approved", "blocked"]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "confirmed",
  "packed",
  "delivered",
  "paid",
  "cancelled",
]);
/** Which store(s) list a product. Hiding it from both is products.is_active = false. */
export const productShowIn = pgEnum("product_show_in", ["both", "wholesale", "retail"]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "partial", "paid"]);
export const movementType = pgEnum("movement_type", ["in", "sale", "adjust", "return"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "bank", "ewallet"]);

// money columns: numeric(10,2) read as JS numbers
const money = (name: string) => numeric(name, { precision: 10, scale: 2, mode: "number" });

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Failed sign-in counters (per email / per IP), shared by every server instance. See lib/rate-limit.ts. */
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
}).enableRLS();

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  shopName: text("shop_name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email").unique(),
  address: text("address"),
  /** The checkout address fields as typed, so the form can be prefilled next time. `address` is the one-line version. */
  addressParts: jsonb("address_parts").$type<AddressParts>(),
  priceGroup: text("price_group").notNull().default("standard"),
  status: customerStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
}).enableRLS();

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    categoryId: integer("category_id").references(() => categories.id),
    description: text("description"),
    imageUrl: text("image_url"),
    basePrice: money("base_price").notNull(),
    /** Retail store price per unit (no tiers, no MOQ). NULL = not sold in the retail store. */
    retailPrice: money("retail_price"),
    /** What one unit costs you (supplier price). Used for the profit preview; actual sold cost still comes from stock batches. */
    baseCost: money("base_cost").notNull().default(0),
    unit: text("unit").notNull().default("pc"),
    moq: integer("moq").notNull().default(1),
    reorderLevel: integer("reorder_level").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    showIn: productShowIn("show_in").notNull().default("both"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.categoryId)]
).enableRLS();

/** One row per size/colour. A product with no options still gets one "default" variant. */
export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    size: text("size"),
    color: text("color"),
    skuSuffix: text("sku_suffix"),
    priceOverride: money("price_override"),
    stockOnHand: integer("stock_on_hand").notNull().default(0),
    stockReserved: integer("stock_reserved").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    uniqueIndex("variants_unique_option").on(t.productId, t.size, t.color),
  ]
).enableRLS();

/** Quantity discounts: the highest min_qty <= ordered qty wins. price_group null = everyone. */
export const priceTiers = pgTable(
  "price_tiers",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    minQty: integer("min_qty").notNull(),
    price: money("price").notNull(),
    priceGroup: text("price_group"),
  },
  (t) => [index("tiers_product_idx").on(t.productId)]
).enableRLS();

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact"),
  phone: text("phone"),
  notes: text("notes"),
}).enableRLS();

/** One row per purchase line. qty_remaining lets you do FIFO or weighted-average cost. */
export const stockBatches = pgTable(
  "stock_batches",
  {
    id: serial("id").primaryKey(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariants.id),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    qtyReceived: integer("qty_received").notNull(),
    qtyRemaining: integer("qty_remaining").notNull(),
    unitCost: money("unit_cost").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    reference: text("reference"),
  },
  (t) => [index("batches_variant_idx").on(t.variantId), index("batches_supplier_idx").on(t.supplierId)]
).enableRLS();

/** Audit trail. stock_on_hand should always equal the sum of qty for that variant. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariants.id),
    type: movementType("type").notNull(),
    qty: integer("qty").notNull(), // positive = in, negative = out
    referenceId: integer("reference_id"), // batch id or order id
    note: text("note"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("movements_variant_idx").on(t.variantId), index("movements_created_by_idx").on(t.createdBy)]
).enableRLS();

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNo: text("order_no").notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    status: orderStatus("status").notNull().default("pending"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    subtotal: money("subtotal").notNull().default(0),
    discount: money("discount").notNull().default(0),
    total: money("total").notNull().default(0),
    note: text("note"),
    source: text("source").notNull().default("storefront"), // storefront | manual
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    packedAt: timestamp("packed_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    handledBy: integer("handled_by").references(() => users.id),
  },
  (t) => [
    index("orders_customer_idx").on(t.customerId),
    index("orders_status_idx").on(t.status),
    index("orders_delivered_idx").on(t.deliveredAt),
    index("orders_handled_by_idx").on(t.handledBy),
  ]
).enableRLS();

/** unit_cost / line_profit are filled in when the order is PACKED, never changed after. */
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariants.id),
    qty: integer("qty").notNull(),
    unitPrice: money("unit_price").notNull(),
    unitCost: money("unit_cost"),
    lineTotal: money("line_total").notNull(),
    lineProfit: money("line_profit"),
  },
  (t) => [index("items_order_idx").on(t.orderId), index("items_variant_idx").on(t.variantId)]
).enableRLS();

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    method: paymentMethod("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    reference: text("reference"),
  },
  (t) => [index("payments_order_idx").on(t.orderId)]
).enableRLS();

// ---------------------------------------------------------------------------
// Relations (for db.query.* convenience)
// ---------------------------------------------------------------------------
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  tiers: many(priceTiers),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  batches: many(stockBatches),
  movements: many(stockMovements),
}));

export const priceTiersRelations = relations(priceTiers, ({ one }) => ({
  product: one(products, { fields: [priceTiers.productId], references: [products.id] }),
}));

export const stockBatchesRelations = relations(stockBatches, ({ one }) => ({
  variant: one(productVariants, { fields: [stockBatches.variantId], references: [productVariants.id] }),
  supplier: one(suppliers, { fields: [stockBatches.supplierId], references: [suppliers.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

// Handy row types
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
