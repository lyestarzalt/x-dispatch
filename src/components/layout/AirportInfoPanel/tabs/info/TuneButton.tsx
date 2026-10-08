import { Button } from '@/components/ui/button';
import { type ComRadio } from '@/queries/useXPlaneQuery';

export function TuneButton({
  radio,
  pending,
  onClick,
}: {
  radio: ComRadio;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="xs"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="justify-center font-mono font-semibold"
    >
      {radio}
    </Button>
  );
}
