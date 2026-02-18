import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorScreenProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onConfigure?: () => void;
  configureLabel?: string;
}

export default function ErrorScreen({
  title,
  message,
  onRetry,
  onConfigure,
  configureLabel,
}: ErrorScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-destructive">{title || t('error.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">{message}</p>
          <div className="flex justify-center gap-2">
            {onConfigure && (
              <Button variant="outline" onClick={onConfigure}>
                {configureLabel || t('error.configure')}
              </Button>
            )}
            {onRetry && (
              <Button onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('common.retry')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
