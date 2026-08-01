"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { importCustomers, type ImportResult, type ImportRow } from "@/app/actions/import";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

const FIELDS = ["name", "phone", "company", "email", "city", "notes"] as const;

/** Maps a CSV header row to our field names, case- and space-insensitively. */
function pickRow(raw: Record<string, string>): ImportRow {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key.trim().toLowerCase().replace(/\s+/g, "_")] = (value ?? "").trim();
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
  const [pending, startTransition] = useTransition();

  function onFile(file: File) {
    setResult(null);
    setParseError(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const mapped = parsed.data.map(pickRow).filter((row) => row.phone);
        if (mapped.length === 0) {
          setParseError("No usable rows found. Check that the file has a header row with a phone column.");
          setRows(null);
          return;
        }
        setRows(mapped);
      },
      error: (error) => setParseError(error.message),
    });
  }

  function commit() {
    if (!rows) return;
    startTransition(async () => {
      const outcome = await importCustomers(rows, assignedToId || null);
      setResult(outcome);
      setRows(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
          className="text-sm"
        />
        {fileName && <span className="text-sm text-slate-500 dark:text-slate-400">{fileName}</span>}
      </div>

      {parseError && <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>}

      {rows && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Preview — {rows.length} row(s), showing first 10</p>
          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  {FIELDS.map((field) => (
                    <th key={field} className="px-3 py-2">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, index) => (
                  <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
