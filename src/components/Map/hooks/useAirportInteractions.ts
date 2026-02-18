import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useAppStore } from '@/stores/appStore';
import type { ParsedAirport } from '@/types/apt';
import type { Runway } from '@/types/apt';
import type { MapRef } from './useMapSetup';

interface UseAirportInteractionsOptions {
  mapRef: MapRef;
  selectedAirportData: ParsedAirport | null;
}

interface UseAirportInteractionsReturn {
  selectGateAsStart: (gate: {
    latitude: number;
    longitude: number;
    name: string;
    index?: number;
    xplaneIndex?: number | string;
  }) => void;
  selectRunwayEndAsStart: (runwayEnd: {
    name: string;
    latitude: number;
    longitude: number;
    index?: number;
    xplaneIndex?: number | string;
  }) => void;
  selectHelipadAsStart: (helipad: {
    name: string;
    latitude: number;
    longitude: number;
    index?: number;
    xplaneIndex?: number | string;
  }) => void;
  navigateToGate: (gate: {
    latitude: number;
    longitude: number;
    heading: number;
    name?: string;
  }) => void;
  navigateToRunway: (runway: Runway) => void;
}

export function useAirportInteractions({
  mapRef,
  selectedAirportData,
}: UseAirportInteractionsOptions): UseAirportInteractionsReturn {
  const hoveredGateId = useRef<number | null>(null);
  const hoveredRunwayEndId = useRef<number | null>(null);
  const selectedGateId = useRef<number | null>(null);
  const selectedRunwayEndId = useRef<number | null>(null);

  const selectedAirportDataRef = useRef<ParsedAirport | null>(null);

  // Update ref in effect to avoid updating during render
  useEffect(() => {
    selectedAirportDataRef.current = selectedAirportData;
  }, [selectedAirportData]);

  const { setStartPosition } = useAppStore();

  // Setup hover and click handlers for gates and runway ends
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleGateMouseEnter = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      const feature = e.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = 'pointer';
      const featureId = feature.id as number;

      if (hoveredGateId.current !== null && hoveredGateId.current !== featureId) {
        map.setFeatureState(
          { source: 'airport-gates', id: hoveredGateId.current },
          { hover: false }
        );
      }
      hoveredGateId.current = featureId;
      map.setFeatureState({ source: 'airport-gates', id: featureId }, { hover: true });
    };

    const handleGateMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      if (hoveredGateId.current !== null) {
        map.setFeatureState(
          { source: 'airport-gates', id: hoveredGateId.current },
          { hover: false }
        );
        hoveredGateId.current = null;
      }
    };

    const handleGateClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      const feature = e.features?.[0];
      if (!feature) return;
      e.originalEvent.stopPropagation();

      const props = feature.properties;
      const featureId = feature.id as number;

      // Clear previous selections
      if (selectedGateId.current !== null) {
        map.setFeatureState(
          { source: 'airport-gates', id: selectedGateId.current },
          { selected: false }
        );
      }
      if (selectedRunwayEndId.current !== null) {
        map.setFeatureState(
          { source: 'airport-runway-ends', id: selectedRunwayEndId.current },
          { selected: false }
        );
        selectedRunwayEndId.current = null;
      }

      selectedGateId.current = featureId;
      map.setFeatureState({ source: 'airport-gates', id: featureId }, { selected: true });

      const currentAirport = selectedAirportDataRef.current;
      if (props && currentAirport) {
        // Calculate X-Plane index: alphabetically sorted by name, then by latitude
        const locations = currentAirport.startupLocations;
        const sortedLocations = [...locations]
          .map((loc, i) => ({ loc, originalIndex: i }))
          .sort((a, b) => {
            const nameCompare = a.loc.name.localeCompare(b.loc.name);
            if (nameCompare !== 0) return nameCompare;
            return a.loc.latitude - b.loc.latitude;
          });

        // Find the xplaneIndex (position in sorted list) for this gate
        const xplaneIndex = sortedLocations.findIndex((item) => item.originalIndex === featureId);

        setStartPosition({
          type: 'ramp',
          name: props.name || `Gate ${featureId}`,
          airport: currentAirport.id,
          latitude: props.latitude,
          longitude: props.longitude,
          index: featureId,
          xplaneIndex: xplaneIndex >= 0 ? xplaneIndex : featureId,
        });
      }
    };

    const handleRunwayEndMouseEnter = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      const feature = e.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = 'pointer';
      const featureId = feature.id as number;

      if (hoveredRunwayEndId.current !== null && hoveredRunwayEndId.current !== featureId) {
        map.setFeatureState(
          { source: 'airport-runway-ends', id: hoveredRunwayEndId.current },
          { hover: false }
        );
      }
      hoveredRunwayEndId.current = featureId;
      map.setFeatureState({ source: 'airport-runway-ends', id: featureId }, { hover: true });
    };

    const handleRunwayEndMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      if (hoveredRunwayEndId.current !== null) {
        map.setFeatureState(
          { source: 'airport-runway-ends', id: hoveredRunwayEndId.current },
          { hover: false }
        );
        hoveredRunwayEndId.current = null;
      }
    };

    const handleRunwayEndClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      const feature = e.features?.[0];
      if (!feature) return;
      e.originalEvent.stopPropagation();

      const props = feature.properties;
      const featureId = feature.id as number;

      // Clear previous selections
      if (selectedRunwayEndId.current !== null) {
        map.setFeatureState(
          { source: 'airport-runway-ends', id: selectedRunwayEndId.current },
          { selected: false }
        );
      }
      if (selectedGateId.current !== null) {
        map.setFeatureState(
          { source: 'airport-gates', id: selectedGateId.current },
          { selected: false }
        );
        selectedGateId.current = null;
      }

      selectedRunwayEndId.current = featureId;
      map.setFeatureState({ source: 'airport-runway-ends', id: featureId }, { selected: true });

      const currentAirport = selectedAirportDataRef.current;
      if (props && currentAirport) {
        // Calculate X-Plane index for runway: "row_end" format
        // featureId is the global end index (runwayIndex * 2 + endIndex)
        const runwayIndex = Math.floor(featureId / 2);
        const whichEnd = featureId % 2;
        const xplaneIndex = `${runwayIndex}_${whichEnd}`;

        setStartPosition({
          type: 'runway',
          name: props.name || `Runway End ${featureId}`,
          airport: currentAirport.id,
          latitude: props.latitude,
          longitude: props.longitude,
          index: featureId,
          xplaneIndex,
        });
      }
    };

    // Wait for map to be loaded before attaching events
    const attachEvents = () => {
      map.on('mouseenter', 'airport-gates-ring', handleGateMouseEnter);
      map.on('mouseleave', 'airport-gates-ring', handleGateMouseLeave);
      map.on('click', 'airport-gates-ring', handleGateClick);
      map.on('mouseenter', 'airport-runway-ends', handleRunwayEndMouseEnter);
      map.on('mouseleave', 'airport-runway-ends', handleRunwayEndMouseLeave);
      map.on('click', 'airport-runway-ends', handleRunwayEndClick);
    };

    if (map.isStyleLoaded()) {
      attachEvents();
    } else {
      map.once('load', attachEvents);
    }

    return () => {
      map.off('mouseenter', 'airport-gates-ring', handleGateMouseEnter);
      map.off('mouseleave', 'airport-gates-ring', handleGateMouseLeave);
      map.off('click', 'airport-gates-ring', handleGateClick);
      map.off('mouseenter', 'airport-runway-ends', handleRunwayEndMouseEnter);
      map.off('mouseleave', 'airport-runway-ends', handleRunwayEndMouseLeave);
      map.off('click', 'airport-runway-ends', handleRunwayEndClick);
    };
  }, [mapRef, setStartPosition]);

  const navigateToGate = useCallback(
    (gate: { latitude: number; longitude: number; heading: number; name?: string }) => {
      const map = mapRef.current;
      if (!map) return;
      map.flyTo({
        center: [gate.longitude, gate.latitude],
        zoom: 18,
        duration: 1500,
        bearing: gate.heading,
      });
    },
    [mapRef]
  );

  const selectGateAsStart = useCallback(
    (gate: {
      latitude: number;
      longitude: number;
      name: string;
      index?: number;
      xplaneIndex?: number | string;
    }) => {
      const map = mapRef.current;
      if (!selectedAirportData || !map) return;

      // Use index from gate object (passed from sidebar or map click)
      const gateIndex = gate.index;

      // Clear previous selections
      if (selectedGateId.current !== null) {
        map.setFeatureState(
          { source: 'airport-gates', id: selectedGateId.current },
          { selected: false }
        );
      }
      if (selectedRunwayEndId.current !== null) {
        map.setFeatureState(
          { source: 'airport-runway-ends', id: selectedRunwayEndId.current },
          { selected: false }
        );
        selectedRunwayEndId.current = null;
      }

      if (gateIndex !== undefined) {
        selectedGateId.current = gateIndex;
        map.setFeatureState({ source: 'airport-gates', id: gateIndex }, { selected: true });
      }

      if (gate.xplaneIndex === undefined) {
        console.error(`Missing xplaneIndex for gate "${gate.name}"`);
      }
      setStartPosition({
        type: 'ramp',
        name: gate.name,
        airport: selectedAirportData.id,
        latitude: gate.latitude,
        longitude: gate.longitude,
        index: gateIndex ?? 0,
        xplaneIndex: gate.xplaneIndex,
      });

      navigateToGate({ ...gate, heading: 0 });
    },
    [mapRef, selectedAirportData, setStartPosition, navigateToGate]
  );

  const selectRunwayEndAsStart = useCallback(
    (runwayEnd: {
      name: string;
      latitude: number;
      longitude: number;
      index?: number;
      xplaneIndex?: number | string;
    }) => {
      const map = mapRef.current;
      if (!selectedAirportData || !map) return;

      // Use index from runwayEnd object (passed from sidebar or map click)
      const endIndex = runwayEnd.index;

      // Clear previous selections
      if (selectedRunwayEndId.current !== null) {
        map.setFeatureState(
          { source: 'airport-runway-ends', id: selectedRunwayEndId.current },
          { selected: false }
        );
      }
      if (selectedGateId.current !== null) {
        map.setFeatureState(
          { source: 'airport-gates', id: selectedGateId.current },
          { selected: false }
        );
        selectedGateId.current = null;
      }

      if (endIndex !== undefined) {
        selectedRunwayEndId.current = endIndex;
        map.setFeatureState({ source: 'airport-runway-ends', id: endIndex }, { selected: true });
      }

      // Use provided xplaneIndex or calculate it
      // X-Plane index for runway: "row_end" format
      // endIndex is the global end index (runwayIndex * 2 + whichEnd)
      const xplaneIndex =
        runwayEnd.xplaneIndex ?? `${Math.floor((endIndex ?? 0) / 2)}_${(endIndex ?? 0) % 2}`;

      setStartPosition({
        type: 'runway',
        name: runwayEnd.name,
        airport: selectedAirportData.id,
        latitude: runwayEnd.latitude,
        longitude: runwayEnd.longitude,
        index: endIndex ?? 0,
        xplaneIndex,
      });

      map.flyTo({
        center: [runwayEnd.longitude, runwayEnd.latitude],
        zoom: 17,
        duration: 1500,
      });
    },
    [mapRef, selectedAirportData, setStartPosition]
  );

  const selectHelipadAsStart = useCallback(
    (helipad: {
      name: string;
      latitude: number;
      longitude: number;
      index?: number;
      xplaneIndex?: number | string;
    }) => {
      const map = mapRef.current;
      if (!selectedAirportData || !map) return;

      // Clear previous selections
      if (selectedGateId.current !== null) {
        map.setFeatureState(
          { source: 'airport-gates', id: selectedGateId.current },
          { selected: false }
        );
        selectedGateId.current = null;
      }
      if (selectedRunwayEndId.current !== null) {
        map.setFeatureState(
          { source: 'airport-runway-ends', id: selectedRunwayEndId.current },
          { selected: false }
        );
        selectedRunwayEndId.current = null;
      }

      setStartPosition({
        type: 'helipad',
        name: helipad.name,
        airport: selectedAirportData.id,
        latitude: helipad.latitude,
        longitude: helipad.longitude,
        index: helipad.index ?? 0,
        xplaneIndex: helipad.xplaneIndex,
      });

      map.flyTo({
        center: [helipad.longitude, helipad.latitude],
        zoom: 18,
        duration: 1500,
      });
    },
    [mapRef, selectedAirportData, setStartPosition]
  );

  const navigateToRunway = useCallback(
    (runway: Runway) => {
      const map = mapRef.current;
      if (!map) return;

      const e1 = runway.ends[0];
      const e2 = runway.ends[1];
      const centerLat = (e1.latitude + e2.latitude) / 2;
      const centerLon = (e1.longitude + e2.longitude) / 2;

      // Calculate bearing
      const dLon = ((e2.longitude - e1.longitude) * Math.PI) / 180;
      const lat1 = (e1.latitude * Math.PI) / 180;
      const lat2 = (e2.latitude * Math.PI) / 180;
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

      map.flyTo({
        center: [centerLon, centerLat],
        zoom: 16,
        duration: 1500,
        bearing: bearing - 90,
      });
    },
    [mapRef]
  );

  return {
    selectGateAsStart,
    selectRunwayEndAsStart,
    selectHelipadAsStart,
    navigateToGate,
    navigateToRunway,
  };
}
