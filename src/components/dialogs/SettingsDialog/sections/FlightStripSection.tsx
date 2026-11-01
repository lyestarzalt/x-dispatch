import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CornerDownRight, GalleryHorizontal, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  type FlightStripField,
  type FlightStripReadout,
  withFieldVisible,
} from '@/lib/flightStrip/fields';
import { cn } from '@/lib/utils/helpers';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  SettingsHeader,
  SettingsSectionBlock,
  SettingsSliderRow,
  SettingsToggleRow,
} from '../primitives';
import type { SettingsSectionProps } from '../types';

const isLinux = window.appAPI?.platform === 'linux';
const isRemote = window.appAPI?.isRemoteClient === true;

/** The aircraft identity and the two lines around each value; they keep their places on the strip. */
const EXTRA_FIELDS: FlightStripField[] = ['aircraft', 'targets', 'details'];

/** Readouts with a second, smaller reading under the value. */
const READOUTS_WITH_DETAILS: ReadonlySet<FlightStripReadout> = new Set<FlightStripReadout>([
  'speed',
  'altitude',
  'heading',
  'wind',
  'com1',
  'qnh',
]);

/** Turns one field's row into its translation keys (`speed` → `fieldSpeed`). */
function fieldKey(field: FlightStripField): string {
  return `field${field.charAt(0).toUpperCase()}${field.slice(1)}`;
}

interface ReadoutRowProps {
  readout: FlightStripReadout;
  /** One-based place on the strip, counted from the left. */
  position: number;
  checked: boolean;
  /** The last readout left on cannot be turned off. */
  locked: boolean;
  /** The details line is on; off, the row's own line is struck through. */
  showDetails: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * One readout as it sits on the strip: its place from the left, the value it
 * shows and the smaller reading under it. The grip drags it along the strip.
 */
function ReadoutRow({
  readout,
  position,
  checked,
  locked,
  showDetails,
  onCheckedChange,
}: ReadoutRowProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: readout,
  });
  const details = READOUTS_WITH_DETAILS.has(readout);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-card flex items-center gap-2 rounded-lg border py-2.5 pr-4 pl-2',
        !checked && 'opacity-60',
        isDragging && 'border-primary relative z-10 opacity-100 shadow-xl'
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        {...attributes}
        {...listeners}
        aria-label={t('settings.flightStrip.dragReadout')}
        className={cn(
          'text-muted-foreground/50 hover:text-muted-foreground cursor-grab',
          isDragging && 'text-primary cursor-grabbing'
        )}
      >
        <GripVertical className="h-4 w-4" />
      </Button>
      <span
        className={cn(
          'bg-muted/50 text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold tabular-nums',
          isDragging && 'bg-primary/20 text-primary'
        )}
      >
        {position}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5 pl-1">
        <p id={titleId} className="text-sm font-medium">
          {t(`settings.flightStrip.${fieldKey(readout)}`)}
        </p>
        <p className="text-muted-foreground text-sm">
          {t(`settings.flightStrip.${fieldKey(readout)}Description`)}
        </p>
        {/* Always in place, so the rows keep their height when the details line toggles */}
        {details && (
          <p
            className={cn(
              'text-muted-foreground/70 flex items-center gap-1 text-xs',
              !showDetails && 'text-muted-foreground/40 line-through'
            )}
          >
            <CornerDownRight className="h-3 w-3 shrink-0" />
            {t(`settings.flightStrip.${fieldKey(readout)}Details`)}
          </p>
        )}
      </div>
      <Switch
        aria-labelledby={titleId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={locked}
      />
    </div>
  );
}

/**
 * Everything about the live aircraft strip: the detached window over the simulator
 * (click-through lock, stacking, auto-open, opacity), its size on the map, and which
 * readouts it shows. One set of readouts drives the map strip and the window alike.
 */
export default function FlightStripSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const flightStrip = useSettingsStore((s) => s.flightStrip);
  const updateFlightStripSettings = useSettingsStore((s) => s.updateFlightStripSettings);
  const setFlightStripScale = useSettingsStore((s) => s.setFlightStripScale);
  const setFlightStripOpacity = useSettingsStore((s) => s.setFlightStripOpacity);
  const setFlightStripField = useSettingsStore((s) => s.setFlightStripField);
  const setFlightStripOrder = useSettingsStore((s) => s.setFlightStripOrder);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const { order } = flightStrip;
    const from = order.indexOf(active.id as FlightStripReadout);
    const to = order.indexOf(over.id as FlightStripReadout);
    if (from < 0 || to < 0) return;
    setFlightStripOrder(arrayMove(order, from, to));
  };

  const previewOpacity = (percent: number) =>
    window.appAPI.setFlightStripWindowOptions({
      locked: flightStrip.locked,
      alwaysOnTop: flightStrip.alwaysOnTop,
      opacity: percent / 100,
    });

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={GalleryHorizontal}
        title={t('settings.flightStrip.title')}
        description={t('settings.flightStrip.description')}
      />

      {/* The detached window only exists on the desktop */}
      {!isRemote && (
        <SettingsSectionBlock
          title={t('settings.flightStrip.window')}
          description={t('settings.flightStrip.windowDescription')}
        >
          <div className="space-y-3">
            <SettingsToggleRow
              title={t('settings.flightStrip.lock')}
              description={t(
                isLinux
                  ? 'settings.flightStrip.lockDescriptionLinux'
                  : 'settings.flightStrip.lockDescription'
              )}
              checked={flightStrip.locked}
              onCheckedChange={(locked) => updateFlightStripSettings({ locked })}
            />
            <SettingsToggleRow
              title={t('settings.flightStrip.alwaysOnTop')}
              description={t('settings.flightStrip.alwaysOnTopDescription')}
              checked={flightStrip.alwaysOnTop}
              onCheckedChange={(alwaysOnTop) => updateFlightStripSettings({ alwaysOnTop })}
            />
            <SettingsToggleRow
              title={t('settings.flightStrip.autoOpen')}
              description={t('settings.flightStrip.autoOpenDescription')}
              checked={flightStrip.autoOpen}
              onCheckedChange={(autoOpen) => updateFlightStripSettings({ autoOpen })}
            />
          </div>
        </SettingsSectionBlock>
      )}

      <SettingsSectionBlock title={t('settings.flightStrip.look')}>
        <div className="space-y-3">
          <SettingsSliderRow
            title={t('settings.flightStrip.scale')}
            description={t('settings.flightStrip.scaleDescription')}
            value={Math.round(flightStrip.scale * 100)}
            defaultValue={100}
            min={100}
            max={200}
            step={10}
            onCommit={(percent) => setFlightStripScale(percent / 100)}
            resetLabel={t('settings.flightStrip.reset')}
          />
          {/* Electron cannot change window opacity on Linux */}
          {!isLinux && !isRemote && (
            <SettingsSliderRow
              title={t('settings.flightStrip.opacity')}
              description={t('settings.flightStrip.opacityDescription')}
              value={Math.round(flightStrip.opacity * 100)}
              defaultValue={100}
              min={30}
              max={100}
              step={5}
              onCommit={(percent) => setFlightStripOpacity(percent / 100)}
              onPreview={previewOpacity}
              resetLabel={t('settings.flightStrip.reset')}
            />
          )}
        </div>
      </SettingsSectionBlock>

      <SettingsSectionBlock
        title={t('settings.flightStrip.readouts')}
        description={t('settings.flightStrip.readoutsDescription')}
      >
        <SettingsToggleRow
          title={t('settings.flightStrip.wheelAdjust')}
          description={t('settings.flightStrip.wheelAdjustDescription')}
          checked={flightStrip.wheelAdjust}
          onCheckedChange={(wheelAdjust) => updateFlightStripSettings({ wheelAdjust })}
        />
        {/* One column: top to bottom here is left to right on the strip */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={flightStrip.order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {flightStrip.order.map((readout, index) => {
                const visible = flightStrip.fields[readout];
                return (
                  <ReadoutRow
                    key={readout}
                    readout={readout}
                    position={index + 1}
                    checked={visible}
                    locked={
                      visible &&
                      withFieldVisible(flightStrip.fields, readout, false) === flightStrip.fields
                    }
                    showDetails={flightStrip.fields.details}
                    onCheckedChange={(checked) => setFlightStripField(readout, checked)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </SettingsSectionBlock>

      <SettingsSectionBlock
        title={t('settings.flightStrip.extras')}
        description={t('settings.flightStrip.extrasDescription')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {EXTRA_FIELDS.map((field) => (
            <SettingsToggleRow
              key={field}
              title={t(`settings.flightStrip.${fieldKey(field)}`)}
              description={t(`settings.flightStrip.${fieldKey(field)}Description`)}
              checked={flightStrip.fields[field]}
              onCheckedChange={(checked) => setFlightStripField(field, checked)}
            />
          ))}
        </div>
      </SettingsSectionBlock>
    </div>
  );
}
