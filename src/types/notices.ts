/** One third-party component shipped with the app, with its licence text. */
export interface ThirdPartyNotice {
  name: string;
  version: string | null;
  license: string;
  repository: string | null;
  text: string;
  /** Not an npm package: binaries, data or assets added by hand to the generator. */
  manual?: boolean;
}

export interface ThirdPartyNotices {
  entries: ThirdPartyNotice[];
}
