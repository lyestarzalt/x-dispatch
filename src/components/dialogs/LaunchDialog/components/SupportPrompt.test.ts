import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from 'i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogbookEntry } from '@/components/dialogs/LaunchDialog/types';
import '@/i18n';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';

const custom = vi.fn();
vi.mock('sonner', () => ({
  toast: { custom: (...args: unknown[]) => custom(...args), dismiss: vi.fn() },
}));
vi.mock('@/queries', () => ({ trackEvent: vi.fn() }));

async function renderPrompt(): Promise<string> {
  vi.useFakeTimers();
  useSettingsStore.getState().updateSupportSettings({ promptDismissed: false });
  useLaunchStore.setState({ logbook: [{} as LogbookEntry, {} as LogbookEntry] });
  const { showSupportToastIfEligible } = await import('./SupportPrompt');
  showSupportToastIfEligible();
  vi.runAllTimers();
  const render = custom.mock.calls.at(-1)?.[0] as (id: string) => ReactElement;
  return renderToStaticMarkup(render('toast-1'));
}

describe('support prompt', () => {
  afterEach(async () => {
    vi.useRealTimers();
    custom.mockClear();
    await i18n.changeLanguage('en');
  });

  it('is shown in the app language', async () => {
    await i18n.changeLanguage('fr');
    const html = await renderPrompt();
    expect(html).toContain(i18n.t('supportPrompt.title'));
    expect(html).toContain(i18n.t('supportPrompt.notNow'));
    expect(html).not.toContain('Enjoying X-Dispatch?');
  });
});
