// src/components/dialogs/AddonManager/components/ArchivePasswordDialog.tsx
// Asks for an encrypted archive's password; the installer re-reads the archive with it.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ArchivePasswordPrompt {
  /** The dropped file the password is for. */
  path: string;
  /** Wrong passwords typed so far. */
  attempts: number;
}

interface ArchivePasswordDialogProps {
  prompt: ArchivePasswordPrompt | null;
  maxAttempts: number;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

function fileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}

interface PasswordFormProps {
  prompt: ArchivePasswordPrompt;
  maxAttempts: number;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

/** Remounted for every prompt (see the key below), so the field starts empty each time. */
function PasswordForm({ prompt, maxAttempts, onSubmit, onCancel }: PasswordFormProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const remaining = maxAttempts - prompt.attempts;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (password) onSubmit(password);
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          {t('addonManager.installer.password.title')}
        </DialogTitle>
        <DialogDescription className="min-w-0 truncate">
          {t('addonManager.installer.password.description', { name: fileName(prompt.path) })}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 py-4">
        <Label htmlFor="archive-password">{t('addonManager.installer.password.label')}</Label>
        <Input
          id="archive-password"
          type="password"
          autoFocus
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={prompt.attempts > 0}
        />
        {prompt.attempts > 0 && (
          <p className="text-destructive text-xs">
            {t('addonManager.installer.password.wrong', { remaining })}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('addonManager.installer.password.cancel')}
        </Button>
        <Button type="submit" disabled={!password}>
          {t('addonManager.installer.password.unlock')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ArchivePasswordDialog({
  prompt,
  maxAttempts,
  onSubmit,
  onCancel,
}: ArchivePasswordDialogProps) {
  return (
    <Dialog open={prompt !== null} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        {prompt && (
          <PasswordForm
            key={`${prompt.path}:${prompt.attempts}`}
            prompt={prompt}
            maxAttempts={maxAttempts}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
