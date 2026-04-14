import ExcelJS from "exceljs";
import path from "path";
import type { Listing } from "./types.js";

export async function exportToExcel(listings: Listing[], outputDir: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Listings");

  sheet.columns = [
    { header: "Source", key: "source", width: 15 },
    { header: "Title", key: "title", width: 50 },
    { header: "Price", key: "price", width: 18 },
    { header: "Price/m\u00B2", key: "pricePerM2", width: 15 },
    { header: "Location", key: "location", width: 40 },
    { header: "Area", key: "area", width: 12 },
    { header: "Rooms", key: "rooms", width: 10 },
    { header: "URL", key: "url", width: 60 },
  ];

  // Style the header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const listing of listings) {
    sheet.addRow(listing);
  }

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: listings.length + 1, column: 8 },
  };

  const today = new Date();
  const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
  const filename = `${dateStr}.xlsx`;
  const filepath = path.join(outputDir, filename);

  await workbook.xlsx.writeFile(filepath);
  return filepath;
}
