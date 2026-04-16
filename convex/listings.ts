import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getAll = query({
  args: {
    showHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.showHidden) {
      return await ctx.db.query("listings").order("desc").collect();
    }
    return await ctx.db
      .query("listings")
      .withIndex("by_hidden", (q) => q.eq("hidden", false))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const upsertListing = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("listings")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: now,
        price: args.price,
        pricePerM2: args.pricePerM2,
        title: args.title,
        location: args.location,
        area: args.area,
        rooms: args.rooms,
        type: args.type,
        phone: args.phone ?? existing.phone,
      });
      return { inserted: false, id: existing._id };
    }

    const id = await ctx.db.insert("listings", {
      ...args,
      firstSeen: now,
      lastSeen: now,
      contactCount: 0,
      favorite: false,
      hidden: false,
    });
    return { inserted: true, id };
  },
});

export const incrementContact = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) throw new Error("Listing not found");
    await ctx.db.patch(args.id, {
      contactCount: listing.contactCount + 1,
    });
  },
});

export const decrementContact = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) throw new Error("Listing not found");
    await ctx.db.patch(args.id, {
      contactCount: Math.max(0, listing.contactCount - 1),
    });
  },
});

export const toggleFavorite = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) throw new Error("Listing not found");
    await ctx.db.patch(args.id, { favorite: !listing.favorite });
  },
});

export const toggleHidden = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) throw new Error("Listing not found");
    await ctx.db.patch(args.id, { hidden: !listing.hidden });
  },
});

export const updateNotes = mutation({
  args: { id: v.id("listings"), notes: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { notes: args.notes });
  },
});
