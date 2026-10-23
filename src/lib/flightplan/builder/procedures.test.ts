import { describe, expect, it } from 'vitest';
import type { FMSFlightPlan } from '@/types/fms';
import type { ResolvedProcedure } from '@/types/navigation';
import {
  composePlan,
  filedProcedureChoice,
  matchProcedure,
  planForFile,
  proceduresForRunway,
  sidFirstTurn,
  sidInitialClimbNm,
  suggestProcedures,
} from './procedures';

const base: FMSFlightPlan = {
  version: 1100,
  departure: { icao: 'EHAM', runway: '36L' },
  arrival: { icao: 'EDDF', runway: '25L' },
  waypoints: [
    { type: 1, id: 'EHAM', via: 'ADEP', altitude: 0, latitude: 52.3, longitude: 4.76 },
    { type: 11, id: 'ARNEM', via: 'DRCT', altitude: 29000, latitude: 51.98, longitude: 5.79 },
    { type: 11, id: 'UNOKO', via: 'UL620', altitude: 29000, latitude: 50.5, longitude: 8.0 },
    { type: 1, id: 'EDDF', via: 'ADES', altitude: 0, latitude: 50.03, longitude: 8.57 },
  ],
};

const wp = (
  fixId: string,
  lat: number,
  lon: number,
  extra: Partial<ResolvedProcedure['waypoints'][number]> = {}
) => ({
  fixId,
  fixRegion: 'EH',
  fixType: 'E' as const,
  pathTerminator: 'TF' as const,
  course: null,
  distance: null,
  altitude: null,
  speed: null,
  speedDescriptor: null,
  turnDirection: null,
  recNavaid: null,
  recNavaidRegion: null,
  theta: null,
  rho: null,
  arcRadius: null,
  centerFix: null,
  centerFixRegion: null,
  verticalAngle: null,
  rnp: null,
  holdTimeMin: null,
  isMissedApproach: false,
  latitude: lat,
  longitude: lon,
  resolved: true,
  ...extra,
});

const sid: ResolvedProcedure = {
  type: 'SID',
  name: 'ARNEM2S',
  runway: '36L',
  transition: null,
  waypoints: [
    wp('RW36L', 52.31, 4.76, { fixType: 'C' }),
    wp('EH020', 52.2, 5.0, {
      altitude: { descriptor: '+', altitude1: 6000, altitude2: null, isFlightLevel: true },
    }),
    wp('ARNEM', 51.98, 5.79),
  ],
};

const star: ResolvedProcedure = {
  type: 'STAR',
  name: 'UNOKO1A',
  runway: null,
  transition: 'UNOKO',
  waypoints: [
    wp('UNOKO', 50.5, 8.0),
    wp('ROLIS', 50.3, 8.2),
    wp('LOST', 0, 0, { resolved: false }),
  ],
};

describe('composePlan', () => {
  it('stitches SID and STAR around the enroute legs without repeating join fixes', () => {
    const plan = composePlan(base, { sid, star });
    expect(plan.waypoints.map((w) => w.id)).toEqual([
      'EHAM',
      'EH020',
      'ARNEM',
      'UNOKO',
      'ROLIS',
      'EDDF',
    ]);
    expect(plan.waypoints[1]?.via).toBe('ARNEM2S');
    expect(plan.waypoints[1]?.altitude).toBe(6000);
    expect(plan.waypoints[1]?.constraintLabel).toBe('FL60A');
    expect(plan.waypoints[2]?.constraintLabel).toBe('');
    expect(plan.departure.sid).toBe('ARNEM2S');
    expect(plan.arrival.star).toBe('UNOKO1A');
    expect(plan.arrival.starTransition).toBe('UNOKO');
  });

  it('keeps the airway on the fix where the route hands over to the STAR', () => {
    // `via` names the leg into a fix. ARNEM UL620 UNOKO is flown on the airway; only the
    // legs after UNOKO belong to the STAR, so the line and the chip show UL620 there.
    const plan = composePlan(base, { sid, star });
    const unoko = plan.waypoints.find((w) => w.id === 'UNOKO');
    expect(unoko?.via).toBe('UL620');
    expect(plan.waypoints.find((w) => w.id === 'ROLIS')?.via).toBe('UNOKO1A');
  });

  it('keeps the SID name on its exit fix when the route starts there', () => {
    const plan = composePlan(base, { sid, star });
    expect(plan.waypoints.find((w) => w.id === 'ARNEM')?.via).toBe('ARNEM2S');
  });

  it('flies direct into a STAR the route does not reach', () => {
    const short = { ...base, waypoints: base.waypoints.filter((w) => w.id !== 'UNOKO') };
    const plan = composePlan(short, { sid, star });
    expect(plan.waypoints.map((w) => `${w.id}/${w.via}`)).toEqual([
      'EHAM/ADEP',
      'EH020/ARNEM2S',
      'ARNEM/ARNEM2S',
      'UNOKO/DRCT',
      'ROLIS/UNOKO1A',
      'EDDF/ADES',
    ]);
  });

  it('keeps the procedure constraint on the hand-over fix', () => {
    const limited: ResolvedProcedure = {
      ...star,
      waypoints: [
        wp('UNOKO', 50.5, 8.0, {
          altitude: { descriptor: '-', altitude1: 28000, altitude2: null, isFlightLevel: true },
        }),
        wp('ROLIS', 50.3, 8.2),
      ],
    };
    const plan = composePlan(base, { sid, star: limited });
    const unoko = plan.waypoints.find((w) => w.id === 'UNOKO');
    expect(unoko?.via).toBe('UL620');
    expect(unoko?.constraintLabel).toBe('FL280B');
    expect(unoko?.constraint?.altitude1).toBe(28000);
  });

  it('draws only legs that fly to their fix, and reads the initial climb from course legs', () => {
    // Le Luc GILON1: climb on course to 8.5 DME from LUC, turn left back to LUC, then GILON.
    const gilon: ResolvedProcedure = {
      type: 'SID',
      name: 'GILON1',
      runway: 'RW09',
      transition: null,
      waypoints: [
        wp('', 0, 0, { pathTerminator: 'CD', distance: 8.5, resolved: false }),
        wp('LUC', 43.38, 6.39, { fixType: 'V', pathTerminator: 'CF', turnDirection: 'L' }),
        wp('GILON', 43.44, 6.12),
        wp('LUC', 43.38, 6.39, { fixType: 'V', pathTerminator: 'FD', distance: 4 }),
      ],
    };
    const plan = composePlan(base, { sid: gilon });
    // The trailing FD leg only names LUC as its DME source, so LUC is not flown to again.
    expect(plan.waypoints.map((w) => w.id)).toEqual([
      'EHAM',
      'LUC',
      'GILON',
      'ARNEM',
      'UNOKO',
      'EDDF',
    ]);
    expect(sidInitialClimbNm(gilon, 1.5)).toBeCloseTo(7.75, 2);
    expect(sidInitialClimbNm(sid)).toBeUndefined();
    expect(sidFirstTurn(gilon)).toBe('L');
  });

  it('ignores a turn direction published on a leg after the first fix', () => {
    // EHEH WOOD1S: straight ahead to EH597, then a right turn at it. Forcing that
    // R onto the initial turn wrapped the line most of the way around the circle.
    const wood: ResolvedProcedure = {
      type: 'SID',
      name: 'WOOD1S',
      runway: 'RW21',
      transition: null,
      waypoints: [
        wp('EH597', 51.435, 5.358, { pathTerminator: 'CF' }),
        wp('EH598', 51.48, 5.31, { pathTerminator: 'CF', turnDirection: 'R' }),
      ],
    };
    expect(sidFirstTurn(wood)).toBeUndefined();
  });

  it('leaves the plan untouched with no procedures', () => {
    expect(composePlan(base, {}).waypoints).toEqual(base.waypoints);
  });

  it('leaves procedure fixes out of the file, naming the procedures instead', () => {
    const file = planForFile(base, { sid, star });
    // ARNEM is the SID exit and UNOKO the STAR entry; X-Plane adds both when it loads the procedures.
    expect(file.waypoints.map((w) => w.id)).toEqual(['EHAM', 'EDDF']);
    expect(planForFile(base, { sid }).waypoints.map((w) => w.id)).toEqual([
      'EHAM',
      'UNOKO',
      'EDDF',
    ]);
    expect(file.departure.sid).toBe('ARNEM2S');
    expect(file.arrival.star).toBe('UNOKO1A');
    expect(file.arrival.starTransition).toBe('UNOKO');
  });

  it('fills the runway from the procedure when the user left it open', () => {
    const open: FMSFlightPlan = {
      ...base,
      departure: { icao: 'EHAM' },
      arrival: { icao: 'EDDF' },
    };
    const file = planForFile(open, { sid, star: { ...star, runway: 'RW25L' } });
    expect(file.departure.runway).toBe('36L');
    expect(file.arrival.runway).toBe('25L');
    expect(
      planForFile(open, { sid: { ...sid, runway: 'RW36B' } }).departure.runway
    ).toBeUndefined();
  });

  it('drops enroute fixes that would double back over the SID or STAR', () => {
    const doubled: FMSFlightPlan = {
      ...base,
      waypoints: [
        base.waypoints[0]!,
        { type: 3, id: 'SPL', via: 'DRCT', altitude: 0, latitude: 52.33, longitude: 4.75 },
        base.waypoints[1]!,
        base.waypoints[2]!,
        { type: 3, id: 'FFM', via: 'DRCT', altitude: 0, latitude: 50.05, longitude: 8.64 },
        base.waypoints[3]!,
      ],
    };
    const plan = composePlan(doubled, { sid, star });
    expect(plan.waypoints.map((w) => w.id)).toEqual([
      'EHAM',
      'EH020',
      'ARNEM',
      'UNOKO',
      'ROLIS',
      'EDDF',
    ]);
  });
});

describe('procedure selection', () => {
  const variants: ResolvedProcedure[] = [
    { ...sid, runway: '36L' },
    { ...sid, runway: '18C' },
    { ...sid, runway: 'RW36B', transition: 'NORKU' },
  ];

  it('filters by runway and understands the B suffix', () => {
    expect(proceduresForRunway(variants, '36L').map((p) => p.runway)).toEqual(['36L', 'RW36B']);
    expect(proceduresForRunway(variants, undefined)).toHaveLength(3);
  });

  it('matches a choice to the variant for the chosen runway', () => {
    const picked = matchProcedure(variants, { name: 'ARNEM2S', transition: null }, '18C');
    expect(picked?.runway).toBe('18C');
    expect(matchProcedure(variants, undefined, '18C')).toBeUndefined();
  });
});

describe('suggestProcedures', () => {
  const proc = (
    type: ResolvedProcedure['type'],
    name: string,
    runway: string | null,
    transition: string | null,
    fixes: string[]
  ): ResolvedProcedure => ({
    type,
    name,
    runway,
    transition,
    waypoints: fixes.map((id, i) => wp(id, 52 + i * 0.1, 4 + i * 0.1)),
  });
  const sids = [
    proc('SID', 'MODM1J', 'RW27R', null, ['EH001', 'MODMI']),
    proc('SID', 'MODM1J', 'RW27R', 'REDFA', ['EH001', 'MODMI', 'REDFA']),
    proc('SID', 'ULKA1J', 'RW27R', null, ['EH002', 'ULKAV']),
    proc('SID', 'MODM1F', 'RW09L', null, ['EH003', 'MODMI']),
  ];
  const stars = [
    proc('STAR', 'MOLI2A', null, null, ['MOLIX', 'SUGOL']),
    proc('STAR', 'MOLI2A', null, 'LUTEX', ['LUTEX', 'MOLIX', 'SUGOL']),
    proc('STAR', 'ARTI2A', 'ALL', null, ['ARTIP', 'SPL']),
  ];
  const approaches = [
    proc('APPROACH', 'R36C', null, null, ['OLGAX', 'AM632']),
    proc('APPROACH', 'I36C', null, null, ['OLGAX', 'AM632']),
    proc('APPROACH', 'I36C', null, 'SUGOL', ['SUGOL', 'SPL', 'OLGAX', 'AM632']),
    proc('APPROACH', 'I36C', null, 'ARTIP', ['ARTIP', 'SPL', 'OLGAX', 'AM632']),
    proc('APPROACH', 'I18R', null, null, ['NIRSI', 'AM100']),
  ];

  it('picks the SID for the runway whose exit is where the route starts, transition included', () => {
    const s = suggestProcedures({
      sids,
      stars: [],
      approaches: [],
      departureRunway: '27R',
      firstEnrouteFixId: 'REDFA',
    });
    expect(s.sid).toEqual({ name: 'MODM1J', transition: 'REDFA' });
    expect(
      suggestProcedures({
        sids,
        stars: [],
        approaches: [],
        departureRunway: '27R',
        firstEnrouteFixId: 'MODMI',
      }).sid
    ).toEqual({ name: 'MODM1J', transition: null });
  });

  it('suggests no SID when the route does not start at a published exit for that runway', () => {
    const s = suggestProcedures({
      sids,
      stars: [],
      approaches: [],
      departureRunway: '09L',
      firstEnrouteFixId: 'REDFA',
    });
    expect(s.sid).toBeUndefined();
  });

  it('picks the STAR whose entry is where the route ends', () => {
    const s = suggestProcedures({
      sids: [],
      stars,
      approaches: [],
      arrivalRunway: '36C',
      lastEnrouteFixId: 'LUTEX',
    });
    expect(s.star).toEqual({ name: 'MOLI2A', transition: 'LUTEX' });
  });

  it('picks the best approach for the runway (ILS over RNAV) with the transition the STAR hands over to', () => {
    const s = suggestProcedures({
      sids: [],
      stars,
      approaches,
      arrivalRunway: '36C',
      lastEnrouteFixId: 'MOLIX',
    });
    expect(s.star).toEqual({ name: 'MOLI2A', transition: null });
    // MOLI2A ends at SUGOL, so the SUGOL transition of the ILS is the one to fly.
    expect(s.approach).toEqual({ name: 'I36C', transition: 'SUGOL' });
  });

  it('falls back to the plain approach when no transition joins the route, and to nothing for an unknown runway', () => {
    const s = suggestProcedures({ sids: [], stars: [], approaches, arrivalRunway: '36C' });
    expect(s.approach).toEqual({ name: 'I36C', transition: null });
    expect(
      suggestProcedures({ sids: [], stars: [], approaches, arrivalRunway: '27' }).approach
    ).toBeUndefined();
    expect(suggestProcedures({ sids: [], stars: [], approaches }).approach).toBeUndefined();
  });

  it('suggests no approach rather than guessing when every variant has a transition and nothing hands over yet', () => {
    // Palma I24LY: BAVUM, CDP, MJV and POS transitions, no plain variant. Before the route or
    // STAR is known there is nothing to match, so the slot waits instead of taking the first row.
    const transitions = [
      proc('APPROACH', 'I24LY', null, 'BAVUM', ['BAVUM', 'OBUMU', 'FI24L']),
      proc('APPROACH', 'I24LY', null, 'POS', ['POS', 'BAVUM', 'OBUMU', 'FI24L']),
    ];
    expect(
      suggestProcedures({ sids: [], stars: [], approaches: transitions, arrivalRunway: '24L' })
        .approach
    ).toBeUndefined();
    const star = proc('STAR', 'GODO4P', null, null, ['GODOX', 'RUPIT', 'ADX', 'POS']);
    expect(
      suggestProcedures({
        sids: [],
        stars: [],
        approaches: transitions,
        arrivalRunway: '24L',
        star,
      }).approach
    ).toEqual({ name: 'I24LY', transition: 'POS' });
  });
});

describe('filedProcedureChoice', () => {
  const published = [
    { name: 'VIICE2', transition: 'ZQA', runway: '08L', waypoints: [] },
    { name: 'VIICE2', transition: 'HOBEE', runway: '08L', waypoints: [] },
    { name: 'ROCKT3', transition: null, runway: null, waypoints: [] },
    { name: 'NANJ4R', transition: null, runway: '25', waypoints: [] },
  ] as unknown as ResolvedProcedure[];

  it('takes the transition named beside the procedure in the route', () => {
    expect(filedProcedureChoice(published, 'VIICE2', 'ZQA')).toEqual({
      name: 'VIICE2',
      transition: 'ZQA',
    });
    expect(filedProcedureChoice(published, 'VIICE2', 'NOWHERE')).toEqual({
      name: 'VIICE2',
      transition: 'ZQA',
    });
  });

  it('prefers the plain variant and gives up on an unpublished name', () => {
    expect(filedProcedureChoice(published, 'ROCKT3', 'TIBOS')).toEqual({
      name: 'ROCKT3',
      transition: null,
    });
    expect(filedProcedureChoice(published, 'NOPE1', undefined)).toBeNull();
  });

  it('finds a seven-letter filed name under its six-character stored form', () => {
    expect(filedProcedureChoice(published, 'NANJO4R', 'NANJO')).toEqual({
      name: 'NANJ4R',
      transition: null,
    });
  });
});
