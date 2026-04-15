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
    .index("by_hidden", ["hidden"]),
});
