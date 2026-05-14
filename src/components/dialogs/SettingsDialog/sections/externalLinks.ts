export async function openSettingsExternalLink(url: string): Promise<void> {
  await window.appAPI.openExternal(url);
}
