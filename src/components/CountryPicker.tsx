import { useMemo, useState } from "react";
import { COUNTRIES, flagFromCode, searchCountries } from "@/lib/countries";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null | undefined;
  onChange: (code: string | null) => void;
  className?: string;
  /** Show a "No country selected" clearing option. */
  allowClear?: boolean;
}

/** Searchable country selector with flag emojis. */
export function CountryPicker({ value, onChange, className, allowClear }: Props) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCountries(query, 40), [query]);
  const current = value ? value.toUpperCase() : null;

  return (
    <div className={cn("flex flex-col border border-border rounded-xl overflow-hidden", className)}>
      <div className="relative p-2 border-b border-border bg-background">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries"
          className="pl-9 bg-muted border-0"
          aria-label="Search countries"
        />
      </div>
      <div className="overflow-y-auto max-h-72" role="listbox" aria-label="Countries">
        {allowClear && !query && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-selected={current === null}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/60 text-left"
          >
            <span>{flagFromCode("")}</span> No country selected
          </button>
        )}
        {results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No countries match “{query}”.</div>
        )}
        {results.map((c) => {
          const active = c.code === current;
          return (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onChange(c.code)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-accent/60 transition-colors",
                active && "bg-primary/10 font-semibold"
              )}
            >
              <span className="text-base leading-none">{c.flag}</span>
              <span className="flex-1 truncate">{c.name}</span>
              {active && <span className="text-xs text-primary">Selected</span>}
            </button>
          );
        })}
      </div>
      <div className="px-4 py-1.5 text-[11px] text-muted-foreground border-t border-border">
        {COUNTRIES.length} countries · Your exact location is never shared
      </div>
    </div>
  );
}
