import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { SearchResult } from "@/hooks/useGlobalSearch";
import { Calendar, MapPin, User } from "lucide-react";

type GlobalSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (result: SearchResult) => void;
  groupedResults: {
    pages: SearchResult[];
    drivers: SearchResult[];
    races: SearchResult[];
  };
};

export function GlobalSearchDialog({
  open,
  onOpenChange,
  query,
  onQueryChange,
  onSelect,
  groupedResults,
}: GlobalSearchDialogProps) {

  const hasResults =
    groupedResults.pages.length > 0 ||
    groupedResults.drivers.length > 0 ||
    groupedResults.races.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search pages, drivers, and races…"
        value={query}
        onValueChange={onQueryChange}
      />
      <CommandList>
        {!hasResults ? (
          <CommandEmpty>No results found.</CommandEmpty>
        ) : (
          <>
            {groupedResults.pages.length > 0 ? (
              <CommandGroup heading="Pages">
                {groupedResults.pages.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.title}
                    onSelect={() => onSelect(item)}
                  >
                    <MapPin className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                    <span>{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {groupedResults.drivers.length > 0 ? (
              <>
                {groupedResults.pages.length > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading="Drivers">
                  {groupedResults.drivers.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.title} ${item.subtitle ?? ""}`}
                      onSelect={() => onSelect(item)}
                    >
                      <User className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                      <div className="flex flex-col">
                        <span>{item.title}</span>
                        {item.subtitle ? (
                          <span className="text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {groupedResults.races.length > 0 ? (
              <>
                {groupedResults.pages.length > 0 ||
                groupedResults.drivers.length > 0 ? (
                  <CommandSeparator />
                ) : null}
                <CommandGroup heading="Races">
                  {groupedResults.races.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.title} ${item.subtitle ?? ""}`}
                      onSelect={() => onSelect(item)}
                    >
                      <Calendar className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                      <div className="flex flex-col">
                        <span>{item.title}</span>
                        {item.subtitle ? (
                          <span className="text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
