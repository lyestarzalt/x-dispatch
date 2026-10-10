export interface RoutesTabProps {
  /** A city pair was picked: open the plan builder on it. */
  onPlanRoute: (from: string, to: string) => void;
}
