/* eslint-disable react-hooks/set-state-in-effect -- SIA credentials sync */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Download, LogIn, Map } from 'lucide-react';
import {
  SettingsHeader,
  SettingsSectionBlock,
} from '@/components/dialogs/SettingsDialog/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  useSiaClearMutation,
  useSiaCredentialsStatusQuery,
  useSiaDownloadMutation,
  useSiaInstallMutation,
  useSiaInstallStatusQuery,
  useSiaProductsQuery,
} from '@/queries/useSiaQuery';

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function translateSiaError(t: (key: string) => string, error?: string): string {
  if (!error) return t('common.error');
  if (error.startsWith('sia.errors.')) return t(error);
  return error;
}

export function SiaChartsSection() {
  const { t } = useTranslation();
  const { data: products } = useSiaProductsQuery();
  const { data: status, refetch } = useSiaInstallStatusQuery();
  const { data: credStatus, refetch: refetchCreds } = useSiaCredentialsStatusQuery();
  const installMutation = useSiaInstallMutation();
  const downloadMutation = useSiaDownloadMutation();
  const clearMutation = useSiaClearMutation();
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (credStatus?.email) setEmail(credStatus.email);
  }, [credStatus?.email]);

  useEffect(() => {
    const unsub = window.siaAPI.onDownloadProgress((p) => {
      setProgress({ percent: p.percent, message: p.message });
      if (p.phase === 'error') {
        setDownloadError(translateSiaError(t, p.message));
      }
      if (p.phase === 'done' || p.phase === 'error') {
        void refetch();
        setTimeout(() => setProgress(null), p.phase === 'error' ? 4000 : 2000);
      }
    });
    return unsub;
  }, [refetch, t]);

  const fullProduct = products?.find((p) => p.kind === 'eaip-full');
  const busy = installMutation.isPending || downloadMutation.isPending;

  const handleImportEaip = async () => {
    if (!fullProduct) return;
    const zip = await window.siaAPI.browseForZip();
    if (!zip) return;
    setDownloadError(null);
    setProgress({ percent: 0, message: t('sia.installing') });
    const result = await installMutation.mutateAsync({ zipPath: zip, productId: fullProduct.id });
    if (!result.success) {
      setDownloadError(translateSiaError(t, result.error));
    }
  };

  const handleDownload = async (productId: string) => {
    setDownloadError(null);
    setProgress({ percent: 0, message: t('sia.installing') });
    const result = await downloadMutation.mutateAsync(productId);
    if (!result.success) {
      setDownloadError(translateSiaError(t, result.error));
    }
  };

  const handleImportAmdt = async (productId: string) => {
    const zip = await window.siaAPI.browseForZip();
    if (!zip) return;
    setDownloadError(null);
    setProgress({ percent: 0, message: t('sia.installing') });
    const result = await installMutation.mutateAsync({ zipPath: zip, productId });
    if (!result.success) {
      setDownloadError(translateSiaError(t, result.error));
    }
  };

  const handleSaveCredentials = async () => {
    setAccountMessage(null);
    if (!email.trim() || !password) {
      setAccountMessage(t('sia.errors.noCredentials'));
      return;
    }
    const result = await window.siaAPI.saveCredentials(email, password);
    if (result.success) {
      setPassword('');
      setAccountMessage(t('sia.account.saved'));
      void refetchCreds();
    } else {
      setAccountMessage(result.error ?? t('common.error'));
    }
  };

  const handleTestLogin = async () => {
    setAccountMessage(null);
    if (!email.trim() || !password) {
      setAccountMessage(t('sia.errors.noCredentials'));
      return;
    }
    const result = await window.siaAPI.testLogin(email, password);
    if (result.success) {
      setAccountMessage(t('sia.account.loginOk'));
    } else {
      setAccountMessage(t('sia.account.loginFailed', { error: result.error ?? t('common.error') }));
    }
  };

  const handleImportInternationalVac = async () => {
    setDownloadError(null);
    setProgress({ percent: 0, message: t('sia.installing') });
    const result = await window.siaAPI.importVacArchive();
    if (!result.success && result.error !== 'cancelled') {
      setDownloadError(translateSiaError(t, result.error));
    }
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={Map}
        title={t('sia.settings.title')}
        description={t('sia.settings.description')}
      />

      {status?.updateAvailable && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>{t('sia.updateAvailable', { cycle: status.latestCatalogCycle })}</p>
        </div>
      )}

      <SettingsSectionBlock title={t('sia.account.title')}>
        <p className="mb-3 text-sm text-muted-foreground">{t('sia.account.description')}</p>
        {credStatus && !credStatus.encryptionAvailable && (
          <p className="mb-3 text-sm text-amber-600">{t('sia.account.noEncryption')}</p>
        )}
        {credStatus?.configured && credStatus.email && (
          <p className="mb-3 text-sm text-muted-foreground">
            {t('sia.account.configured', { email: credStatus.email })}
          </p>
        )}
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="sia-email">{t('sia.account.email')}</Label>
            <Input
              id="sia-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sia-password">{t('sia.account.password')}</Label>
            <Input
              id="sia-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        {accountMessage && <p className="mb-3 text-sm text-muted-foreground">{accountMessage}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!credStatus?.encryptionAvailable}
            onClick={() => void handleSaveCredentials()}
          >
            <LogIn className="h-3.5 w-3.5" />
            {t('sia.account.save')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void handleTestLogin()}>
            {t('sia.account.test')}
          </Button>
          {credStatus?.configured && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await window.siaAPI.clearCredentials();
                setPassword('');
                setAccountMessage(null);
                void refetchCreds();
              }}
            >
              {t('sia.account.clear')}
            </Button>
          )}
        </div>
      </SettingsSectionBlock>

      <SettingsSectionBlock title={t('sia.settings.eaip')}>
        <p className="mb-3 text-sm text-muted-foreground">
          {status?.hasData
            ? t('sia.settings.installed', {
                cycle: status.cycle ?? '—',
                vacCount: status.vacCount,
                aipCount: status.aipCount,
                size: formatBytes(status.diskUsageBytes),
              })
            : t('sia.settings.notInstalled')}
        </p>
        {downloadError && <p className="mb-3 text-sm text-destructive">{downloadError}</p>}
        {progress && (
          <div className="mb-3 space-y-1">
            <Progress value={progress.percent} />
            <p className="text-xs text-muted-foreground">{progress.message}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            disabled={busy || !fullProduct || !credStatus?.configured}
            onClick={() => fullProduct && void handleDownload(fullProduct.id)}
          >
            <Download className="h-3.5 w-3.5" />
            {t('sia.downloadEaip')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void handleImportEaip()}
          >
            <Download className="h-3.5 w-3.5" />
            {t('sia.importEaip')}
          </Button>
          {products
            ?.filter((p) => p.kind !== 'eaip-full')
            .map((p) => (
              <Button
                key={`dl-${p.id}`}
                variant="outline"
                size="sm"
                disabled={busy || !credStatus?.configured}
                onClick={() => void handleDownload(p.id)}
              >
                {t('sia.downloadAmdt')} — {t(p.nameKey)}
              </Button>
            ))}
          {products
            ?.filter((p) => p.kind !== 'eaip-full')
            .map((p) => (
              <Button
                key={`import-${p.id}`}
                variant="ghost"
                size="sm"
                disabled={busy || !status?.hasData}
                onClick={() => void handleImportAmdt(p.id)}
              >
                {t(p.nameKey)}
              </Button>
            ))}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !status?.hasData}
            onClick={async () => {
              setProgress({ percent: 50, message: t('sia.reindexVac') });
              await window.siaAPI.reindexVac();
              void refetch();
              setProgress(null);
            }}
          >
            {t('sia.reindexVac')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={clearMutation.isPending || !status?.hasData}
            onClick={() => void clearMutation.mutateAsync()}
          >
            {t('sia.clearData')}
          </Button>
        </div>
      </SettingsSectionBlock>

      <SettingsSectionBlock
        title={t('sia.settings.internationalVac')}
        description={t('sia.settings.internationalVacDescription')}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void handleImportInternationalVac()}
          >
            <Download className="h-3.5 w-3.5" />
            {t('sia.importVacInternational')}
          </Button>
        </div>
      </SettingsSectionBlock>

      <p className="text-xs text-muted-foreground">{t('sia.attribution')}</p>
    </div>
  );
}
