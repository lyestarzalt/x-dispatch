// Asset module declarations
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

export interface IVersionsAPI {
  node: () => string;
  chrome: () => string;
  electron: () => string;
}

export interface IElectronAPI {
  setTitle: (title: string) => void;
  openFile: () => Promise<string>;
  onUpdateCounter: (callback: (value: number) => void) => void;
}

declare global {
  interface Window {
    versions: IVersionsAPI;
    electronAPI: IElectronAPI;
  }
}
