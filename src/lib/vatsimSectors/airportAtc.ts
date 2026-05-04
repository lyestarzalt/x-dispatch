import type { VatsimATIS, VatsimController } from '@/types/vatsim';
import type { VatsimAirportAtcRow, VatsimFacilityRole } from '@/types/vatsimSectors';
import { getControllerRole } from './match';

type AirportController = VatsimController | VatsimATIS;

const ROLE_ORDER: Record<VatsimFacilityRole, number> = {
  DEL: 0,
  GND: 1,
  TWR: 2,
  APP: 3,
  ATIS: 4,
  CTR: 5,
  FSS: 6,
  OTHER: 7,
};

export function sortAirportAtcControllers(controllers: AirportController[]): AirportController[] {
  return controllers.slice().sort((a, b) => {
    const roleDiff = ROLE_ORDER[getControllerRole(a)] - ROLE_ORDER[getControllerRole(b)];
    if (roleDiff !== 0) return roleDiff;
    return a.callsign.localeCompare(b.callsign);
  });
}

export function airportAtcBadgeLabel(controller: AirportController): string {
  const role = getControllerRole(controller);

  if (role === 'ATIS') {
    return 'atis_code' in controller && controller.atis_code
      ? `ATIS ${controller.atis_code}`
      : 'ATIS';
  }

  if (role === 'APP') return 'APP';
  if (role === 'DEL') return 'DEL';
  if (role === 'GND') return 'GND';
  if (role === 'TWR') return 'TWR';
  if (role === 'CTR') return 'CTR';
  if (role === 'FSS') return 'FSS';
  return 'ATC';
}

export function airportAtcBadgeVariant(
  role: VatsimFacilityRole
): VatsimAirportAtcRow['badgeVariant'] {
  switch (role) {
    case 'DEL':
      return 'info';
    case 'GND':
      return 'success';
    case 'TWR':
      return 'danger';
    case 'ATIS':
      return 'warning';
    default:
      return 'secondary';
  }
}

export function buildAirportAtcRows(
  controllers: VatsimController[],
  atis: VatsimATIS[]
): VatsimAirportAtcRow[] {
  return sortAirportAtcControllers([...controllers, ...atis]).map((controller) => {
    const role = getControllerRole(controller);
    const detail =
      role === 'ATIS' && controller.text_atis?.length
        ? controller.text_atis.join(' | ')
        : undefined;

    return {
      id: `${controller.callsign}-${controller.frequency}`,
      role,
      badgeLabel: airportAtcBadgeLabel(controller),
      badgeVariant: airportAtcBadgeVariant(role),
      callsign: controller.callsign,
      frequency: controller.frequency,
      summary: controller.name,
      detail,
    } satisfies VatsimAirportAtcRow;
  });
}
