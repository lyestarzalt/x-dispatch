import { useEffect, useState } from 'react';

export function useAppVersion() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    window.appAPI.getVersion().then(setVersion);
  }, []);

  return version;
}
