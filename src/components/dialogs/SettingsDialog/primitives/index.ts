/**
 * Settings dialog primitives.
 *
 * Every section in `../sections/` MUST compose these instead of
 * re-implementing the same shapes inline. See CLAUDE.md, "Settings
 * dialog sections" rule, for the canonical visual contract these
 * primitives encode.
 *
 * NEVER import `Card`, `CardHeader`, `CardTitle`, `CardContent`,
 * or `CardDescription` from these primitives or in any section file.
 * The sidebar tab is the container — nesting Cards doubles the chrome.
 */
export { SettingsHeader } from './SettingsHeader';
export { SettingsSectionBlock } from './SettingsSectionBlock';
export { SettingsToggleRow } from './SettingsToggleRow';
export { SettingsLinkRow } from './SettingsLinkRow';
export { SettingsPathDisplay } from './SettingsPathDisplay';
export { SettingsEmptyState } from './SettingsEmptyState';
