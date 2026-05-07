import { useEffect } from 'react';
import AppShell from './components/layout/AppShell';
import VaultOpener from './components/vault/VaultOpener';
import { useVaultStore, rehydrateVault } from './store/vault.store';

export default function App() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const isIndexing = useVaultStore((s) => s.isIndexing);

  // On mount, reopen the last-used vault from localStorage
  useEffect(() => {
    rehydrateVault();
  }, []);

  if (!vaultPath && !isIndexing) return <VaultOpener />;

  return <AppShell />;
}
