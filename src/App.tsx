import { useEffect, useState } from 'react';
import type { ElementType } from 'react';
import AppShell from './components/layout/AppShell';
import VaultOpener from './components/vault/VaultOpener';
import { useVaultStore, rehydrateVault } from './store/vault.store';

export default function App() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const isIndexing = useVaultStore((s) => s.isIndexing);

  // Lazy-load Agentation only in dev — dynamic import so it never blocks the WebView
  const [Agentation, setAgentation] = useState<ElementType | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV) {
      import('agentation')
        .then((m) => setAgentation(() => m.Agentation))
        .catch(() => {});
    }
  }, []);

  // On mount, reopen the last-used vault from localStorage
  useEffect(() => {
    rehydrateVault();
  }, []);

  if (!vaultPath && !isIndexing) return <VaultOpener />;

  return (
    <>
      <AppShell />
      {Agentation && <Agentation />}
    </>
  );
}
