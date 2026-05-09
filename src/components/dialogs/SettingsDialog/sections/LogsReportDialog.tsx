import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ParseResult } from '@/lib/xplaneServices/log/parseLog';

const EXCERPT_BYTE_CAP = 200_000;
const CONTEXT_LINES = 5;

interface LogsReportDialogProps {
  open: boolean;
  onClose: () => void;
  rawLog: string;
  parsed: ParseResult;
}

export function LogsReportDialog({ open, onClose, rawLog, parsed }: LogsReportDialogProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const scaffold = useMemo(() => buildScaffold(t, parsed), [t, parsed]);
  const excerpt = useMemo(() => buildExcerpt(rawLog, parsed), [rawLog, parsed]);

  useEffect(() => {
    if (open) {
      setMessage(scaffold);
      setEmail('');
    }
  }, [open, scaffold]);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    const scope = Sentry.getCurrentScope();
    try {
      scope.addAttachment({ filename: 'log-excerpt.txt', data: excerpt });
      Sentry.captureFeedback({
        message: message.trim(),
        ...(email.trim() && { email: email.trim() }),
      });
      toast.success(t('settings.logs.reportDialog.success'));
      onClose();
    } catch {
      toast.error(t('settings.logs.reportDialog.error'));
    } finally {
      scope.clearAttachments();
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.logs.reportDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="logs-report-message" className="xp-label">
              {t('settings.logs.reportDialog.descriptionPlaceholder')}
            </Label>
            <Textarea
              id="logs-report-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label htmlFor="logs-report-email" className="xp-label">
              {t('settings.logs.reportDialog.emailPlaceholder')}
            </Label>
            <Input
              id="logs-report-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={sending || !message.trim()}>
            {sending
              ? t('settings.logs.reportDialog.sending')
              : t('settings.logs.reportDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildScaffold(
  t: (key: string, opts?: Record<string, unknown>) => string,
  parsed: ParseResult
): string {
  const lines: string[] = [];
  lines.push(t('settings.logs.reportDialog.scaffoldHeader'));
  lines.push('');
  if (parsed.recognized.length > 0) {
    lines.push(t('settings.logs.reportDialog.scaffoldRecognized'));
    for (const m of parsed.recognized) {
      lines.push(`- ${t(`logs.patterns.${m.id}`)}`);
    }
  } else {
    lines.push(`${t('settings.logs.reportDialog.scaffoldRecognized')} —`);
  }
  lines.push('');
  lines.push(t('settings.logs.reportDialog.scaffoldOther', { count: parsed.otherIssues.length }));
  lines.push('');
  lines.push(t('settings.logs.reportDialog.descriptionPlaceholder'));
  lines.push('');
  return lines.join('\n');
}

function buildExcerpt(rawLog: string, parsed: ParseResult): string {
  const allLines = rawLog.split('\n');
  const wanted = new Set<number>();
  const targets = [
    ...parsed.recognized.map((m) => m.lineNumber),
    ...parsed.otherIssues.map((m) => m.lineNumber),
  ];
  for (const ln of targets) {
    for (let i = ln - CONTEXT_LINES; i <= ln + CONTEXT_LINES; i++) {
      if (i >= 1 && i <= allLines.length) wanted.add(i);
    }
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: string[] = [];
  let prev = 0;
  for (const i of sorted) {
    if (prev !== 0 && i !== prev + 1) out.push('---');
    out.push(`${i}: ${allLines[i - 1] ?? ''}`);
    prev = i;
  }
  let joined = out.join('\n');
  if (joined.length > EXCERPT_BYTE_CAP) {
    joined = `${joined.slice(0, EXCERPT_BYTE_CAP)}\n[truncated]`;
  }
  return joined;
}
