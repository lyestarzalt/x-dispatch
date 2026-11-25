import { describe, expect, it } from 'vitest';
import { pagePointToLonLat, pageRectCorners, parsePdfGeoreference } from './georeference';

// The page object of KSEA ILS OR LOC RWY 16C (00582IL16C.PDF, cycle 2612), projection text cut.
const KSEA_PAGE =
  '<</CropBox[0 0 387.36 594]/MediaBox[0 0 387.36 594]/Parent 1 0 R/Rotate 0/Type/Page' +
  '/VP[<</BBox[9.18 2.628 378.18 591.372]/Measure<</Bounds[0 0 1 0 1 1 0 1 0 0]' +
  '/GCS<</EPSG 0/Type/PROJCS/WKT(PROJCS["",PROJECTION["Lambert_Conformal_Conic"]])>>' +
  '/GPTS[46.99155633076 -122.8303318827 46.99160003358 -121.8012537879 ' +
  '48.11356486672 -121.7915709239 48.11352045277 -122.84022242]' +
  '/LPTS[0.1 0.1 0.9 0.1 0.9 0.9 0.1 0.9]/PDU[(MI)(SQMI)(DEG)]/Subtype/GEO/Type/Measure>>' +
  '/Type/Viewport>>]>> endobj';

const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.6\n${text}`);

describe('parsePdfGeoreference', () => {
  it('reads the box and its four positions from the KSEA ILS 16C chart', () => {
    const geo = parsePdfGeoreference(pdf(KSEA_PAGE))!;
    expect(geo.page).toEqual({ width: 387.36, height: 594 });
    expect(geo.bbox).toEqual({ x0: 9.18, y0: 2.628, x1: 378.18, y1: 591.372 });
    expect([geo.u0, geo.u1, geo.v0, geo.v1]).toEqual([0.1, 0.9, 0.1, 0.9]);
    // Longitude first: bottom-left, bottom-right, top-right, top-left.
    expect(geo.positions[0]).toEqual([-122.8303318827, 46.99155633076]);
    expect(geo.positions[2]).toEqual([-121.7915709239, 48.11356486672]);
  });

  it('has nothing for a chart without coordinates, as an airport diagram', () => {
    expect(parsePdfGeoreference(pdf('<</MediaBox[0 0 387.36 594]/Type/Page>>'))).toBeNull();
  });

  it('does not place a rotated page or reference points that are not a box', () => {
    expect(parsePdfGeoreference(pdf(KSEA_PAGE.replace('/Rotate 0', '/Rotate 90')))).toBeNull();
    expect(
      parsePdfGeoreference(
        pdf(KSEA_PAGE.replace('0.1 0.1 0.9 0.1 0.9 0.9', '0.1 0.1 0.9 0.2 0.9 0.9'))
      )
    ).toBeNull();
  });
});

describe('pagePointToLonLat', () => {
  const geo = parsePdfGeoreference(pdf(KSEA_PAGE))!;

  it('returns a reference point where the PDF puts it', () => {
    // Bottom-left reference: 0.1 of the box from its bottom-left, in points from the page top.
    const x = 9.18 + 0.1 * 369;
    const y = 594 - (2.628 + 0.1 * 588.744);
    const [lon, lat] = pagePointToLonLat(geo, x, y);
    expect(lon).toBeCloseTo(-122.8303318827, 9);
    expect(lat).toBeCloseTo(46.99155633076, 9);
  });

  it('puts Seattle-Tacoma (47.449 N 122.309 W) on the localizer in the plan view', () => {
    // The airport symbol is drawn about 195 pt across and 345 pt down the page.
    const [lon, lat] = pagePointToLonLat(geo, 195, 345);
    expect(lon).toBeCloseTo(-122.309, 1);
    expect(lat).toBeCloseTo(47.449, 1);
  });

  it('gives a rectangle its corners clockwise from the top-left, north up', () => {
    const [tl, tr, br, bl] = pageRectCorners(geo, { x: 18, y: 137, width: 351, height: 252 });
    expect(tl[0]).toBeLessThan(tr[0]);
    expect(bl[0]).toBeLessThan(br[0]);
    expect(tl[1]).toBeGreaterThan(bl[1]);
    expect(tr[1]).toBeGreaterThan(br[1]);
  });
});
