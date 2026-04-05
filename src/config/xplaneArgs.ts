export interface XPlaneArgDef {
  /** The arg flag, e.g. "--no_sound" or "--window=" (trailing = means it takes a value) */
  arg: string;
  /** Short description shown in the combobox dropdown */
  description: string;
  /** Category for visual grouping in the dropdown */
  category: string;
}

export const XPLANE_ARG_CATALOG: XPlaneArgDef[] = [
  // General
  { arg: '--no_sound', description: 'Run without sound', category: 'General' },
  { arg: '--no_joysticks', description: 'Run without USB input devices', category: 'General' },
  { arg: '--disable_networking', description: 'Disable all network traffic', category: 'General' },
  {
    arg: '--missing_strings',
    description: 'Log missing localization strings',
    category: 'General',
  },
  { arg: '--lang=', description: 'Force a specific language', category: 'General' },
  { arg: '--fake_vr', description: 'VR preview without a headset', category: 'General' },

  // Windowing
  {
    arg: '--full=',
    description: 'Fullscreen at a specific resolution (WxH)',
    category: 'Windowing',
  },
  {
    arg: '--window=',
    description: 'Windowed at a specific resolution (WxH)',
    category: 'Windowing',
  },

  // Reproducibility
  {
    arg: '--weather_seed=',
    description: 'Reproducible weather across runs',
    category: 'Reproducibility',
  },
  {
    arg: '--time_seed=',
    description: 'Reproducible non-weather randomness',
    category: 'Reproducibility',
  },

  // Safe mode
  {
    arg: '--safe_mode=',
    description: 'Disable subsystems (GFX,PLG,SCN,ART,UI)',
    category: 'Safe mode',
  },

  // Overrides
  { arg: '--pref:', description: 'Override a preference (key=value)', category: 'Overrides' },
  { arg: '--dref:', description: 'Set a dataref at startup (ref=value)', category: 'Overrides' },

  // Disable hardware acceleration
  { arg: '--no_vbos', description: 'Disable vertex buffer objects', category: 'Hardware' },
  { arg: '--no_fbos', description: 'Disable framebuffer objects', category: 'Hardware' },
  { arg: '--no_pbos', description: 'Disable pixel buffer objects', category: 'Hardware' },
  { arg: '--no_sprites', description: 'Disable point sprites', category: 'Hardware' },
  { arg: '--no_pixel_counters', description: 'Disable occlusion queries', category: 'Hardware' },
  {
    arg: '--no_aniso_filtering',
    description: 'Disable anisotropic filtering',
    category: 'Hardware',
  },
  {
    arg: '--no_hw_mipmap',
    description: 'Disable hardware mipmap generation',
    category: 'Hardware',
  },
  { arg: '--no_fshaders', description: 'Disable fragment shaders', category: 'Hardware' },
  { arg: '--no_vshaders', description: 'Disable vertex shaders', category: 'Hardware' },
  { arg: '--no_glsl', description: 'Disable GLSL', category: 'Hardware' },
  { arg: '--limited_glsl', description: 'Force limited GLSL mode', category: 'Hardware' },
  {
    arg: '--unlimited_glsl',
    description: 'Force advanced shaders on old hardware',
    category: 'Hardware',
  },
  { arg: '--no_threaded_ogl', description: 'Disable multi-threaded OpenGL', category: 'Hardware' },

  // Force hardware acceleration
  {
    arg: '--use_vbos',
    description: 'Force VBOs on incompatible drivers',
    category: 'Force hardware',
  },
  {
    arg: '--use_sprites',
    description: 'Force point sprites on buggy drivers',
    category: 'Force hardware',
  },
  { arg: '--use_fshaders', description: 'Force fragment shaders', category: 'Force hardware' },
  { arg: '--use_vshaders', description: 'Force vertex shaders', category: 'Force hardware' },
  {
    arg: '--use_glsl',
    description: 'Force GLSL on incompatible cards',
    category: 'Force hardware',
  },
  {
    arg: '--use_fbos',
    description: 'Force FBOs on incompatible hardware',
    category: 'Force hardware',
  },
  {
    arg: '--force_run',
    description: 'Run on hardware below minimum requirements',
    category: 'Force hardware',
  },

  // FPS test
  { arg: '--fps_test=', description: 'Run framerate test and quit', category: 'FPS test' },
  { arg: '--verbose', description: 'Detailed per-frame timing in FPS test', category: 'FPS test' },
  { arg: '--require_fps=', description: 'Pass/fail FPS threshold', category: 'FPS test' },
  {
    arg: '--qa_script=',
    description: 'Run a QA script for performance monitoring',
    category: 'FPS test',
  },
];
