// src/components/dialogs/AddonManager/AddonManagerButton.tsx
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AddonManagerButtonProps {
  onClick: () => void;
}

export function AddonManagerButton({ onClick }: AddonManagerButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} className="h-9 w-9">
          <Package className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Addon Manager</TooltipContent>
    </Tooltip>
  );
}
