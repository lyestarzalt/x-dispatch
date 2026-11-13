import { type RefObject, useLayoutEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { mapPanelLayout } from './mapPanelLayout';

export function useMapPanelLayout(
  rootRef: RefObject<HTMLDivElement | null>,
  toolbarRef: RefObject<HTMLDivElement | null>,
  hasAirport: boolean
) {
  const [layout, setLayout] = useState(() => mapPanelLayout(Infinity, hasAirport));
  const [activePanel, setActivePanel] = useState<'planner' | 'airport'>('planner');
  const fontSize = useSettingsStore((s) => s.appearance.fontSize);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const toolbar = toolbarRef.current;
    if (!root || !toolbar) return;

    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const next = mapPanelLayout(root.clientWidth / rem, hasAirport);
      setLayout((current) =>
        current.singlePanel === next.singlePanel && current.inlineExplore === next.inlineExplore
          ? current
          : next
      );
      const dockTop = `calc(${toolbar.getBoundingClientRect().height}px + 0.75rem)`;
      if (root.style.getPropertyValue('--map-panel-top') !== dockTop) {
        root.style.setProperty('--map-panel-top', dockTop);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(toolbar);
    measure();
    return () => observer.disconnect();
  }, [rootRef, toolbarRef, fontSize, hasAirport]);

  useLayoutEffect(() => {
    const offAirport = useAppStore.subscribe((state, previous) => {
      if (
        (state.showSidebar && !previous.showSidebar) ||
        (state.selectedAirportData && state.selectedAirportData !== previous.selectedAirportData) ||
        (state.pendingAirportTab && state.pendingAirportTab !== previous.pendingAirportTab) ||
        (state.startPosition?.airport &&
          state.startPosition.airport === state.selectedICAO &&
          state.startPosition !== previous.startPosition)
      ) {
        setActivePanel('airport');
      }
    });
    const offPlanner = usePlanBuilderStore.subscribe((state, previous) => {
      if (
        state.isOpen &&
        (!previous.isOpen ||
          (state.explore && state.explore !== previous.explore) ||
          (previous.panel === 'rail' && state.panel !== 'rail'))
      ) {
        setActivePanel('planner');
      }
    });
    return () => {
      offAirport();
      offPlanner();
    };
  }, []);

  return { ...layout, activePanel, setActivePanel };
}
