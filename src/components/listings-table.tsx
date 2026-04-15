"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { ContactTracker } from "./contact-tracker";
import {
  Star,
  EyeOff,
  ExternalLink,
  Eye,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useState, useMemo } from "react";

type Listing = Doc<"listings">;

type SortField = "firstSeen" | "price" | "contactCount" | "rooms" | "area";
type SortDir = "asc" | "desc";

function parsePrice(price: string): number {
  const num = price.replace(/[^\d]/g, "");
  return num ? parseInt(num, 10) : 0;
}

function parseArea(area: string): number {
  const match = area.match(/([\d.,]+)/);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

export function ListingsTable({ listings }: { listings: Listing[] }) {
  const toggleFavorite = useMutation(api.listings.toggleFavorite);
  const toggleHidden = useMutation(api.listings.toggleHidden);

  const [sortField, setSortField] = useState<SortField>("firstSeen");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterFavOnly, setFilterFavOnly] = useState(false);
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    let filtered = [...listings];

    if (filterFavOnly) {
      filtered = filtered.filter((l) => l.favorite);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.location.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "firstSeen":
          cmp = a.firstSeen - b.firstSeen;
          break;
        case "price":
          cmp = parsePrice(a.price) - parsePrice(b.price);
          break;
        case "contactCount":
          cmp = a.contactCount - b.contactCount;
          break;
        case "rooms":
          cmp = (a.rooms || "").localeCompare(b.rooms || "");
          break;
        case "area":
          cmp = parseArea(a.area || "") - parseArea(b.area || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [listings, sortField, sortDir, filterFavOnly, search]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ChevronUp className="h-3 w-3 opacity-20" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search title or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={() => setFilterFavOnly(!filterFavOnly)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm ${
            filterFavOnly
              ? "border-yellow-400 bg-yellow-50 text-yellow-700"
              : "hover:bg-accent"
          }`}
        >
          <Star
            className={`h-4 w-4 ${filterFavOnly ? "fill-yellow-400 text-yellow-400" : ""}`}
          />
          Favorites
        </button>
        <span className="text-sm text-muted-foreground">
          {sorted.length} results
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10 px-3 py-3"></th>
              <th className="px-3 py-3 text-left font-medium">Title</th>
              <th
                className="cursor-pointer px-3 py-3 text-left font-medium"
                onClick={() => toggleSort("price")}
              >
                <span className="inline-flex items-center gap-1">
                  Price <SortIcon field="price" />
                </span>
              </th>
              <th className="px-3 py-3 text-left font-medium">Price/m2</th>
              <th className="px-3 py-3 text-left font-medium">Location</th>
              <th
                className="cursor-pointer px-3 py-3 text-left font-medium"
                onClick={() => toggleSort("rooms")}
              >
                <span className="inline-flex items-center gap-1">
                  Rooms <SortIcon field="rooms" />
                </span>
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-left font-medium"
                onClick={() => toggleSort("area")}
              >
                <span className="inline-flex items-center gap-1">
                  Area <SortIcon field="area" />
                </span>
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-center font-medium"
                onClick={() => toggleSort("contactCount")}
              >
                <span className="inline-flex items-center gap-1">
                  Contacts <SortIcon field="contactCount" />
                </span>
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-left font-medium"
                onClick={() => toggleSort("firstSeen")}
              >
                <span className="inline-flex items-center gap-1">
                  Found <SortIcon field="firstSeen" />
                </span>
              </th>
              <th className="w-20 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((listing) => (
              <tr
                key={listing._id}
                className={`border-b transition-colors hover:bg-muted/30 ${
                  listing.hidden ? "opacity-40" : ""
                }`}
              >
                <td className="px-3 py-3">
                  <button
                    onClick={() => toggleFavorite({ id: listing._id })}
                    className="hover:scale-110"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        listing.favorite
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                </td>
                <td className="max-w-[250px] truncate px-3 py-3 font-medium">
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {listing.title}
                  </a>
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold">
                  {listing.price}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                  {listing.pricePerM2 || "—"}
                </td>
                <td className="max-w-[180px] truncate px-3 py-3">
                  {listing.location}
                </td>
                <td className="px-3 py-3">{listing.rooms || "—"}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  {listing.area || "—"}
                </td>
                <td className="px-3 py-3 text-center">
                  <ContactTracker
                    listingId={listing._id}
                    count={listing.contactCount}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                  {new Date(listing.firstSeen).toLocaleDateString("pt-PT")}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-1 hover:bg-accent"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                    <button
                      onClick={() => toggleHidden({ id: listing._id })}
                      className="rounded p-1 hover:bg-accent"
                      title={listing.hidden ? "Restore" : "Dismiss"}
                    >
                      {listing.hidden ? (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
