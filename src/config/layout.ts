/**
 * Centralized layout constants for consistent sizing and layering
 */

// Z-index layers (lower = further back)
export const Z_INDEX = {
  // Map is at z-0 (default)
  compass: 10, // Above map, below panels
  explorePanel: 10, // Explore panel
  sidebar: 20, // Sidebar panel
  toolbar: 50, // Top toolbar (highest)
  searchDropdown: 50, // Search results dropdown
} as const;

// Layout widths
export const WIDTHS = {
  sidebar: 320, // w-80 = 20rem = 320px
  searchBar: 300, // Search input width
  explorePanel: 340, // Explore panel width
} as const;

// Layout positioning
export const SPACING = {
  toolbarTop: 16, // top-4
  sidebarRight: 16, // right-4
  sidebarTop: 80, // top-20
  compassTop: 64, // top-16
  explorePanelTop: 176, // top-44
  panelGap: 16, // left-4, right-4, bottom-4
} as const;
