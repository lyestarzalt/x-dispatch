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
