"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { importCustomers, type ImportResult, type ImportRow } from "@/app/actions/import";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

const FIELDS = ["name", "phone", "company", "email", "city", "notes"] as const;

/** Small spinning indicator for the loading states. */
function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

/** Header aliases we accept for each field (normalized: lower-case, spaces → "_"). */
const ALIASES: Record<(typeof FIELDS)[number], string[]> = {
  phone: ["phone", "phone_number", "phone_no", "phoneno", "mobile", "mobile_number", "mobile_no", "mobileno", "contact", "contact_number", "contact_no", "number", "whatsapp", "ph"],
  name: ["name", "full_name", "fullname", "customer_name", "customer", "lead_name", "student_name", "contact_name"],
  company: ["company", "organisation", "organization", "org", "firm"],
  email: ["email", "email_id", "e_mail", "mail"],
  city: ["city", "location", "place", "town"],
  notes: ["notes", "note", "remarks", "remark", "comment", "comments"],
};

function norm(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Any header on a row that looks like one of ours — used to find the real header row. */
function looksLikeHeader(cells: unknown[]) {
  const keys = cells.map((c) => norm(String(c ?? "")));
  return keys.includes("phone") || ALIASES.phone.some((a) => keys.includes(a));
}

/** Maps a header row to our field names, case- and space-insensitively. Values are
 *  coerced to strings so spreadsheet number cells (e.g. a phone) come through intact. */
function pickRow(raw: Record<string, unknown>): ImportRow {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[norm(key)] = String(value ?? "").trim();
  }
  const row = {} as Record<string, string>;
  for (const field of FIELDS) {
    row[field] = ALIASES[field].map((a) => normalized[a]).find((v) => v) ?? "";
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
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const canceledRef = useRef(false);
  const router = useRouter();

  function applyRecords(records: Record<string, unknown>[]) {
    const mapped = records.map(pickRow).filter((row) => row.phone);
    if (mapped.length === 0) {
      const found = records[0] ? Object.keys(records[0]).join(", ") : "none";
      setParseError(
        `No usable rows found — no phone column detected. Columns in your file: ${found}. ` +
          `Make sure one column is named phone (or mobile / contact / number).`,
      );
      setRows(null);
      return;
    }
    setRows(mapped);
  }

  /** Turn a sheet's array-of-arrays into objects keyed by the real header row, which may
   *  not be the first row (title rows, a leading serial/ID column, frozen panes…). */
  function recordsFromSheet(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
    let headerIdx = aoa.findIndex((r) => Array.isArray(r) && looksLikeHeader(r));
    if (headerIdx < 0) headerIdx = 0; // fall back to the first row
    const headers = (aoa[headerIdx] ?? []).map((h) => String(h ?? ""));
    return aoa.slice(headerIdx + 1).map((r) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = (r as unknown[])[i];
      });
      return obj;
    });
  }

  function onFile(file: File) {
    setResult(null);
    setParseError(null);
    setRows(null);
    setFileName(file.name);
    canceledRef.current = false;
    setParsing(true);

    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      // Spreadsheet: read the first sheet with SheetJS.
      const reader = new FileReader();
      readerRef.current = reader;
      reader.onload = () => {
        if (canceledRef.current) return;
        try {
          const wb = XLSX.read(reader.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          applyRecords(recordsFromSheet(sheet));
        } catch {
          setParseError("Could not read that spreadsheet. Save it as .xlsx or .csv and try again.");
          setRows(null);
        } finally {
          setParsing(false);
        }
      };
      reader.onerror = () => {
        setParsing(false);
        if (!canceledRef.current) setParseError("Could not read the file.");
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // Otherwise treat it as CSV.
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        if (canceledRef.current) return;
        applyRecords(parsed.data);
        setParsing(false);
      },
      error: (error) => {
        setParsing(false);
        if (!canceledRef.current) setParseError(error.message);
      },
    });
  }

  /** Abort an in-progress file read and reset the picker. */
  function cancelParse() {
    canceledRef.current = true;
    readerRef.current?.abort();
    setParsing(false);
    setRows(null);
    setFileName("");
    setParseError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Big files are sent to the server in batches (well under the server's per-call cap and
  // the request size limit), and the results are added up as we go.
  const BATCH = 2000;

  function commit() {
    if (!rows) return;
    const all = rows;
    startTransition(async () => {
      const total = all.length;
      const agg: ImportResult = { imported: 0, duplicatesInFile: 0, duplicatesInDb: 0, invalid: [] };
      for (let i = 0; i < total; i += BATCH) {
        const chunk = all.slice(i, i + BATCH);
        setProgress({ done: Math.min(i + chunk.length, total), total });
        const outcome = await importCustomers(chunk, assignedToId || null);
        if (outcome.error) {
          agg.error = outcome.error;
          break;
        }
        agg.imported += outcome.imported;
        agg.duplicatesInFile += outcome.duplicatesInFile;
        agg.duplicatesInDb += outcome.duplicatesInDb;
        // Offset each batch's row numbers so the reported row is the file-wide row.
        agg.invalid.push(...outcome.invalid.map((v) => ({ row: v.row + i, reason: v.reason })));
      }
      setResult({ ...agg, invalid: agg.invalid.slice(0, 50) });
      setRows(null);
      setProgress(null);
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
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-sm transition-colors ${
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

      {parsing && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <span className="flex items-center gap-3 font-bold uppercase tracking-wide">
            <Spinner />
            Reading {fileName || "file"}…
          </span>
          <button type="button" onClick={cancelParse} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      )}

      {parseError && <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>}

      {rows && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Preview — {rows.length.toLocaleString()} customer(s) from the file
            {rows.length > 200 ? " (showing first 200)" : ""}
          </p>
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
                {rows.slice(0, 200).map((row, index) => (
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
              {pending ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  {progress ? `Saving ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}…` : "Saving to server…"}
                </span>
              ) : (
                `Import ${rows.length.toLocaleString()} row(s)`
              )}
            </button>
            <button type="button" onClick={() => setRows(null)} disabled={pending} className={secondaryButtonClass}>
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
