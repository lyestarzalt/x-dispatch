import { describe, expect, it } from 'vitest';
import { airportRunwayUse, atisRunwayUse, atisRunways, ivaoRunwayUse } from './atis';

describe('atisRunwayUse', () => {
  it('puts a runway named with no use in both lists', () => {
    expect(atisRunwayUse(['RWY 25L AND 25R IN USE'])).toEqual({
      arrivals: ['25L', '25R'],
      departures: ['25L', '25R'],
      all: ['25L', '25R'],
    });
  });

  it('reads the FAA wording (KJFK)', () => {
    const use = atisRunwayUse([
      'KENNEDY AIRPORT INFORMATION F 1751Z. 32020G27KT 10SM FEW050 13/02 A2989.',
      'ILS RWY 4R APCH IN USE. DEPG RWY 4L, RWY 31L AT KE.',
    ]);
    expect(use.arrivals).toEqual(['4R']);
    expect(use.departures).toEqual(['4L', '31L']);
    expect(use.all).toEqual(['4R', '4L', '31L']);
  });

  it('reads the European wording with no full stops', () => {
    const use = atisRunwayUse(['ARR RWY 27R DEP RWY 27L TRL 70']);
    expect(use.arrivals).toEqual(['27R']);
    expect(use.departures).toEqual(['27L']);
  });

  it('reads the use when it follows the runway', () => {
    const use = atisRunwayUse(['RWY 25R FOR LANDING RWY 25L FOR TAKEOFF']);
    expect(use.arrivals).toEqual(['25R']);
    expect(use.departures).toEqual(['25L']);
  });

  it('reads main landing and takeoff runways (EHAM)', () => {
    const use = atisRunwayUse(['MAIN LANDING RUNWAY 18R. MAIN TAKEOFF RUNWAY 24.']);
    expect(use.arrivals).toEqual(['18R']);
    expect(use.departures).toEqual(['24']);
  });

  it('reads real broadcasts from the VATSIM feed', () => {
    const read = (text: string) => {
      const { arrivals, departures } = atisRunwayUse([text]);
      return { arrivals, departures };
    };
    // EDDH: no "RWY" word at all.
    expect(read('EXPECT ILS APCH LDG 15 TKOF 23 TRL 70')).toEqual({
      arrivals: ['15'],
      departures: ['23'],
    });
    // LEPA
    expect(read('EXPECT ILS Z APCH. RWY IN USE FOR ARR 24L AND FOR DEP 24R. TRL70')).toEqual({
      arrivals: ['24L'],
      departures: ['24R'],
    });
    // OERK: spelled sides.
    expect(
      read('EXPECT ILS DME RWY33L. TRL FL150 / RWY 33 LEFT FOR ARRIVALS. RWY 33 RIGHT FOR DEP.')
    ).toEqual({ arrivals: ['33L'], departures: ['33R'] });
    // KMKE: FAA comma list.
    expect(read('VISUAL APCH RY 25L. LDG RY 25L, 25R. DEPG RY 25L. SIMUL OPS IN USE.')).toEqual({
      arrivals: ['25L', '25R'],
      departures: ['25L'],
    });
    // KIAD: a runway on request and the NOTAM part are not in use.
    expect(
      read(
        'ARR ACFT EXP ILS OR VIS APCH RWY 1R, RWY 1L. DEPG RWY 30. RWY 1C AVBL UPON REQUEST. NOTAMS... RWY 1C/19C CLSD.'
      )
    ).toEqual({ arrivals: ['1R', '1L'], departures: ['30'] });
    // KDCA
    expect(read('ARRIVALS EXPECT CVFP MTV VIS RWY 1. LNDG AND DEPG RWYS 1, 33.')).toEqual({
      arrivals: ['1', '33'],
      departures: ['1', '33'],
    });
    // EBBR: the use follows the runway, with no full stops.
    expect(
      read(
        'EXPECT RNAV TRANSITION TO ILS APPROACH RUNWAY 25L FOR ARRIVALS WET RUNWAY 25R FOR DEPARTURES'
      )
    ).toEqual({ arrivals: ['25L'], departures: ['25R'] });
    // ZSPD
    expect(read('DEP RWY 35R & 34L EXP ILS APCH LDG RWY 35L & 34R CTN')).toEqual({
      arrivals: ['35L', '34R'],
      departures: ['35R', '34L'],
    });
    // EDDB: only the approach is stated, and the condition report is not a use.
    expect(
      read(
        'EXPECT ILS Z APCH RWY 24R 24L RWY COND RWY 24R AT TIME 1405 RWYCC 6. AFTER VACATING RWY 24R OR 24L REMAIN ON FREQ.'
      )
    ).toEqual({ arrivals: ['24R', '24L'], departures: [] });
    // KORD and KLAS: the list says where to enter each runway.
    expect(
      read(
        'ARR EXP VECTORS ILS RWY 10C APCH, VISUAL APCH RWY 9L. DEPS EXP RWYS 9C FROM F F 9200 FT AVL, 10L FROM DD. 10,093 FT AVBL.'
      )
    ).toEqual({ arrivals: ['10C', '9L'], departures: ['9C', '10L'] });
    expect(
      read('LANDING RWYS 26L AND 1L. DEPG RWYS 1R FULL LENGTH AND 1L AT BRAVO. SIMUL APCHS IN USE.')
    ).toEqual({ arrivals: ['26L', '1L'], departures: ['1R', '1L'] });
    // A runway said to be in use beside one with a stated use is kept, a bare remark is not.
    expect(read('ILS RWY 4R APCH IN USE. RWY 4L IN USE. USE CAUTION EXITING RWY 13R.')).toEqual({
      arrivals: ['4R', '4L'],
      departures: ['4L'],
    });
    // LIRF arrival broadcast: the approach type follows the runway.
    expect(
      atisRunwayUse(['RWY 16L ILS X RWY 16R ILS Y. RWY IN USE 16L AND 16R. TL 70.'], 'arrival')
        .arrivals
    ).toEqual(['16L', '16R']);
  });

  it('gives a runway for landing and departing to both', () => {
    const use = atisRunwayUse(['LANDING AND DEPARTING RWY 09']);
    expect(use.arrivals).toEqual(['09']);
    expect(use.departures).toEqual(['09']);
  });

  it('lets a use word go stale before an unrelated runway', () => {
    const use = atisRunwayUse([
      'DEPARTURE FREQUENCY 121.900 TRANSITION LEVEL 70 WIND 270 DEGREES 10 KNOTS RWY 27 IN USE',
    ]);
    expect(use.arrivals).toEqual(['27']);
    expect(use.departures).toEqual(['27']);
  });

  it('leaves out a closed runway and numbers that are not runways', () => {
    expect(atisRunways(['RWY 13R CLSD. RWY 99 RWY 27, 10 KT'])).toEqual(['27']);
  });

  it('treats a bare mention as a remark once another runway is said to be in use', () => {
    expect(atisRunways(['RWY 22L IN USE. BIRDS NEAR RWY 27.'])).toEqual(['22L']);
  });

  it('takes the use from the station when the text gives none', () => {
    expect(atisRunwayUse(['RWYS 17R, 18L IN USE'], 'departure')).toEqual({
      arrivals: [],
      departures: ['17R', '18L'],
      all: ['17R', '18L'],
    });
  });
});

describe('airportRunwayUse', () => {
  const station = (callsign: string, code: string, text: string) => ({
    callsign,
    atis: { code, lines: [text] },
  });

  it('joins separate arrival and departure broadcasts, each with its letter', () => {
    const use = airportRunwayUse([
      station('KJFK_D_ATIS', 'F', 'DEPG RWY 31L, RWY 31R'),
      station('KJFK_A_ATIS', 'D', 'ILS RWY 4L APCH IN USE. ILS RWY 4R'),
    ]);
    expect(use).toMatchObject({
      departures: ['31L', '31R'],
      arrivals: ['4L', '4R'],
      departureLetter: 'F',
      arrivalLetter: 'D',
      split: true,
    });
  });

  it('is not split when landing and takeoff share the runways', () => {
    const use = airportRunwayUse([station('EDDF_ATIS', 'K', 'RWY 25L AND 25C IN USE')]);
    expect(use).toMatchObject({ split: false, arrivalLetter: 'K', departureLetter: 'K' });
  });

  it('keeps only the ends the airport has (KLAX names its two complexes)', () => {
    const use = airportRunwayUse(
      [
        station(
          'KLAX_ATIS',
          'Y',
          'RNAV RNP APCHS RY 24R AND 25L. DEPARTURES IN PROG RWYS 24 AND 25.'
        ),
      ],
      (end) => ['24R', '24L', '25R', '25L'].includes(end)
    );
    expect(use).toMatchObject({ arrivals: ['24R', '25L'], departures: [], split: false });
  });

  it('reads a side letter set apart from the number (OTHH)', () => {
    const use = airportRunwayUse([
      station(
        'OTHH_D_ATIS',
        'C',
        'RWY IN USE 34 RIGHT AND 34 LEFT. DEPARTURES RWY 34 R , EXP YAMEEN 1.'
      ),
    ]);
    expect(use?.departures).toEqual(['34R', '34L']);
  });

  it('is null when no broadcast names a runway', () => {
    expect(airportRunwayUse([station('EGLL_ATIS', 'A', 'NO RUNWAY HERE')])).toBeNull();
    expect(airportRunwayUse([{ callsign: 'EGLL_TWR', atis: null }])).toBeNull();
  });
});

describe('ivaoRunwayUse', () => {
  it('reads the fixed part and leaves the remarks alone (EDDK)', () => {
    expect(
      ivaoRunwayUse([
        'ts-1.eu-west-2.ivao.aero/EDDK_TWR',
        'Information JULIET recorded at 1608z EDDK 151550Z AUTO 14010KT 9999 FEW025 10/06 Q1004 NOSIG',
        'ARR RWY 13L 13R DEP RWY 13L 13R TL FL70 RMK DEPARTURE FREQUENCY 122.800 - You can Vacate via Runway 24',
      ])
    ).toEqual({ arrivals: ['13L', '13R'], departures: ['13L', '13R'], all: ['13L', '13R'] });
  });

  it('reads approach types and bare numbers in the fixed part', () => {
    expect(
      ivaoRunwayUse(['NOSIG ARR RWY ILS 14 DEP RWY 28 SEC 16 TL FL70 TA 7000ft'])
    ).toMatchObject({
      arrivals: ['14'],
      departures: ['28', '16'],
    });
    expect(ivaoRunwayUse(['BECMG 20006KT ARR RWY 25R 25L DEP RWY 25C 18 TL FL060'])).toMatchObject({
      arrivals: ['25R', '25L'],
      departures: ['25C', '18'],
    });
  });

  it('is null without the fixed part', () => {
    expect(ivaoRunwayUse(['Los Angeles Airport ATIS Information CHARLIE RMK AO2'])).toBeNull();
  });
});
