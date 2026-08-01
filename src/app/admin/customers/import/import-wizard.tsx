"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { importCustomers, type ImportResult, type ImportRow } from "@/app/actions/import";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

const FIELDS = ["name", "phone", "company", "email", "city", "notes"] as const;

/** Maps a header row to our field names, case- and space-insensitively. Values are
 *  coerced to strings so spreadsheet number cells (e.g. a phone) come through intact. */
function pickRow(raw: Record<string, unknown>): ImportRow {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key.trim().toLowerCase().replace(/\s+/g, "_")] = String(value ?? "").trim();
  }
  const row = {} as Record<string, string>;
  for (const field of FIELDS) {
    row[field] = normalized[field] ?? normalized[field === "phone" ? "phone_number" : field] ?? "";
  }
  return row as ImportRow;
}

export default function ImportWizard({ callers }: { callers: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [assignedToId, setAssignedToId] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function applyRecords(records: Record<string, unknown>[]) {
    const mapped = records.map(pickRow).filter((row) => row.phone);
    if (mapped.length === 0) {
      setParseError("No usable rows found. Check that the file has a header row with a phone column.");
      setRows(null);
      return;
    }
    setRows(mapped);
  }

  function onFile(file: File) {
    setResult(null);
    setParseError(null);
    setFileName(file.name);

    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      // Spreadsheet: read the first sheet with SheetJS.
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const wb = XLSX.read(reader.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
          applyRecords(records);
        } catch {
          setParseError("Could not read that spreadsheet. Save it as .xlsx or .csv and try again.");
          setRows(null);
        }
      };
      reader.onerror = () => setParseError("Could not read the file.");
      reader.readAsArrayBuffer(file);
      return;
    }

    // Otherwise treat it as CSV.
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => applyRecords(parsed.data),
      error: (error) => setParseError(error.message),
    });
  }

  function commit() {
    if (!rows) return;
    startTransition(async () => {
      const outcome = await importCustomers(rows, assignedToId || null);
      setResult(outcome);
      setRows(null);
      // Refresh the customer list rendered below this wizard so it shows the new rows.
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Click to browse, or drag a file onto the zone. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
          dragging
            ? "border-slate-500 bg-slate-100 dark:border-slate-400 dark:bg-slate-800"
            : "border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        }`}
      >
        <p className="font-medium">Drag a CSV or Excel file here, or click to choose one</p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Accepts .csv, .xlsx and .xls. Only a phone column is required.
        </p>
        {fileName && <p className="mt-2 text-slate-600 dark:text-slate-300">Selected: {fileName}</p>}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
          className="hidden"
        />
      </div>

      {parseError && <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>}

      {rows && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Preview — all {rows.length} customer(s) from the file</p>
          {/* Every uploaded row, scrollable, with the header pinned so the list stays readable. */}
          <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">#</th>
                  {FIELDS.map((field) => (
                    <th key={field} className="px-3 py-2">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 tabular-nums text-slate-400">{index + 1}</td>
                    {FIELDS.map((field) => (
                      <td key={field} className="px-3 py-2">
                        {row[field] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium">
              Assign all to
              <select
                value={assignedToId}
                onChange={(event) => setAssignedToId(event.target.value)}
                className={`${inputClass} mt-1 w-auto`}
              >
                <option value="">Leave unassigned</option>
                {callers.map((caller) => (
                  <option key={caller.id} value={caller.id}>
                    {caller.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={commit} disabled={pending} className={buttonClass}>
              {pending ? "Importing…" : `Import ${rows.length} row(s)`}
            </button>
            <button type="button" onClick={() => setRows(null)} className={secondaryButtonClass}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-md border border-slate-200 p-4 text-sm dark:border-slate-800">
          {result.error ? (
            <p className="text-red-600 dark:text-red-400">{result.error}</p>
          ) : (
            <>
              <p className="font-medium text-emerald-600 dark:text-emerald-400">
                Imported {result.imported} customer(s).
              </p>
              <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                <li>Skipped — already in database: {result.duplicatesInDb}</li>
                <li>Skipped — duplicate rows in file: {result.duplicatesInFile}</li>
                <li>Skipped — invalid: {result.invalid.length}</li>
              </ul>
              {result.invalid.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-red-600 dark:text-red-400">
                  {result.invalid.map((issue) => (
                    <li key={issue.row}>
                      Row {issue.row}: {issue.reason}
                    </li>
                  ))}
                </ul>
              )}

              {result.imported > 0 && (
                <p className="mt-3 text-slate-600 dark:text-slate-300">
                  The imported customers now appear in the list below.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
