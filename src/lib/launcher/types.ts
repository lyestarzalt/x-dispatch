import { Coordinates } from '@/types/geo';

export interface Aircraft {
  path: string;
  name: string;
  icao: string; // ICAO type code (e.g., "C172", "B738")
  description: string;
  manufacturer: string;
  studio: string;
  author: string;
  tailNumber: string;
  // Weights (all in lbs)
  emptyWeight: number;
  maxWeight: number;
  maxFuel: number;
  tankNames: string[];
  // Aircraft type
  isHelicopter: boolean;
  engineCount: number;
  propCount: number; // 0 = jet
  // Speeds (knots)
  vneKts: number; // Never exceed speed
  vnoKts: number; // Max cruise speed
  // Images
  previewImage: string | null;
  thumbnailImage: string | null;
  liveries: Livery[];
}

export interface Livery {
  name: string;
  displayName: string;
  previewImage: string | null;
}

export interface FuelConfig {
  percentage: number;
  tankWeights: number[];
}

interface PayloadConfig {
  stationWeights: number[];
}

export interface WeatherPreset {
  name: string;
  definition: string;
}

export interface TimeConfig extends Coordinates {
  dayOfYear: number;
  timeInHours: number;
}

/** Start position for X-Plane launch config (position identifier, no coordinates) */
export interface LaunchStartPosition {
  type: 'runway' | 'ramp';
  airport: string;
  position: string;
}

export interface LaunchConfig {
  aircraft: Aircraft;
  livery: string;
  fuel: FuelConfig;
  startPosition: LaunchStartPosition;
  time: TimeConfig;
  weather: WeatherPreset;
  startEngineRunning?: boolean;
}

// Weather Presets - All use COMPLETE _wxr_def definitions (X-Plane requires full parameter set)
// var_deft_change_enum: 3=static/preset weather, 7=real weather (METAR)
export const WEATHER_PRESETS: WeatherPreset[] = [
  {
    // Real Weather - downloads live METAR data
    name: 'Real Weather',
    definition:
      ',var_rand_space_pct=0.00,var_deft_change_enum=7,var_rwx_is_sim_time=1,var_vis_sm=30.00,var_vis_alt_lo_ft=5000.00,var_vis_alt_hi_ft=15000.00,var_ISA_offset_C=0.00,var_SLP_pas=101325.00,var_QNH_ele=13.00,var_precip_rat=0.00,var_cld_typ_enum0=2,var_cld_cov0=0.25,var_tops_msl_ft0=8000.00,var_bases_msl_ft0=5000.00,var_cld_typ_enum1=0,var_cld_cov1=0.00,var_tops_msl_ft1=20000.00,var_bases_msl_ft1=18000.00,var_cld_typ_enum2=0,var_cld_cov2=0.00,var_tops_msl_ft2=30000.00,var_bases_msl_ft2=28000.00,var_wind_alt_msl_ft0=3000.00,var_wind_alt_msl_ft1=10000.00,var_wind_alt_msl_ft2=25000.00,var_wind_alt_msl_ft3=35000.00,var_wind_alt_msl_ft4=40000.00,var_wind_alt_msl_ft5=45000.00,var_wind_alt_msl_ft6=50000.00,var_wind_alt_msl_ft7=55000.00,var_wind_alt_msl_ft8=60000.00,var_wind_alt_msl_ft9=65000.00,var_wind_alt_msl_ft10=70000.00,var_wind_alt_msl_ft11=75000.00,var_wind_alt_msl_ft12=80000.00,var_wind_spd_kt0=8.00,var_wind_spd_kt1=15.00,var_wind_spd_kt2=30.00,var_wind_spd_kt3=-1.00,var_wind_spd_kt4=-1.00,var_wind_spd_kt5=-1.00,var_wind_spd_kt6=-1.00,var_wind_spd_kt7=-1.00,var_wind_spd_kt8=-1.00,var_wind_spd_kt9=-1.00,var_wind_spd_kt10=-1.00,var_wind_spd_kt11=-1.00,var_wind_spd_kt12=-1.00,var_wind_dir_true0=270.00,var_wind_dir_true1=280.00,var_wind_dir_true2=290.00,var_wind_dir_true3=0.00,var_wind_dir_true4=0.00,var_wind_dir_true5=0.00,var_wind_dir_true6=0.00,var_wind_dir_true7=0.00,var_wind_dir_true8=0.00,var_wind_dir_true9=0.00,var_wind_dir_true10=0.00,var_wind_dir_true11=0.00,var_wind_dir_true12=0.00,var_wind_inc_kt0=0.00,var_wind_inc_kt1=0.00,var_wind_inc_kt2=0.00,var_wind_inc_kt3=0.00,var_wind_inc_kt4=0.00,var_wind_inc_kt5=0.00,var_wind_inc_kt6=0.00,var_wind_inc_kt7=0.00,var_wind_inc_kt8=0.00,var_wind_inc_kt9=0.00,var_wind_inc_kt10=0.00,var_wind_inc_kt11=0.00,var_wind_inc_kt12=0.00,var_wind_shr_deg0=0.00,var_wind_shr_deg1=0.00,var_wind_shr_deg2=0.00,var_wind_shr_deg3=0.00,var_wind_shr_deg4=0.00,var_wind_shr_deg5=0.00,var_wind_shr_deg6=0.00,var_wind_shr_deg7=0.00,var_wind_shr_deg8=0.00,var_wind_shr_deg9=0.00,var_wind_shr_deg10=0.00,var_wind_shr_deg11=0.00,var_wind_shr_deg12=0.00,var_CAT_rat0=0.00,var_CAT_rat1=0.00,var_CAT_rat2=0.00,var_CAT_rat3=0.00,var_CAT_rat4=0.00,var_CAT_rat5=0.00,var_CAT_rat6=0.00,var_CAT_rat7=0.00,var_CAT_rat8=0.00,var_CAT_rat9=0.00,var_CAT_rat10=0.00,var_CAT_rat11=0.00,var_CAT_rat12=0.00,var_therm_vvi_fpm=0.00,var_wave_height_ft=2.00,var_wave_dir_deg=270.00,var_ter_eff_UI=3',
  },
  {
    // Clear skies - no clouds, calm winds, excellent visibility
    name: 'Clear',
    definition:
      ',var_rand_space_pct=0.00,var_deft_change_enum=3,var_rwx_is_sim_time=1,var_vis_sm=50.00,var_vis_alt_lo_ft=5000.00,var_vis_alt_hi_ft=15000.00,var_ISA_offset_C=0.00,var_SLP_pas=101325.00,var_QNH_ele=13.00,var_precip_rat=0.00,var_cld_typ_enum0=0,var_cld_cov0=0.00,var_tops_msl_ft0=8000.00,var_bases_msl_ft0=5000.00,var_cld_typ_enum1=0,var_cld_cov1=0.00,var_tops_msl_ft1=20000.00,var_bases_msl_ft1=18000.00,var_cld_typ_enum2=0,var_cld_cov2=0.00,var_tops_msl_ft2=30000.00,var_bases_msl_ft2=28000.00,var_wind_alt_msl_ft0=3000.00,var_wind_alt_msl_ft1=10000.00,var_wind_alt_msl_ft2=25000.00,var_wind_alt_msl_ft3=35000.00,var_wind_alt_msl_ft4=40000.00,var_wind_alt_msl_ft5=45000.00,var_wind_alt_msl_ft6=50000.00,var_wind_alt_msl_ft7=55000.00,var_wind_alt_msl_ft8=60000.00,var_wind_alt_msl_ft9=65000.00,var_wind_alt_msl_ft10=70000.00,var_wind_alt_msl_ft11=75000.00,var_wind_alt_msl_ft12=80000.00,var_wind_spd_kt0=5.00,var_wind_spd_kt1=10.00,var_wind_spd_kt2=20.00,var_wind_spd_kt3=-1.00,var_wind_spd_kt4=-1.00,var_wind_spd_kt5=-1.00,var_wind_spd_kt6=-1.00,var_wind_spd_kt7=-1.00,var_wind_spd_kt8=-1.00,var_wind_spd_kt9=-1.00,var_wind_spd_kt10=-1.00,var_wind_spd_kt11=-1.00,var_wind_spd_kt12=-1.00,var_wind_dir_true0=270.00,var_wind_dir_true1=280.00,var_wind_dir_true2=290.00,var_wind_dir_true3=0.00,var_wind_dir_true4=0.00,var_wind_dir_true5=0.00,var_wind_dir_true6=0.00,var_wind_dir_true7=0.00,var_wind_dir_true8=0.00,var_wind_dir_true9=0.00,var_wind_dir_true10=0.00,var_wind_dir_true11=0.00,var_wind_dir_true12=0.00,var_wind_inc_kt0=0.00,var_wind_inc_kt1=0.00,var_wind_inc_kt2=0.00,var_wind_inc_kt3=0.00,var_wind_inc_kt4=0.00,var_wind_inc_kt5=0.00,var_wind_inc_kt6=0.00,var_wind_inc_kt7=0.00,var_wind_inc_kt8=0.00,var_wind_inc_kt9=0.00,var_wind_inc_kt10=0.00,var_wind_inc_kt11=0.00,var_wind_inc_kt12=0.00,var_wind_shr_deg0=0.00,var_wind_shr_deg1=0.00,var_wind_shr_deg2=0.00,var_wind_shr_deg3=0.00,var_wind_shr_deg4=0.00,var_wind_shr_deg5=0.00,var_wind_shr_deg6=0.00,var_wind_shr_deg7=0.00,var_wind_shr_deg8=0.00,var_wind_shr_deg9=0.00,var_wind_shr_deg10=0.00,var_wind_shr_deg11=0.00,var_wind_shr_deg12=0.00,var_CAT_rat0=0.00,var_CAT_rat1=0.00,var_CAT_rat2=0.00,var_CAT_rat3=0.00,var_CAT_rat4=0.00,var_CAT_rat5=0.00,var_CAT_rat6=0.00,var_CAT_rat7=0.00,var_CAT_rat8=0.00,var_CAT_rat9=0.00,var_CAT_rat10=0.00,var_CAT_rat11=0.00,var_CAT_rat12=0.00,var_therm_vvi_fpm=0.00,var_wave_height_ft=1.00,var_wave_dir_deg=270.00,var_ter_eff_UI=0',
  },
  {
    // Cloudy - overcast layer, moderate visibility
    name: 'Cloudy',
    definition:
      ',var_rand_space_pct=0.00,var_deft_change_enum=3,var_rwx_is_sim_time=1,var_vis_sm=15.00,var_vis_alt_lo_ft=5000.00,var_vis_alt_hi_ft=15000.00,var_ISA_offset_C=0.00,var_SLP_pas=101325.00,var_QNH_ele=13.00,var_precip_rat=0.00,var_cld_typ_enum0=1,var_cld_cov0=0.85,var_tops_msl_ft0=10000.00,var_bases_msl_ft0=4000.00,var_cld_typ_enum1=0,var_cld_cov1=0.00,var_tops_msl_ft1=20000.00,var_bases_msl_ft1=18000.00,var_cld_typ_enum2=0,var_cld_cov2=0.00,var_tops_msl_ft2=30000.00,var_bases_msl_ft2=28000.00,var_wind_alt_msl_ft0=3000.00,var_wind_alt_msl_ft1=10000.00,var_wind_alt_msl_ft2=25000.00,var_wind_alt_msl_ft3=35000.00,var_wind_alt_msl_ft4=40000.00,var_wind_alt_msl_ft5=45000.00,var_wind_alt_msl_ft6=50000.00,var_wind_alt_msl_ft7=55000.00,var_wind_alt_msl_ft8=60000.00,var_wind_alt_msl_ft9=65000.00,var_wind_alt_msl_ft10=70000.00,var_wind_alt_msl_ft11=75000.00,var_wind_alt_msl_ft12=80000.00,var_wind_spd_kt0=12.00,var_wind_spd_kt1=18.00,var_wind_spd_kt2=30.00,var_wind_spd_kt3=-1.00,var_wind_spd_kt4=-1.00,var_wind_spd_kt5=-1.00,var_wind_spd_kt6=-1.00,var_wind_spd_kt7=-1.00,var_wind_spd_kt8=-1.00,var_wind_spd_kt9=-1.00,var_wind_spd_kt10=-1.00,var_wind_spd_kt11=-1.00,var_wind_spd_kt12=-1.00,var_wind_dir_true0=250.00,var_wind_dir_true1=260.00,var_wind_dir_true2=270.00,var_wind_dir_true3=0.00,var_wind_dir_true4=0.00,var_wind_dir_true5=0.00,var_wind_dir_true6=0.00,var_wind_dir_true7=0.00,var_wind_dir_true8=0.00,var_wind_dir_true9=0.00,var_wind_dir_true10=0.00,var_wind_dir_true11=0.00,var_wind_dir_true12=0.00,var_wind_inc_kt0=0.00,var_wind_inc_kt1=0.00,var_wind_inc_kt2=0.00,var_wind_inc_kt3=0.00,var_wind_inc_kt4=0.00,var_wind_inc_kt5=0.00,var_wind_inc_kt6=0.00,var_wind_inc_kt7=0.00,var_wind_inc_kt8=0.00,var_wind_inc_kt9=0.00,var_wind_inc_kt10=0.00,var_wind_inc_kt11=0.00,var_wind_inc_kt12=0.00,var_wind_shr_deg0=0.00,var_wind_shr_deg1=0.00,var_wind_shr_deg2=0.00,var_wind_shr_deg3=0.00,var_wind_shr_deg4=0.00,var_wind_shr_deg5=0.00,var_wind_shr_deg6=0.00,var_wind_shr_deg7=0.00,var_wind_shr_deg8=0.00,var_wind_shr_deg9=0.00,var_wind_shr_deg10=0.00,var_wind_shr_deg11=0.00,var_wind_shr_deg12=0.00,var_CAT_rat0=0.00,var_CAT_rat1=0.00,var_CAT_rat2=0.00,var_CAT_rat3=0.00,var_CAT_rat4=0.00,var_CAT_rat5=0.00,var_CAT_rat6=0.00,var_CAT_rat7=0.00,var_CAT_rat8=0.00,var_CAT_rat9=0.00,var_CAT_rat10=0.00,var_CAT_rat11=0.00,var_CAT_rat12=0.00,var_therm_vvi_fpm=0.00,var_wave_height_ft=2.00,var_wave_dir_deg=270.00,var_ter_eff_UI=2',
  },
  {
    // Rainy - rain with low clouds, reduced visibility
    name: 'Rainy',
    definition:
      ',var_rand_space_pct=0.00,var_deft_change_enum=3,var_rwx_is_sim_time=1,var_vis_sm=6.00,var_vis_alt_lo_ft=3000.00,var_vis_alt_hi_ft=10000.00,var_ISA_offset_C=0.00,var_SLP_pas=100800.00,var_QNH_ele=13.00,var_precip_rat=0.50,var_cld_typ_enum0=2,var_cld_cov0=0.90,var_tops_msl_ft0=15000.00,var_bases_msl_ft0=2000.00,var_cld_typ_enum1=1,var_cld_cov1=0.40,var_tops_msl_ft1=25000.00,var_bases_msl_ft1=18000.00,var_cld_typ_enum2=0,var_cld_cov2=0.00,var_tops_msl_ft2=30000.00,var_bases_msl_ft2=28000.00,var_wind_alt_msl_ft0=3000.00,var_wind_alt_msl_ft1=10000.00,var_wind_alt_msl_ft2=25000.00,var_wind_alt_msl_ft3=35000.00,var_wind_alt_msl_ft4=40000.00,var_wind_alt_msl_ft5=45000.00,var_wind_alt_msl_ft6=50000.00,var_wind_alt_msl_ft7=55000.00,var_wind_alt_msl_ft8=60000.00,var_wind_alt_msl_ft9=65000.00,var_wind_alt_msl_ft10=70000.00,var_wind_alt_msl_ft11=75000.00,var_wind_alt_msl_ft12=80000.00,var_wind_spd_kt0=18.00,var_wind_spd_kt1=25.00,var_wind_spd_kt2=35.00,var_wind_spd_kt3=-1.00,var_wind_spd_kt4=-1.00,var_wind_spd_kt5=-1.00,var_wind_spd_kt6=-1.00,var_wind_spd_kt7=-1.00,var_wind_spd_kt8=-1.00,var_wind_spd_kt9=-1.00,var_wind_spd_kt10=-1.00,var_wind_spd_kt11=-1.00,var_wind_spd_kt12=-1.00,var_wind_dir_true0=200.00,var_wind_dir_true1=210.00,var_wind_dir_true2=220.00,var_wind_dir_true3=0.00,var_wind_dir_true4=0.00,var_wind_dir_true5=0.00,var_wind_dir_true6=0.00,var_wind_dir_true7=0.00,var_wind_dir_true8=0.00,var_wind_dir_true9=0.00,var_wind_dir_true10=0.00,var_wind_dir_true11=0.00,var_wind_dir_true12=0.00,var_wind_inc_kt0=8.00,var_wind_inc_kt1=5.00,var_wind_inc_kt2=0.00,var_wind_inc_kt3=0.00,var_wind_inc_kt4=0.00,var_wind_inc_kt5=0.00,var_wind_inc_kt6=0.00,var_wind_inc_kt7=0.00,var_wind_inc_kt8=0.00,var_wind_inc_kt9=0.00,var_wind_inc_kt10=0.00,var_wind_inc_kt11=0.00,var_wind_inc_kt12=0.00,var_wind_shr_deg0=0.00,var_wind_shr_deg1=0.00,var_wind_shr_deg2=0.00,var_wind_shr_deg3=0.00,var_wind_shr_deg4=0.00,var_wind_shr_deg5=0.00,var_wind_shr_deg6=0.00,var_wind_shr_deg7=0.00,var_wind_shr_deg8=0.00,var_wind_shr_deg9=0.00,var_wind_shr_deg10=0.00,var_wind_shr_deg11=0.00,var_wind_shr_deg12=0.00,var_CAT_rat0=0.00,var_CAT_rat1=0.00,var_CAT_rat2=0.00,var_CAT_rat3=0.00,var_CAT_rat4=0.00,var_CAT_rat5=0.00,var_CAT_rat6=0.00,var_CAT_rat7=0.00,var_CAT_rat8=0.00,var_CAT_rat9=0.00,var_CAT_rat10=0.00,var_CAT_rat11=0.00,var_CAT_rat12=0.00,var_therm_vvi_fpm=0.00,var_wave_height_ft=4.00,var_wave_dir_deg=200.00,var_ter_eff_UI=5',
  },
  {
    // Stormy - thunderstorms, very low visibility, strong winds
    name: 'Stormy',
    definition:
      ',var_rand_space_pct=0.00,var_deft_change_enum=3,var_rwx_is_sim_time=1,var_vis_sm=3.00,var_vis_alt_lo_ft=2000.00,var_vis_alt_hi_ft=8000.00,var_ISA_offset_C=0.00,var_SLP_pas=100000.00,var_QNH_ele=13.00,var_precip_rat=0.80,var_cld_typ_enum0=3,var_cld_cov0=0.95,var_tops_msl_ft0=40000.00,var_bases_msl_ft0=1500.00,var_cld_typ_enum1=2,var_cld_cov1=0.60,var_tops_msl_ft1=30000.00,var_bases_msl_ft1=20000.00,var_cld_typ_enum2=0,var_cld_cov2=0.00,var_tops_msl_ft2=45000.00,var_bases_msl_ft2=35000.00,var_wind_alt_msl_ft0=3000.00,var_wind_alt_msl_ft1=10000.00,var_wind_alt_msl_ft2=25000.00,var_wind_alt_msl_ft3=35000.00,var_wind_alt_msl_ft4=40000.00,var_wind_alt_msl_ft5=45000.00,var_wind_alt_msl_ft6=50000.00,var_wind_alt_msl_ft7=55000.00,var_wind_alt_msl_ft8=60000.00,var_wind_alt_msl_ft9=65000.00,var_wind_alt_msl_ft10=70000.00,var_wind_alt_msl_ft11=75000.00,var_wind_alt_msl_ft12=80000.00,var_wind_spd_kt0=28.00,var_wind_spd_kt1=40.00,var_wind_spd_kt2=50.00,var_wind_spd_kt3=-1.00,var_wind_spd_kt4=-1.00,var_wind_spd_kt5=-1.00,var_wind_spd_kt6=-1.00,var_wind_spd_kt7=-1.00,var_wind_spd_kt8=-1.00,var_wind_spd_kt9=-1.00,var_wind_spd_kt10=-1.00,var_wind_spd_kt11=-1.00,var_wind_spd_kt12=-1.00,var_wind_dir_true0=180.00,var_wind_dir_true1=190.00,var_wind_dir_true2=200.00,var_wind_dir_true3=0.00,var_wind_dir_true4=0.00,var_wind_dir_true5=0.00,var_wind_dir_true6=0.00,var_wind_dir_true7=0.00,var_wind_dir_true8=0.00,var_wind_dir_true9=0.00,var_wind_dir_true10=0.00,var_wind_dir_true11=0.00,var_wind_dir_true12=0.00,var_wind_inc_kt0=18.00,var_wind_inc_kt1=12.00,var_wind_inc_kt2=8.00,var_wind_inc_kt3=0.00,var_wind_inc_kt4=0.00,var_wind_inc_kt5=0.00,var_wind_inc_kt6=0.00,var_wind_inc_kt7=0.00,var_wind_inc_kt8=0.00,var_wind_inc_kt9=0.00,var_wind_inc_kt10=0.00,var_wind_inc_kt11=0.00,var_wind_inc_kt12=0.00,var_wind_shr_deg0=0.00,var_wind_shr_deg1=0.00,var_wind_shr_deg2=0.00,var_wind_shr_deg3=0.00,var_wind_shr_deg4=0.00,var_wind_shr_deg5=0.00,var_wind_shr_deg6=0.00,var_wind_shr_deg7=0.00,var_wind_shr_deg8=0.00,var_wind_shr_deg9=0.00,var_wind_shr_deg10=0.00,var_wind_shr_deg11=0.00,var_wind_shr_deg12=0.00,var_CAT_rat0=0.20,var_CAT_rat1=0.30,var_CAT_rat2=0.10,var_CAT_rat3=0.00,var_CAT_rat4=0.00,var_CAT_rat5=0.00,var_CAT_rat6=0.00,var_CAT_rat7=0.00,var_CAT_rat8=0.00,var_CAT_rat9=0.00,var_CAT_rat10=0.00,var_CAT_rat11=0.00,var_CAT_rat12=0.00,var_therm_vvi_fpm=500.00,var_wave_height_ft=8.00,var_wave_dir_deg=180.00,var_ter_eff_UI=9',
  },
  {
    // Snowy - snow with low clouds, reduced visibility, cold
    name: 'Snowy',
    definition:
      ',var_rand_space_pct=0.00,var_deft_change_enum=3,var_rwx_is_sim_time=1,var_vis_sm=4.00,var_vis_alt_lo_ft=3000.00,var_vis_alt_hi_ft=10000.00,var_ISA_offset_C=-15.00,var_SLP_pas=102500.00,var_QNH_ele=13.00,var_precip_rat=0.40,var_cld_typ_enum0=1,var_cld_cov0=0.95,var_tops_msl_ft0=12000.00,var_bases_msl_ft0=2500.00,var_cld_typ_enum1=0,var_cld_cov1=0.30,var_tops_msl_ft1=20000.00,var_bases_msl_ft1=15000.00,var_cld_typ_enum2=0,var_cld_cov2=0.00,var_tops_msl_ft2=30000.00,var_bases_msl_ft2=28000.00,var_wind_alt_msl_ft0=3000.00,var_wind_alt_msl_ft1=10000.00,var_wind_alt_msl_ft2=25000.00,var_wind_alt_msl_ft3=35000.00,var_wind_alt_msl_ft4=40000.00,var_wind_alt_msl_ft5=45000.00,var_wind_alt_msl_ft6=50000.00,var_wind_alt_msl_ft7=55000.00,var_wind_alt_msl_ft8=60000.00,var_wind_alt_msl_ft9=65000.00,var_wind_alt_msl_ft10=70000.00,var_wind_alt_msl_ft11=75000.00,var_wind_alt_msl_ft12=80000.00,var_wind_spd_kt0=15.00,var_wind_spd_kt1=22.00,var_wind_spd_kt2=35.00,var_wind_spd_kt3=-1.00,var_wind_spd_kt4=-1.00,var_wind_spd_kt5=-1.00,var_wind_spd_kt6=-1.00,var_wind_spd_kt7=-1.00,var_wind_spd_kt8=-1.00,var_wind_spd_kt9=-1.00,var_wind_spd_kt10=-1.00,var_wind_spd_kt11=-1.00,var_wind_spd_kt12=-1.00,var_wind_dir_true0=320.00,var_wind_dir_true1=330.00,var_wind_dir_true2=340.00,var_wind_dir_true3=0.00,var_wind_dir_true4=0.00,var_wind_dir_true5=0.00,var_wind_dir_true6=0.00,var_wind_dir_true7=0.00,var_wind_dir_true8=0.00,var_wind_dir_true9=0.00,var_wind_dir_true10=0.00,var_wind_dir_true11=0.00,var_wind_dir_true12=0.00,var_wind_inc_kt0=5.00,var_wind_inc_kt1=3.00,var_wind_inc_kt2=0.00,var_wind_inc_kt3=0.00,var_wind_inc_kt4=0.00,var_wind_inc_kt5=0.00,var_wind_inc_kt6=0.00,var_wind_inc_kt7=0.00,var_wind_inc_kt8=0.00,var_wind_inc_kt9=0.00,var_wind_inc_kt10=0.00,var_wind_inc_kt11=0.00,var_wind_inc_kt12=0.00,var_wind_shr_deg0=0.00,var_wind_shr_deg1=0.00,var_wind_shr_deg2=0.00,var_wind_shr_deg3=0.00,var_wind_shr_deg4=0.00,var_wind_shr_deg5=0.00,var_wind_shr_deg6=0.00,var_wind_shr_deg7=0.00,var_wind_shr_deg8=0.00,var_wind_shr_deg9=0.00,var_wind_shr_deg10=0.00,var_wind_shr_deg11=0.00,var_wind_shr_deg12=0.00,var_CAT_rat0=0.00,var_CAT_rat1=0.00,var_CAT_rat2=0.00,var_CAT_rat3=0.00,var_CAT_rat4=0.00,var_CAT_rat5=0.00,var_CAT_rat6=0.00,var_CAT_rat7=0.00,var_CAT_rat8=0.00,var_CAT_rat9=0.00,var_CAT_rat10=0.00,var_CAT_rat11=0.00,var_CAT_rat12=0.00,var_therm_vvi_fpm=0.00,var_wave_height_ft=2.00,var_wave_dir_deg=320.00,var_ter_eff_UI=4',
  },
  {
    // Foggy - dense fog, very low visibility, calm winds
    name: 'Foggy',
    definition:
      ',var_rand_space_pct=0.00,var_deft_change_enum=3,var_rwx_is_sim_time=1,var_vis_sm=0.25,var_vis_alt_lo_ft=500.00,var_vis_alt_hi_ft=2000.00,var_ISA_offset_C=0.00,var_SLP_pas=101800.00,var_QNH_ele=13.00,var_precip_rat=0.00,var_cld_typ_enum0=1,var_cld_cov0=1.00,var_tops_msl_ft0=800.00,var_bases_msl_ft0=0.00,var_cld_typ_enum1=0,var_cld_cov1=0.00,var_tops_msl_ft1=20000.00,var_bases_msl_ft1=18000.00,var_cld_typ_enum2=0,var_cld_cov2=0.00,var_tops_msl_ft2=30000.00,var_bases_msl_ft2=28000.00,var_wind_alt_msl_ft0=3000.00,var_wind_alt_msl_ft1=10000.00,var_wind_alt_msl_ft2=25000.00,var_wind_alt_msl_ft3=35000.00,var_wind_alt_msl_ft4=40000.00,var_wind_alt_msl_ft5=45000.00,var_wind_alt_msl_ft6=50000.00,var_wind_alt_msl_ft7=55000.00,var_wind_alt_msl_ft8=60000.00,var_wind_alt_msl_ft9=65000.00,var_wind_alt_msl_ft10=70000.00,var_wind_alt_msl_ft11=75000.00,var_wind_alt_msl_ft12=80000.00,var_wind_spd_kt0=3.00,var_wind_spd_kt1=8.00,var_wind_spd_kt2=15.00,var_wind_spd_kt3=-1.00,var_wind_spd_kt4=-1.00,var_wind_spd_kt5=-1.00,var_wind_spd_kt6=-1.00,var_wind_spd_kt7=-1.00,var_wind_spd_kt8=-1.00,var_wind_spd_kt9=-1.00,var_wind_spd_kt10=-1.00,var_wind_spd_kt11=-1.00,var_wind_spd_kt12=-1.00,var_wind_dir_true0=270.00,var_wind_dir_true1=280.00,var_wind_dir_true2=290.00,var_wind_dir_true3=0.00,var_wind_dir_true4=0.00,var_wind_dir_true5=0.00,var_wind_dir_true6=0.00,var_wind_dir_true7=0.00,var_wind_dir_true8=0.00,var_wind_dir_true9=0.00,var_wind_dir_true10=0.00,var_wind_dir_true11=0.00,var_wind_dir_true12=0.00,var_wind_inc_kt0=0.00,var_wind_inc_kt1=0.00,var_wind_inc_kt2=0.00,var_wind_inc_kt3=0.00,var_wind_inc_kt4=0.00,var_wind_inc_kt5=0.00,var_wind_inc_kt6=0.00,var_wind_inc_kt7=0.00,var_wind_inc_kt8=0.00,var_wind_inc_kt9=0.00,var_wind_inc_kt10=0.00,var_wind_inc_kt11=0.00,var_wind_inc_kt12=0.00,var_wind_shr_deg0=0.00,var_wind_shr_deg1=0.00,var_wind_shr_deg2=0.00,var_wind_shr_deg3=0.00,var_wind_shr_deg4=0.00,var_wind_shr_deg5=0.00,var_wind_shr_deg6=0.00,var_wind_shr_deg7=0.00,var_wind_shr_deg8=0.00,var_wind_shr_deg9=0.00,var_wind_shr_deg10=0.00,var_wind_shr_deg11=0.00,var_wind_shr_deg12=0.00,var_CAT_rat0=0.00,var_CAT_rat1=0.00,var_CAT_rat2=0.00,var_CAT_rat3=0.00,var_CAT_rat4=0.00,var_CAT_rat5=0.00,var_CAT_rat6=0.00,var_CAT_rat7=0.00,var_CAT_rat8=0.00,var_CAT_rat9=0.00,var_CAT_rat10=0.00,var_CAT_rat11=0.00,var_CAT_rat12=0.00,var_therm_vvi_fpm=0.00,var_wave_height_ft=1.00,var_wave_dir_deg=270.00,var_ter_eff_UI=1',
  },
];

export const DEFAULT_WEATHER_DEFINITION =
  ',var_rand_space_pct=0.00,var_deft_change_enum=3,var_rwx_is_sim_time=1,var_vis_sm=30.00,var_vis_alt_lo_ft=5000.00,var_vis_alt_hi_ft=15000.00,var_ISA_offset_C=0.00,var_SLP_pas=101325.00,var_QNH_ele=13.00,var_precip_rat=0.00,var_cld_typ_enum0=2,var_cld_cov0=0.25,var_tops_msl_ft0=8000.00,var_bases_msl_ft0=5000.00,var_cld_typ_enum1=0,var_cld_cov1=0.00,var_tops_msl_ft1=20000.00,var_bases_msl_ft1=18000.00,var_cld_typ_enum2=0,var_cld_cov2=0.00,var_tops_msl_ft2=30000.00,var_bases_msl_ft2=28000.00,var_wind_alt_msl_ft0=3000.00,var_wind_alt_msl_ft1=10000.00,var_wind_alt_msl_ft2=25000.00,var_wind_alt_msl_ft3=35000.00,var_wind_alt_msl_ft4=40000.00,var_wind_alt_msl_ft5=45000.00,var_wind_alt_msl_ft6=50000.00,var_wind_alt_msl_ft7=55000.00,var_wind_alt_msl_ft8=60000.00,var_wind_alt_msl_ft9=65000.00,var_wind_alt_msl_ft10=70000.00,var_wind_alt_msl_ft11=75000.00,var_wind_alt_msl_ft12=80000.00,var_wind_spd_kt0=8.00,var_wind_spd_kt1=15.00,var_wind_spd_kt2=30.00,var_wind_spd_kt3=-1.00,var_wind_spd_kt4=-1.00,var_wind_spd_kt5=-1.00,var_wind_spd_kt6=-1.00,var_wind_spd_kt7=-1.00,var_wind_spd_kt8=-1.00,var_wind_spd_kt9=-1.00,var_wind_spd_kt10=-1.00,var_wind_spd_kt11=-1.00,var_wind_spd_kt12=-1.00,var_wind_dir_true0=270.00,var_wind_dir_true1=280.00,var_wind_dir_true2=290.00,var_wind_dir_true3=0.00,var_wind_dir_true4=0.00,var_wind_dir_true5=0.00,var_wind_dir_true6=0.00,var_wind_dir_true7=0.00,var_wind_dir_true8=0.00,var_wind_dir_true9=0.00,var_wind_dir_true10=0.00,var_wind_dir_true11=0.00,var_wind_dir_true12=0.00,var_wind_inc_kt0=0.00,var_wind_inc_kt1=0.00,var_wind_inc_kt2=0.00,var_wind_inc_kt3=0.00,var_wind_inc_kt4=0.00,var_wind_inc_kt5=0.00,var_wind_inc_kt6=0.00,var_wind_inc_kt7=0.00,var_wind_inc_kt8=0.00,var_wind_inc_kt9=0.00,var_wind_inc_kt10=0.00,var_wind_inc_kt11=0.00,var_wind_inc_kt12=0.00,var_wind_shr_deg0=0.00,var_wind_shr_deg1=0.00,var_wind_shr_deg2=0.00,var_wind_shr_deg3=0.00,var_wind_shr_deg4=0.00,var_wind_shr_deg5=0.00,var_wind_shr_deg6=0.00,var_wind_shr_deg7=0.00,var_wind_shr_deg8=0.00,var_wind_shr_deg9=0.00,var_wind_shr_deg10=0.00,var_wind_shr_deg11=0.00,var_wind_shr_deg12=0.00,var_CAT_rat0=0.00,var_CAT_rat1=0.00,var_CAT_rat2=0.00,var_CAT_rat3=0.00,var_CAT_rat4=0.00,var_CAT_rat5=0.00,var_CAT_rat6=0.00,var_CAT_rat7=0.00,var_CAT_rat8=0.00,var_CAT_rat9=0.00,var_CAT_rat10=0.00,var_CAT_rat11=0.00,var_CAT_rat12=0.00,var_therm_vvi_fpm=0.00,var_wave_height_ft=2.00,var_wave_dir_deg=270.00,var_ter_eff_UI=3';
