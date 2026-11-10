import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Search, filter, group and page for the Drivers and Teams lists, all in the address
 * (`?q=&team=&group=team&page=2`), so a list can be shared and Back restores it.
 */

export const PAGE_SIZE = 25;

export function useListParams() {
  const [params, setParams] = useSearchParams();
  const get = useCallback((name: string) => params.get(name) ?? "", [params]);
  /** Set or clear (empty / null) some params. Any change other than the page returns to page 1. */
  const set = useCallback(
    (updates: Record<string, string | number | null>) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(updates)) {
            if (v == null || v === "" || (k === "page" && Number(v) <= 1)) p.delete(k);
            else p.set(k, String(v));
          }
          if (!("page" in updates)) p.delete("page");
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return { get, set };
}

/** The page of `items` to show, with the page number clamped to what exists. */
export function paginate<T>(items: T[], rawPage: string, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pages, Math.max(1, Number(rawPage) || 1));
  return { page, pages, items: items.slice((page - 1) * size, page * size), from: (page - 1) * size + 1 };
}

export function SearchField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        aria-label={label}
        placeholder={label}
        className="h-10 pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function ListPager({
  page,
  pages,
  total,
  from,
  shown,
  noun,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  from: number;
  shown: number;
  noun: string;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const summary =
    pages > 1 ? `${from} to ${from + shown - 1} of ${total} ${noun}` : `${total} ${noun}`;
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] text-muted-foreground" aria-live="polite">
        {summary}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Previous
          </Button>
          <span className="text-[13px] text-ink-2">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </nav>
  );
}
