import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';

interface TableInfo {
  name: string;
  rowCount: number;
  columns: Array<{ name: string; type: string }>;
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  error?: string;
}

const PAGE_SIZE = 50;

export function DatabasePanel() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.debugAPI
      .dbTables()
      .then(setTables)
      .catch(() => setTables([]));
  }, []);

  const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);
  const selectedInfo = tables.find((t) => t.name === selectedTable);

  const runQuery = useCallback(
    async (table: string, newOffset: number, currentFilters: Record<string, string>) => {
      setLoading(true);
      setError(null);
      try {
        const activeFilters = Object.entries(currentFilters).filter(([, v]) => v);
        if (activeFilters.length > 0) {
          // Build WHERE clause with LIKE for each filter
          const whereClauses = activeFilters.map(([col]) => `"${col}" LIKE '%' || ? || '%'`);
          const params = activeFilters.map(([, v]) => v);
          const sql = `SELECT * FROM "${table}" WHERE ${whereClauses.join(' AND ')} LIMIT ${PAGE_SIZE} OFFSET ${newOffset}`;
          const data = await window.debugAPI.dbExec(
            sql.replace(/\?/g, () => {
              const val = params.shift();
              return `'${(val ?? '').replace(/'/g, "''")}'`;
            })
          );
          if (data.error) {
            setError(data.error);
          } else {
            setResult(data);
          }
        } else {
          const data = await window.debugAPI.dbQuery(table, PAGE_SIZE, newOffset);
          setResult(data);
        }
        setOffset(newOffset);
      } catch (err) {
        setError(String(err));
      }
      setLoading(false);
    },
    []
  );

  const handleSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setOffset(0);
    setFilters({});
    setError(null);
    runQuery(tableName, 0, {});
  };

  const handleFilterChange = (col: string, value: string) => {
    const newFilters = { ...filters };
    if (!value) {
      delete newFilters[col];
    } else {
      newFilters[col] = value;
    }
    setFilters(newFilters);

    // Debounce the query
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => {
      if (selectedTable) {
        setOffset(0);
        runQuery(selectedTable, 0, newFilters);
      }
    }, 300);
  };

  return (
    <div className="-mx-3 -my-2 flex h-[460px] gap-0">
      {/* Sidebar */}
      <div className="flex w-44 shrink-0 flex-col border-r border-border/30">
        <div className="flex items-center gap-1.5 px-3 py-2">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="xp-section-heading mb-0 border-0 pb-0">Tables</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {totalRows.toLocaleString()}
          </Badge>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="py-1">
            {tables.map((table) => (
              <button
                key={table.name}
                onClick={() => handleSelect(table.name)}
                className={cn(
                  'flex w-full items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                  selectedTable === table.name
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted/40'
                )}
              >
                <ChevronRight
                  className={cn(
                    'h-3 w-3 shrink-0 transition-transform',
                    selectedTable === table.name && 'rotate-90 text-primary'
                  )}
                />
                <span className="min-w-0 truncate font-mono text-xs">{table.name}</span>
                <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                  {table.rowCount.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!selectedTable ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a table
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-foreground">
                  {selectedTable}
                </span>
                {selectedInfo && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedInfo.rowCount.toLocaleString()} rows
                  </Badge>
                )}
              </div>
              {selectedInfo && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {offset + 1}–{Math.min(offset + PAGE_SIZE, selectedInfo.rowCount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={offset === 0 || loading}
                    onClick={() =>
                      runQuery(selectedTable, Math.max(0, offset - PAGE_SIZE), filters)
                    }
                  >
                    Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={offset + PAGE_SIZE >= selectedInfo.rowCount || loading}
                    onClick={() => runQuery(selectedTable, offset + PAGE_SIZE, filters)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Error */}
            {error && (
              <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Data grid */}
            <div className="flex-1 overflow-auto">
              {result && result.columns.length > 0 ? (
                <table className="w-max min-w-full">
                  <thead className="sticky top-0 z-10 bg-background">
                    <tr className="border-b border-border">
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          className="whitespace-nowrap px-3 py-1.5 text-left text-xs font-medium text-muted-foreground"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50 bg-muted/20">
                      {result.columns.map((col) => (
                        <th key={`f-${col}`} className="px-2 py-1">
                          <input
                            type="text"
                            value={filters[col] ?? ''}
                            onChange={(e) => handleFilterChange(col, e.target.value)}
                            placeholder="filter..."
                            className="w-full min-w-[60px] rounded border border-border/50 bg-background px-1.5 py-0.5 font-mono text-xs font-normal text-foreground placeholder:text-muted-foreground/30 focus:border-primary focus:outline-none"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/20 transition-colors hover:bg-muted/30"
                      >
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="max-w-[280px] truncate whitespace-nowrap px-3 py-1 font-mono text-xs text-foreground"
                            title={String(cell ?? 'null')}
                          >
                            {cell === null ? (
                              <span className="text-muted-foreground/40">null</span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {result.rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={result.columns.length}
                          className="px-3 py-8 text-center text-sm text-muted-foreground"
                        >
                          No matching rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
