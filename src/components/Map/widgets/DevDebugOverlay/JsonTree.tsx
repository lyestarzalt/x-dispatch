import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils/helpers';

type Value = unknown;

/**
 * Compact JSON tree for the dev state panel. Coordinate arrays (sequences
 * of [lon, lat] number pairs) collapse to "N coords" instead of dumping
 * thousands of lines — that's the dominant noise source for `selectedAirportData`.
 */
export function JsonTree({ value }: { value: Value }) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return (
      <div className="space-y-0">
        {Object.entries(value as Record<string, Value>).map(([k, v]) => (
          <JsonNode key={k} name={k} value={v} depth={0} />
        ))}
      </div>
    );
  }
  return <JsonNode name="" value={value} depth={0} />;
}

function JsonNode({ name, value, depth }: { name: string; value: Value; depth: number }) {
  // Leaves render inline; only objects and non-coord arrays get a collapsible.
  if (isPrimitive(value)) {
    return <LeafRow name={name} value={value} depth={depth} />;
  }
  if (Array.isArray(value)) {
    if (isCoordArray(value)) {
      return (
        <LeafRow
          name={name}
          value={undefined}
          depth={depth}
          preview={`${value.length} coords`}
          previewClass="text-info"
        />
      );
    }
    return (
      <CollapsibleRow
        name={name}
        depth={depth}
        preview={`Array(${value.length})`}
        previewClass="text-info"
      >
        {value.map((v, i) => (
          <JsonNode key={i} name={`[${i}]`} value={v} depth={depth + 1} />
        ))}
      </CollapsibleRow>
    );
  }
  const obj = value as Record<string, Value>;
  const keys = Object.keys(obj);
  const previewKeys = keys.slice(0, 3).join(', ') + (keys.length > 3 ? ', …' : '');
  return (
    <CollapsibleRow
      name={name}
      depth={depth}
      preview={`{${keys.length}} ${previewKeys}`}
      previewClass="text-muted-foreground/60"
    >
      {keys.map((k) => (
        <JsonNode key={k} name={k} value={obj[k]} depth={depth + 1} />
      ))}
    </CollapsibleRow>
  );
}

function CollapsibleRow({
  name,
  depth,
  preview,
  previewClass,
  children,
}: {
  name: string;
  depth: number;
  preview: string;
  previewClass?: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button
          className="group flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm hover:bg-muted/40"
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform duration-150 group-data-[state=open]:rotate-90" />
          <span className="font-medium text-foreground/80">{name}</span>
          <span className={cn('ml-2 truncate text-xs', previewClass)}>{preview}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

function LeafRow({
  name,
  value,
  depth,
  preview,
  previewClass,
}: {
  name: string;
  value: Value;
  depth: number;
  preview?: string;
  previewClass?: string;
}) {
  const { text, className } = preview
    ? { text: preview, className: previewClass ?? '' }
    : formatPrimitive(value);
  return (
    <div
      className="flex items-center gap-1 px-1 py-0.5 text-sm"
      style={{ paddingLeft: depth * 12 + 16 }}
    >
      {name && <span className="font-medium text-foreground/70">{name}</span>}
      {name && <span className="text-muted-foreground/40">:</span>}
      <span className={cn('truncate font-mono text-xs', className)}>{text}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function isPrimitive(v: Value): boolean {
  return (
    v === null ||
    v === undefined ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  );
}

/**
 * True when an array looks like a coordinate sequence: every element is
 * a 2- or 3-tuple of numbers. Catches `[lon, lat]`, `[lon, lat, alt]`, and
 * polygon rings without descending into geometries with mixed contents.
 */
function isCoordArray(arr: unknown[]): boolean {
  if (arr.length < 2) return false;
  for (const el of arr) {
    if (!Array.isArray(el)) return false;
    if (el.length < 2 || el.length > 3) return false;
    if (!el.every((n) => typeof n === 'number')) return false;
  }
  return true;
}

function formatPrimitive(v: Value): { text: string; className: string } {
  if (v === null) return { text: 'null', className: 'text-muted-foreground/40' };
  if (v === undefined) return { text: 'undefined', className: 'text-muted-foreground/40' };
  if (typeof v === 'string') return { text: `"${v}"`, className: 'text-success' };
  if (typeof v === 'number') return { text: String(v), className: 'text-warning' };
  if (typeof v === 'boolean') return { text: String(v), className: 'text-info' };
  return { text: String(v), className: '' };
}
