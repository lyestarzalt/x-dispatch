const PLANNER_WIDTH_REM = 26;
const AIRPORT_WIDTH_REM = 20;
const EXPLORE_WIDTH_REM = 20;
const OUTER_MARGINS_REM = 2;
const EXPLORE_GAP_REM = 0.5;
const MIN_MAP_WIDTH_REM = 20;

export function mapPanelLayout(widthRem: number, hasAirport: boolean) {
  const available = widthRem - OUTER_MARGINS_REM - MIN_MAP_WIDTH_REM;
  return {
    singlePanel: available < PLANNER_WIDTH_REM + AIRPORT_WIDTH_REM,
    inlineExplore:
      available <
      PLANNER_WIDTH_REM +
        EXPLORE_GAP_REM +
        EXPLORE_WIDTH_REM +
        (hasAirport ? AIRPORT_WIDTH_REM : 0),
  };
}
