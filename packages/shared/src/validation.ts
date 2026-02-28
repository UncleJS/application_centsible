import { z } from "zod";

// ── Auth schemas ──

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  name: z.string().min(1, "Name is required").max(100),
  defaultCurrency: z.string().length(3, "Currency must be a 3-letter ISO code").default("GBP"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// ── Category schemas ──

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be hex format #RRGGBB")
    .nullable()
    .optional(),
  type: z.enum(["income", "expense"]),
});

export const updateCategorySchema = createCategorySchema.omit({ type: true }).partial();

// ── Transaction schemas ──

export const createTransactionSchema = z.object({
  categoryId: z.number().int().positive(),
  type: z.enum(["income", "expense"]),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal with up to 2 decimal places"),
  currency: z.string().length(3),
  description: z.string().max(255).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  subscriptionId: z.number().int().positive().nullable().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionFilterSchema = z.object({
  type: z.enum(["income", "expense"]).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ── Budget schemas ──

export const createBudgetSchema = z.object({
  categoryId: z.number().int().positive(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
  currency: z.string().length(3),
});

export const updateBudgetSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
});

// ── Savings goal schemas ──

export const createSavingsGoalSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  targetAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
  currency: z.string().length(3),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  icon: z.string().max(10).nullable().optional(),
});

export const updateSavingsGoalSchema = createSavingsGoalSchema.partial();

export const createContributionSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
  currency: z.string().length(3),
  note: z.string().max(255).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ── Subscription schemas ──

export const createSubscriptionSchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
  currency: z.string().length(3),
  billingCycle: z.enum(["weekly", "fortnightly", "monthly", "quarterly", "yearly"]),
  nextRenewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  url: z.string().url().nullable().optional(),
  autoRenew: z.boolean().default(true),
});

export const updateSubscriptionSchema = createSubscriptionSchema.partial();

// ── Report schemas ──

export const forecastQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(12).default(3),
});

export const reportQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

// ── Type exports for inference ──

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilter = z.infer<typeof transactionFilterSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;
export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;
export type CreateContributionInput = z.infer<typeof createContributionSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
