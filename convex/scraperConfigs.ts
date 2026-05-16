import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const KNOWN_SOURCES = [
  "imovirtual",
  "olx",
  "casa.sapo",
  "supercasa",
  "casa.iol",
  "casayes",
] as const;

const transactionValidator = v.union(
  v.literal("comprar"),
  v.literal("arrendar")
);

const propertyTypesValidator = v.array(
  v.union(v.literal("moradia"), v.literal("apartamento"))
);

const DEFAULTS: Array<Omit<Doc<"scraperConfigs">, "_id" | "_creationTime">> = [
  {
    source: "imovirtual",
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    location: ["leiria", "leiria"],
    ownerType: "ALL",
    pages: 3,
  },
  {
    source: "olx",
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    location: ["leiria"],
    pages: 3,
  },
  {
    source: "casa.sapo",
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    location: ["leiria"],
    pages: 3,
  },
  {
    source: "supercasa",
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    location: ["leiria"],
    pages: 3,
  },
  {
    source: "casa.iol",
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    location: ["leiria"],
    pages: 3,
  },
  {
    source: "casayes",
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    location: ["leiria", "leiria"],
    pages: 3,
  },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("scraperConfigs").collect();
  },
});

export const listEnabled = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("scraperConfigs").collect();
    return rows.filter((r) => r.enabled);
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    for (const cfg of DEFAULTS) {
      const existing = await ctx.db
        .query("scraperConfigs")
        .withIndex("by_source", (q) => q.eq("source", cfg.source))
        .first();
      if (existing) continue;
      await ctx.db.insert("scraperConfigs", cfg);
      created++;
    }
    return { created };
  },
});

export const update = mutation({
  args: {
    id: v.id("scraperConfigs"),
    enabled: v.optional(v.boolean()),
    transaction: v.optional(transactionValidator),
    propertyTypes: v.optional(propertyTypesValidator),
    location: v.optional(v.array(v.string())),
    ownerType: v.optional(v.string()),
    priceMin: v.optional(v.number()),
    priceMax: v.optional(v.number()),
    areaMin: v.optional(v.number()),
    areaMax: v.optional(v.number()),
    pages: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const setEnabled = mutation({
  args: { id: v.id("scraperConfigs"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { enabled: args.enabled });
  },
});

export { KNOWN_SOURCES };
