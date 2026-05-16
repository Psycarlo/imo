import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  listings: defineTable({
    url: v.string(),
    title: v.string(),
    price: v.string(),
    pricePerM2: v.optional(v.string()),
    location: v.string(),
    area: v.optional(v.string()),
    rooms: v.optional(v.string()),
    source: v.string(),
    type: v.optional(v.string()),
    phone: v.optional(v.string()),
    firstSeen: v.number(),
    lastSeen: v.number(),
    contactCount: v.number(),
    favorite: v.boolean(),
    hidden: v.boolean(),
    notes: v.optional(v.string()),
  })
    .index("by_url", ["url"])
    .index("by_favorite", ["favorite"])
    .index("by_firstSeen", ["firstSeen"])
    .index("by_hidden", ["hidden"])
    .index("by_type", ["type"]),

  scraperConfigs: defineTable({
    source: v.string(),
    enabled: v.boolean(),
    transaction: v.union(v.literal("comprar"), v.literal("arrendar")),
    propertyTypes: v.array(
      v.union(v.literal("moradia"), v.literal("apartamento"))
    ),
    location: v.array(v.string()),
    ownerType: v.optional(v.string()),
    priceMin: v.optional(v.number()),
    priceMax: v.optional(v.number()),
    areaMin: v.optional(v.number()),
    areaMax: v.optional(v.number()),
    pages: v.optional(v.number()),
  }).index("by_source", ["source"]),
});
