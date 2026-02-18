/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

/** Represents a dataref in the simulator. The `id` is stable within an X-Plane session but may change between sessions. */
export interface Dataref {
  /**
   * Numeric identifier of the dataref for the current simulator session
   * @format int64
   * @example 40003472032
   */
  id?: number;
  /**
   * Fully qualified name of the dataref
   * @example "sim/time/zulu_time_sec"
   */
  name?: string;
  /**
   * The data type of the dataref value
   * @example "float"
   */
  value_type?: 'float' | 'double' | 'int' | 'int_array' | 'float_array' | 'data';
  /**
   * Whether this dataref can be written to
   * @example false
   */
  is_writable?: boolean;
}

/** Represents a command in the simulator. The `id` is stable within an X-Plane session but may change between sessions. */
export interface Command {
  /**
   * Numeric identifier of the command for the current simulator session
   * @example 818
   */
  id?: number;
  /**
   * Fully qualified name of the command
   * @example "sim/lights/landing_lights_toggle"
   */
  name?: string;
  /**
   * Human-readable description of what the command does
   * @example "Landing lights toggle."
   */
  description?: string;
}

/** API version and X-Plane version information */
export interface ApiCapabilities {
  api?: {
    /**
     * List of supported API versions
     * @example ["v1","v2","v3"]
     */
    versions?: string[];
  };
  'x-plane'?: {
    /**
     * Running X-Plane version
     * @example "12.4.0"
     */
    version?: string;
  };
}

/** Error response returned when a request fails */
export interface ErrorResponse {
  /** Machine-readable error code */
  error_code?: string;
  /** Human-readable error message */
  error_message?: string;
}

/** Success response returned by flight endpoints. Unlike other endpoints (which return `null`), flight endpoints return `{"error_code": "success"}`. */
export interface FlightSuccessResponse {
  /** Always "success" for successful flight operations */
  error_code?: 'success';
}

/** Flight initialization structure. Requires `aircraft` and exactly one start location key. See the [Flight Initialization API docs](https://developer.x-plane.com/article/flight-initialization-api/) for full details. */
export interface FlightInit {
  /** Aircraft specification (required for new flights) */
  aircraft?: {
    /**
     * Path to .acf file relative to X-Plane root directory
     * @example "Aircraft/Laminar Research/Cessna 172SP/Cessna_172SP.acf"
     */
    path: string;
    /** Name of livery subdirectory in the aircraft's liveries folder */
    livery?: string;
  };
  /** Start on a runway. Cannot combine `final_distance_in_nautical_miles` with `tow_type`. */
  runway_start?: {
    /** Valid X-Plane airport ID */
    airport_id: string;
    /** Runway ID at the specified airport */
    runway: string;
    /** If present, starts on final approach at this distance. Otherwise starts at runway threshold. */
    final_distance_in_nautical_miles?: number;
    /**
     * Tow type for glider launch
     * @default "none"
     */
    tow_type?: 'tug' | 'winch' | 'none';
    /** Aircraft specification for tow plane. Required if tow_type is 'tug'. */
    tow_aircraft?: {
      path?: string;
    };
  };
  /** Start at an airport ramp/gate */
  ramp_start?: {
    /**
     * Valid X-Plane airport ID
     * @example "KPDX"
     */
    airport_id: string;
    /**
     * Name of the ramp start location
     * @example "A1"
     */
    ramp: string;
  };
  /** Start on the ground at a lat/lon/heading */
  lle_ground_start?: {
    /** Latitude in degrees (-90 to 90) */
    latitude: number;
    /** Longitude in degrees (-180 to 180) */
    longitude: number;
    /** True heading in degrees (0 to 360) */
    heading_true: number;
  };
  /** Start in the air at a lat/lon/elevation. Must provide either `speed_in_meters_per_second` or `speed_enum`. */
  lle_air_start?: {
    /** Latitude in degrees (-90 to 90) */
    latitude: number;
    /** Longitude in degrees (-180 to 180) */
    longitude: number;
    /** Elevation MSL in meters */
    elevation_in_meters: number;
    /** True heading in degrees (0 to 360) */
    heading_true: number;
    /** Speed in m/s (provide this OR speed_enum) */
    speed_in_meters_per_second?: number;
    /** Speed preset (provide this OR speed_in_meters_per_second) */
    speed_enum?: 'short_field_approach' | 'normal_approach' | 'cruise';
    /** Aircraft pitch (default: 0) */
    pitch_in_degrees?: number;
  };
  /** Start on a carrier or frigate. Cannot combine `start_position` with `final_distance_in_nautical_miles`. */
  boat_start?: {
    boat_name: 'carrier' | 'frigate';
    /** Deck position. Required for carrier deck starts. Not allowed with final_distance_in_nautical_miles. */
    start_position?: 'catapult_1' | 'catapult_2' | 'catapult_3' | 'catapult_4' | 'deck';
    /** Relocate the boat to this position */
    boat_location?: {
      latitude?: number;
      longitude?: number;
    };
    /** Start on final approach at this distance */
    final_distance_in_nautical_miles?: number;
  };
  /** Weight and balance configuration */
  weight?: {
    /** Up to 9 payload station weights */
    payload_weight_in_kilograms?: number[];
    /** 1-9 fuel tank weights in kilograms */
    fueltank_weight_in_kilograms?: number[];
    jato_weight_in_kilograms?: number;
    slung_load?: {
      path_to_obj?: string;
      weight_in_kilograms?: number;
    };
    jettisonable_weight_in_kilograms?: number;
    shiftable_weight_in_kilograms?: number;
    deice_holdover_time_in_minutes?: number;
    oxygen_pressure_in_millibars?: number;
    deice_fluid_in_liters?: number;
    external_fueltank_weight_in_kilograms?: number[];
  };
  /** Engine configuration */
  engine_status?: {
    all_engines?: {
      /** Whether all engines should be running */
      running: boolean;
    };
  };
  /** Weapon loadout specifications */
  weapons?: {
    /** Hardpoint index from Plane Maker */
    index: number;
    /** Name of .wpn file */
    filename: string;
  }[];
  /** System failure configuration */
  failures?: {
    /** Fix all systems before applying new failures (default: true) */
    fix_everything?: boolean;
    /** MTBF for random failures (0 = disabled) */
    mean_time_between_failures_in_hours?: number;
    operation_failures?: {
      /** Failure system name */
      name: string;
      status:
        | 'always_work'
        | 'fail_mean_time_in_hours'
        | 'fail_exact_time_in_hours'
        | 'fail_at_speed_in_knots'
        | 'fail_at_altitude_in_feet'
        | 'fail_at_command_trigger'
        | 'inoperative';
      /** Required for time/speed/altitude failure types */
      value?: number;
    }[];
  };
  /** AI aircraft specifications */
  ai_aircraft?: {
    aircraft: {
      path?: string;
    };
    mission:
      | 'atc'
      | 'combat_team_red'
      | 'combat_team_blue'
      | 'combat_team_green'
      | 'combat_team_gold';
  }[];
  /** AI aircraft for formation flying */
  formation_aircraft?: {
    /** Path to .acf file */
    path?: string;
  };
  /** Runway incursion configuration */
  incursion?: {
    aircraft?: {
      path?: string;
    };
    type?:
      | 'flight_incursion'
      | 'runway_incursion_arm'
      | 'runway_incursion_execute'
      | 'clear_incursion';
  };
  /** Use system time. Mutually exclusive with local_time, gmt_time, and time_enum. */
  use_system_time?: boolean;
  /** Set local time. Mutually exclusive with use_system_time, gmt_time, and time_enum. */
  local_time?: {
    /** Day of year (0 = January 1) */
    day_of_year: number;
    /** Time of day in hours (e.g. 13.5 = 1:30 PM) */
    time_in_24_hours: number;
  };
  /** Set GMT time. Mutually exclusive with use_system_time, local_time, and time_enum. */
  gmt_time?: {
    /** Day of year (0 = January 1) */
    day_of_year: number;
    /** Time of day in hours (e.g. 13.5 = 1:30 PM) */
    time_in_24_hours: number;
  };
  /** Time preset. Mutually exclusive with use_system_time, local_time, and gmt_time. */
  time_enum?: 'day' | 'sunset' | 'evening' | 'night';
  /** Weather configuration. Either the string `"use_real_weather"` or a weather definition object. */
  weather?:
    | 'use_real_weather'
    | {
        /** Weather preset name or custom weather definition object */
        definition:
          | 'vfr_few_clouds'
          | 'vfr_scattered'
          | 'vfr_broken'
          | 'marginal_vfr_overcast'
          | 'ifr_non_precision'
          | 'ifr_precision'
          | 'convective'
          | 'large_cell_thunderstorm'
          | {
              latitude_in_degrees: number;
              longitude_in_degrees: number;
              elevation_in_meters: number;
              visibility_in_kilometers: number;
              temperature_in_degrees_celsius?: number;
              altimeter_setting_in_hpa?: number;
              /**
               * @min 0
               * @max 1
               */
              precipitation_ratio?: number;
              /** @maxItems 3 */
              clouds?: {
                type: 'cirrus' | 'stratus' | 'cumulus' | 'cumulunimbus';
                /**
                 * @min 0
                 * @max 1
                 */
                cover_ratio: number;
                bases_in_feet_msl: number;
                tops_in_feet_msl: number;
              }[];
              /** @maxItems 13 */
              wind?: {
                altitude_in_feet_msl: number;
                speed_in_knots: number;
                direction_in_degrees_true: number;
                gust_increase_in_knots?: number;
                shear_in_degrees?: number;
                /**
                 * @min 0
                 * @max 1
                 */
                turbulence_ratio?: number;
              }[];
            };
        vertical_speed_in_thermal_in_feet_per_minute: number;
        wave_height_in_meters: number;
        /** True heading */
        wave_direction_in_degrees: number;
        terrain_state:
          | 'dry'
          | 'lightly_wet'
          | 'medium_wet'
          | 'very_wet'
          | 'lightly_puddly'
          | 'medium_puddly'
          | 'very_puddly'
          | 'lightly_snowy'
          | 'medium_snowy'
          | 'very_snowy'
          | 'lightly_icy'
          | 'medium_icy'
          | 'very_icy'
          | 'lightly_snowy_and_icy'
          | 'medium_snowy_and_icy'
          | 'very_snowy_and_icy';
        variation_across_region_percentage: number;
        evolution_over_time_enum:
          | 'rapidly_improving'
          | 'improving'
          | 'gradually_improving'
          | 'static'
          | 'gradually_deteriorating'
          | 'deteriorating'
          | 'rapidly_deteriorating';
      };
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, 'body' | 'bodyUsed'>;

export interface FullRequestParams extends Omit<RequestInit, 'body'> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<FullRequestParams, 'body' | 'method' | 'query' | 'path'>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, 'baseUrl' | 'cancelToken' | 'signal'>;
  securityWorker?: (
    securityData: SecurityDataType | null
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown> extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = 'application/json',
  JsonApi = 'application/vnd.api+json',
  FormData = 'multipart/form-data',
  UrlEncoded = 'application/x-www-form-urlencoded',
  Text = 'text/plain',
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = 'http://localhost:8086/api/v3';
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>['securityWorker'];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) => fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: 'same-origin',
    headers: {},
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === 'number' ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join('&');
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter((key) => 'undefined' !== typeof query[key]);
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key)
      )
      .join('&');
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : '';
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === 'object' || typeof input === 'string')
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === 'object' || typeof input === 'string')
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== 'string' ? JSON.stringify(input) : input,
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === 'object' && property !== null
              ? JSON.stringify(property)
              : `${property}`
        );
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(params1: RequestParams, params2?: RequestParams): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (cancelToken: CancelToken): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === 'boolean' ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ''}${path}${queryString ? `?${queryString}` : ''}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData ? { 'Content-Type': type } : {}),
        },
        signal: (cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal) || null,
        body: typeof body === 'undefined' || body === null ? null : payloadFormatter(body),
      }
    ).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat
        ? r
        : await responseToParse[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title X-Plane Local Web API
 * @version 3.0.0
 * @baseUrl http://localhost:8086/api/v3
 * @contact X-Plane Developer (https://developer.x-plane.com)
 *
 * Starting with version 12.1.1, X-Plane includes a built-in web server that provides a REST and WebSocket API for communicating with a running simulator instance.
 *
 * This spec covers the **REST API** endpoints. For WebSocket message types, see the companion AsyncAPI spec.
 *
 * The web server listens on `localhost:8086` by default. You can change the port with `--web_server_port=XXXX` when launching X-Plane. To disable the API entirely, set the network security policy to "Disable Incoming Traffic" in Settings > Network.
 *
 * **Note:** The `/api/capabilities` endpoint is unversioned (not under `/api/v3/`). All other endpoints are versioned under `/api/v3/`.
 *
 * The web server is built on [Drogon](https://github.com/drogonframework/drogon) (C++). Requests to invalid paths return a default Drogon HTML 404 page, not JSON.
 *
 * For more information, see the [official documentation](https://developer.x-plane.com/article/x-plane-web-api/).
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  capabilities = {
    /**
     * @description Returns the supported API versions and the running X-Plane version. **Note:** This endpoint is unversioned. Use the `/api/capabilities` server, not `/api/v3/capabilities`.
     *
     * @tags Capabilities
     * @name GetCapabilities
     * @summary Get API capabilities
     * @request GET:/capabilities
     */
    getCapabilities: (params: RequestParams = {}) =>
      this.request<ApiCapabilities, any>({
        path: `/capabilities`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  datarefs = {
    /**
     * @description Returns all registered datarefs in X-Plane at the moment of the request (both built-in and created by third parties). Supports filtering, pagination, and field selection.
     *
     * @tags Datarefs
     * @name ListDatarefs
     * @summary List datarefs
     * @request GET:/datarefs
     */
    listDatarefs: (
      query?: {
        /**
         * Filter by exact dataref name. Repeatable — multiple values are joined with OR logic.
         * @example "sim/time/zulu_time_sec"
         */
        'filter[name]'?: string;
        /**
         * Index from where to start (inclusive, for pagination).
         * @min 0
         */
        start?: number;
        /**
         * Maximum number of results to return (for pagination).
         * @min 1
         */
        limit?: number;
        /**
         * Comma-separated list of fields to return per record. Available fields: `id`, `name`, `value_type`. Use `all` (default) to return all fields. Note: `is_writable` is always included automatically when present but cannot be used as a field selector.
         * @default "all"
         * @example "id,name,value_type"
         */
        fields?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          data?: Dataref[];
        },
        ErrorResponse
      >({
        path: `/datarefs`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Returns the number of registered datarefs in X-Plane at the moment (both built-in and created by third parties).
     *
     * @tags Datarefs
     * @name GetDatarefCount
     * @summary Get dataref count
     * @request GET:/datarefs/count
     */
    getDatarefCount: (params: RequestParams = {}) =>
      this.request<
        {
          /** Total number of registered datarefs */
          data?: number;
        },
        any
      >({
        path: `/datarefs/count`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Returns the current value of a dataref. For array datarefs, returns the full array or a single element if `index` is specified. **Note:** The official documentation shows a copy-pasted error table from List datarefs for this endpoint (with `start_out_of_range`, `limit_out_of_range`, etc.). The actual error codes for this endpoint are `index_out_of_range`, `not_an_array`, and `invalid_dataref_id`.
     *
     * @tags Datarefs
     * @name GetDatarefValue
     * @summary Get dataref value
     * @request GET:/datarefs/{id}/value
     */
    getDatarefValue: (
      id: number,
      query?: {
        /**
         * Index to get on array datarefs.
         * @min 0
         */
        index?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** The dataref value. Type depends on the dataref: number, array of numbers, or base64 string. */
          data?: number | number[] | string;
        },
        ErrorResponse
      >({
        path: `/datarefs/${id}/value`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Set a dataref value. For array datarefs, you can set a specific index or the whole array at once (all values must be provided).
     *
     * @tags Datarefs
     * @name SetDatarefValue
     * @summary Set dataref value
     * @request PATCH:/datarefs/{id}/value
     */
    setDatarefValue: (
      id: number,
      data: {
        /** The value to set. A single number, an array of numbers, or a base64 encoded string. */
        data: number | number[] | string;
      },
      query?: {
        /**
         * Index to set on array datarefs.
         * @min 0
         */
        index?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, ErrorResponse>({
        path: `/datarefs/${id}/value`,
        method: 'PATCH',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  commands = {
    /**
     * @description Returns all registered commands in X-Plane at the moment (built-in and third party). Supports filtering, pagination, and field selection. Introduced in API v2 (X-Plane 12.1.4+).
     *
     * @tags Commands
     * @name ListCommands
     * @summary List commands
     * @request GET:/commands
     */
    listCommands: (
      query?: {
        /**
         * Filter by exact command name. Repeatable — multiple values are joined with OR logic.
         * @example "sim/operation/pause"
         */
        'filter[name]'?: string;
        /**
         * Index from where to start (inclusive, for pagination).
         * @min 0
         */
        start?: number;
        /**
         * Maximum number of results to return (for pagination).
         * @min 1
         */
        limit?: number;
        /**
         * Comma-separated list of fields to return per record. Available fields: `id`, `name`, `description`. Use `all` (default) to return all fields.
         * @default "all"
         * @example "id,name"
         */
        fields?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          data?: Command[];
        },
        ErrorResponse
      >({
        path: `/commands`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Returns the number of registered commands in X-Plane at the moment (built-in and third party). Introduced in API v2 (X-Plane 12.1.4+).
     *
     * @tags Commands
     * @name GetCommandCount
     * @summary Get command count
     * @request GET:/commands/count
     */
    getCommandCount: (params: RequestParams = {}) =>
      this.request<
        {
          /** Total number of registered commands */
          data?: number;
        },
        any
      >({
        path: `/commands/count`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  command = {
    /**
     * @description Runs a command for a fixed duration. A zero duration triggers the command on and off immediately (like a button press). Maximum duration is 10 seconds. This endpoint is intended for fire-and-forget commands (e.g., `sim/operation/pause`). For hardware integration or command up/down sequences, use the WebSocket interface instead. Introduced in API v2 (X-Plane 12.1.4+).
     *
     * @tags Commands
     * @name ActivateCommand
     * @summary Activate a command
     * @request POST:/command/{id}/activate
     */
    activateCommand: (
      id: number,
      data: {
        /**
         * Time in seconds after which the command will be deactivated. Use 0 for an immediate press-and-release.
         * @format float
         * @min 0
         * @max 10
         */
        duration: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, ErrorResponse>({
        path: `/command/${id}/activate`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  flight = {
    /**
     * @description Starts a new flight with the specified configuration. Introduced in API v3 (X-Plane 12.4.0+). Requires: `aircraft` and exactly one start location key (`runway_start`, `ramp_start`, `lle_ground_start`, `lle_air_start`, or `boat_start`). All other keys are optional. See the [Flight Initialization API documentation](https://developer.x-plane.com/article/flight-initialization-api/) for full details.
     *
     * @tags Flight
     * @name StartFlight
     * @summary Start a flight
     * @request POST:/flight
     */
    startFlight: (
      data: {
        /** Flight initialization structure. Requires `aircraft` and exactly one start location key. See the [Flight Initialization API docs](https://developer.x-plane.com/article/flight-initialization-api/) for full details. */
        data: FlightInit;
      },
      params: RequestParams = {}
    ) =>
      this.request<FlightSuccessResponse, ErrorResponse>({
        path: `/flight`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Updates the current flight configuration. You cannot change the start location or aircraft during an update — these require starting a new flight. All keys are optional; omitted keys leave corresponding parameters unchanged. Introduced in API v3 (X-Plane 12.4.0+). See the [Flight Initialization API documentation](https://developer.x-plane.com/article/flight-initialization-api/) for full details.
     *
     * @tags Flight
     * @name UpdateFlight
     * @summary Update flight
     * @request PATCH:/flight
     */
    updateFlight: (
      data: {
        /** Partial flight configuration update. All keys are optional. Cannot include start location or aircraft keys. */
        data: object;
      },
      params: RequestParams = {}
    ) =>
      this.request<FlightSuccessResponse, ErrorResponse>({
        path: `/flight`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
}
