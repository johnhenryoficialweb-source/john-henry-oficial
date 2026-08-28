"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

function toCsvValue(value: unknown): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function ExportCsvButton({
  rows,
  filename,
}: {
  rows: Record<string, unknown>[];
  filename: string;
}) {
  function handleExport() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => toCsvValue(row[h])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
      <DownloadIcon />
      Exportar CSV
    </Button>
  );
}
