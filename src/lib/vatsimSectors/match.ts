import type { Airport } from '@/lib/xplaneServices/dataService';
import type { VatsimATIS, VatsimController, VatsimData } from '@/types/vatsim';
import type {
  VatsimActiveFirMatch,
  VatsimActiveTraconMatch,
  VatsimAirportAtcBadge,
  VatsimAirportAtcSummary,
  VatsimFacilityRole,
  VatsimSectorDataset,
  VatsimTraconFeature,
} from '@/types/vatsimSectors';

const AIRPORT_BADGE_ROLES = ['DEL', 'GND', 'TWR', 'ATIS'] as const;

type AirportLookup = {
  byIcao: Map<string, string>;
  byIata: Map<string, string>;
};

type TraconMatch = {
  tracon: VatsimTraconFeature;
  matchedPrefix: string;
};

function getCallsignParts(callsign: string): string[] {
  return callsign
    .toUpperCase()
    .split('_')
    .filter((part) => part.length > 0);
}

function getCallsignPostfix(callsign: string): string {
  const parts = getCallsignParts(callsign);
  return parts.at(-1) ?? '';
}

function buildAirportLookup(airports: Airport[]): AirportLookup {
  const byIcao = new Map<string, string>();
  const byIata = new Map<string, string>();

  for (const airport of airports) {
    const icao = airport.icao.toUpperCase();
    byIcao.set(icao, icao);

    const iata = airport.iataCode?.toUpperCase();
    if (iata && !byIata.has(iata)) {
      byIata.set(iata, icao);
    }
  }

  return { byIcao, byIata };
}

function resolveAirportIcao(prefix: string, lookup?: AirportLookup): string | null {
  const normalized = prefix.toUpperCase();

  if (/^[A-Z]{4}$/.test(normalized)) {
    return lookup?.byIcao.get(normalized) ?? normalized;
  }

  if (/^[A-Z]{3}$/.test(normalized)) {
    return lookup?.byIata.get(normalized) ?? null;
  }

  return null;
}

function getAirportPrefix(callsign: string, lookup?: AirportLookup): string | null {
  const prefix = getCallsignParts(callsign)[0] ?? '';
  return resolveAirportIcao(prefix, lookup);
}

function sortTraconsForMatching(a: VatsimTraconFeature, b: VatsimTraconFeature): number {
  if (a.suffix && !b.suffix) return -1;
  if (!a.suffix && b.suffix) return 1;
  return 0;
}

function selectBestTraconMatch(
  tracons: VatsimTraconFeature[],
  controller: VatsimController
): TraconMatch | null {
  const role = getControllerRole(controller);
  if (role !== 'APP' && role !== 'TWR') {
    return null;
  }

  const callsign = controller.callsign.toUpperCase();
  const parts = getCallsignParts(callsign);
  const prefix = parts[0] ?? '';
  const middleName = parts.length === 3 ? `${parts[0]}_${parts[1]}` : prefix;

  let feature: TraconMatch | null = null;
  let backupFeature: TraconMatch | null = null;

  for (const tracon of tracons) {
    const suffix = tracon.suffix?.toUpperCase();
    if (role === 'TWR' && !suffix) {
      continue;
    }
    if (suffix && !callsign.endsWith(suffix)) {
      continue;
    }

    const prefixes = tracon.prefixes.map((item) => item.toUpperCase());
    const middlePrefix = prefixes.find((item) => item === middleName);
    const secondPrefix =
      parts.length === 3
        ? prefixes.find((item) => item.split('_').length === 2 && callsign.startsWith(item))
        : undefined;

    if (middlePrefix || secondPrefix) {
      feature ??= {
        tracon,
        matchedPrefix: middlePrefix ?? secondPrefix ?? '',
      };
      break;
    }

    const regularPrefix = prefixes.find((item) => callsign.startsWith(item));
    if (regularPrefix) {
      backupFeature ??= {
        tracon,
        matchedPrefix: regularPrefix,
      };
      break;
    }
  }

  return feature ?? backupFeature;
}

export function getControllerRole(
  controller: Pick<VatsimController, 'callsign'> | Pick<VatsimATIS, 'callsign'>
): VatsimFacilityRole {
  const postfix = getCallsignPostfix(controller.callsign);

  if (postfix === 'ATIS') return 'ATIS';
  if (postfix === 'DEP') return 'APP';
  if (postfix === 'RMP') return 'GND';
  if (postfix === 'DEL') return 'DEL';
  if (postfix === 'GND') return 'GND';
  if (postfix === 'TWR') return 'TWR';
  if (postfix === 'APP') return 'APP';
  if (postfix === 'CTR') return 'CTR';
  if (postfix === 'FSS') return 'FSS';
  return 'OTHER';
}

export function buildActiveFirMatches(
  dataset: VatsimSectorDataset,
  controllers: VatsimController[]
): VatsimActiveFirMatch[] {
  const matches = new Map<string, VatsimController[]>();

  for (const controller of controllers) {
    const role = getControllerRole(controller);
    if (role !== 'CTR' && role !== 'FSS') {
      continue;
    }

    const callsign = controller.callsign.toUpperCase();
    const prefix = callsign.split('_')[0] ?? '';

    for (const fir of dataset.firs) {
      const firPrefix = fir.callsign?.split('_')[0]?.toUpperCase() ?? fir.icao.toUpperCase();
      if (prefix !== firPrefix && callsign !== (fir.callsign ?? '').toUpperCase()) {
        continue;
      }

      const list = matches.get(fir.id) ?? [];
      list.push(controller);
      matches.set(fir.id, list);
    }
  }

  return dataset.firs.flatMap((fir) => {
    const matchedControllers = matches.get(fir.id);
    if (!matchedControllers?.length) {
      return [];
    }

    return [{ sectorId: fir.id, controllers: matchedControllers }];
  });
}

export function buildActiveTraconMatches(
  dataset: VatsimSectorDataset,
  controllers: VatsimController[]
): VatsimActiveTraconMatch[] {
  const matches = new Map<string, VatsimController[]>();
  const tracons = dataset.tracons.slice().sort(sortTraconsForMatching);

  for (const controller of controllers) {
    const match = selectBestTraconMatch(tracons, controller);
    if (!match) {
      continue;
    }

    const list = matches.get(match.tracon.id) ?? [];
    list.push(controller);
    matches.set(match.tracon.id, list);
  }

  return dataset.tracons.flatMap((tracon) => {
    const matchedControllers = matches.get(tracon.id);
    if (!matchedControllers?.length) {
      return [];
    }

    return [
      {
        traconId: tracon.id,
        controllers: matchedControllers,
        isTwrOnly: matchedControllers.every(
          (controller) => getControllerRole(controller) === 'TWR'
        ),
      },
    ];
  });
}

function controllerSortIndex(controller: VatsimController | VatsimATIS): number {
  switch (getControllerRole(controller)) {
    case 'DEL':
      return 0;
    case 'GND':
      return 1;
    case 'TWR':
      return 2;
    case 'APP':
      return 3;
    case 'ATIS':
      return 4;
    case 'CTR':
      return 5;
    case 'FSS':
      return 6;
    default:
      return 7;
  }
}

function roleToLetter(role: (typeof AIRPORT_BADGE_ROLES)[number]): VatsimAirportAtcBadge['letter'] {
  switch (role) {
    case 'DEL':
      return 'D';
    case 'GND':
      return 'G';
    case 'TWR':
      return 'T';
    case 'ATIS':
      return 'A';
  }
}

export function buildAirportAtcSummaries(
  data: VatsimData | undefined,
  airports: Airport[] = []
): VatsimAirportAtcSummary[] {
  if (!data) {
    return [];
  }

  const lookup = buildAirportLookup(airports);
  const grouped = new Map<string, Array<VatsimController | VatsimATIS>>();

  for (const controller of data.controllers) {
    const role = getControllerRole(controller);
    if (role !== 'DEL' && role !== 'GND' && role !== 'TWR' && role !== 'APP') {
      continue;
    }

    const icao = getAirportPrefix(controller.callsign, lookup);
    if (!icao) {
      continue;
    }

    grouped.set(icao, [...(grouped.get(icao) ?? []), controller]);
  }

  for (const atis of data.atis) {
    const icao = getAirportPrefix(atis.callsign, lookup);
    if (!icao) {
      continue;
    }

    grouped.set(icao, [...(grouped.get(icao) ?? []), atis]);
  }

  return Array.from(grouped.entries())
    .map(([icao, list]) => {
      const controllers = list
        .slice()
        .sort((a, b) => controllerSortIndex(a) - controllerSortIndex(b));

      const badges: VatsimAirportAtcBadge[] = AIRPORT_BADGE_ROLES.flatMap((role) => {
        const matched = controllers.filter((controller) => getControllerRole(controller) === role);
        if (!matched.length) {
          return [];
        }

        return [
          {
            role,
            letter: roleToLetter(role),
            controllers: matched,
          } satisfies VatsimAirportAtcBadge,
        ];
      });

      return { icao, controllers, badges };
    })
    .filter((summary) => summary.controllers.length > 0)
    .sort((a, b) => a.icao.localeCompare(b.icao));
}
