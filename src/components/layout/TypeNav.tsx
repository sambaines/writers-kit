import { useState } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Feather, Files, Archive, Plus, Gear, FolderOpen,
  DotsThree, PencilSimple, Trash, ChartLine,
} from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { pickFolder } from '../../services/fs.service';
import { SignOut } from '@phosphor-icons/react';
import DynamicIcon from '../ui/DynamicIcon';
import NewTypeDialog from '../type-editor/NewTypeDialog';
import EditTypeDialog from '../type-editor/EditTypeDialog';
import DeleteTypeDialog from '../type-editor/DeleteTypeDialog';
import SettingsDialog from '../settings/SettingsDialog';
import type { SchemaDefinition } from '../../types';
import clsx from 'clsx';
import styles from './TypeNav.module.css';

export default function TypeNav() {
  const { activeTypeId, setActiveTypeId, setActiveEntityId, activeView, setActiveView } = useUIStore(
    useShallow((s) => ({
      activeTypeId:      s.activeTypeId,
      setActiveTypeId:   s.setActiveTypeId,
      setActiveEntityId: s.setActiveEntityId,
      activeView:        s.activeView,
      setActiveView:     s.setActiveView,
    })),
  );

  const { schemas, entities } = useVaultData();
  const openVault  = useVaultStore((s) => s.openVault);
  const closeVault = useVaultStore((s) => s.closeVault);

  const [newTypeOpen, setNewTypeOpen]     = useState(false);
  const [editSchema, setEditSchema]       = useState<SchemaDefinition | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<SchemaDefinition | null>(null);
  const [settingsOpen, setSettingsOpen]   = useState(false);

  async function handleChangeVault() {
    const path = await pickFolder();
    if (path) await openVault(path);
  }

  function handleNavClick(id: string | null) {
    setActiveView('editor');
    setActiveTypeId(id);
    setActiveEntityId(null);
  }

  function handleDeleteSchema(schema: SchemaDefinition) {
    if (activeTypeId === schema.id) {
      setActiveTypeId('__all');
      setActiveEntityId(null);
    }
    setDeleteTarget(schema);
  }

  const allCount     = entities.filter((e) => !e.archived).length;
  const archiveCount = entities.filter((e) => e.archived).length;

  return (
    <Tooltip.Provider delayDuration={600}>
      <nav className={styles.nav}>
        {/* Logo */}
        <div className={styles.logo}>
          <Feather size={18} weight="duotone" color="var(--accent)" />
          <span className={styles.logoText}>Writers Kit</span>
        </div>

        <ScrollArea.Root className={styles.scrollRoot}>
          <ScrollArea.Viewport className={styles.scrollViewport}>

            {/* All Notes / Archive */}
            <div className={styles.section}>
              <button
                className={clsx(styles.navItem, activeTypeId === '__all' && styles.active)}
                onClick={() => handleNavClick('__all')}
              >
                <Files size={15} weight={activeTypeId === '__all' ? 'fill' : 'regular'} />
                <span>All Files</span>
                <span className={styles.count}>{allCount}</span>
              </button>
              <button
                className={clsx(styles.navItem, activeTypeId === '__archive' && styles.active)}
                onClick={() => handleNavClick('__archive')}
              >
                <Archive size={15} weight={activeTypeId === '__archive' ? 'fill' : 'regular'} />
                <span>Archive</span>
                {archiveCount > 0 && (
                  <span className={styles.count}>{archiveCount}</span>
                )}
              </button>
              <button
                className={clsx(styles.navItem, activeView === 'timeline' && styles.active)}
                onClick={() => setActiveView(activeView === 'timeline' ? 'editor' : 'timeline')}
              >
                <ChartLine size={15} weight={activeView === 'timeline' ? 'fill' : 'regular'} />
                <span>Timeline</span>
              </button>
            </div>

            <div className={styles.divider} />

            {/* Entity Types */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>Types</div>
              {schemas.length === 0 ? (
                <p className={styles.emptyTypes}>No types yet</p>
              ) : (
                schemas.map((schema) => {
                  const count = entities.filter(
                    (e) => e.type === schema.name && !e.archived,
                  ).length;
                  const isActive = activeTypeId === schema.id;
                  return (
                    <div key={schema.id} className={styles.typeRow}>
                      <button
                        className={clsx(styles.navItem, styles.typeItem, isActive && styles.active)}
                        onClick={() => handleNavClick(schema.id)}
                      >
                        <span
                          className={styles.typeDot}
                          style={{ background: schema.color }}
                        />
                        <DynamicIcon
                          name={schema.icon}
                          size={14}
                          weight={isActive ? 'fill' : 'regular'}
                          color={isActive ? schema.color : undefined}
                        />
                        <span>{schema.name}</span>
                        <span className={styles.count}>{count}</span>
                      </button>

                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            className={styles.typeMenuBtn}
                            aria-label={`${schema.name} options`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DotsThree size={14} weight="bold" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content className={styles.dropMenu} side="right" sideOffset={4}>
                            <DropdownMenu.Item
                              className={styles.dropItem}
                              onSelect={() => setEditSchema(schema)}
                            >
                              <PencilSimple size={13} />
                              <span>Edit type</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className={styles.dropSep} />
                            <DropdownMenu.Item
                              className={`${styles.dropItem} ${styles.dropItemDanger}`}
                              onSelect={() => handleDeleteSchema(schema)}
                            >
                              <Trash size={13} />
                              <span>Delete type</span>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  );
                })
              )}
            </div>

          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
            <ScrollArea.Thumb className={styles.scrollThumb} />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>

        {/* Bottom actions */}
        <div className={styles.bottom}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={styles.navItem} onClick={() => setNewTypeOpen(true)}>
                <Plus size={14} />
                <span>New Type</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} side="right" sideOffset={8}>
                Create a new entity type
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={clsx(styles.navItem, styles.settingsBtn)} onClick={handleChangeVault}>
                <FolderOpen size={14} />
                <span>Change Vault</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} side="right" sideOffset={8}>
                Switch to a different vault folder
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={clsx(styles.navItem, styles.settingsBtn)} onClick={() => setSettingsOpen(true)}>
                <Gear size={14} />
                <span>Settings</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} side="right" sideOffset={8}>
                Open settings
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          {import.meta.env.DEV && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  className={clsx(styles.navItem, styles.devBtn)}
                  onClick={closeVault}
                >
                  <SignOut size={14} />
                  <span>Close Vault</span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} side="right" sideOffset={8}>
                  Dev: return to welcome screen
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
        </div>
      </nav>

      <NewTypeDialog open={newTypeOpen} onClose={() => setNewTypeOpen(false)} />
      <EditTypeDialog schema={editSchema} onClose={() => setEditSchema(null)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DeleteTypeDialog
        schema={deleteTarget}
        orphanCount={deleteTarget ? entities.filter((e) => e.type === deleteTarget.name).length : 0}
        otherSchemas={deleteTarget ? schemas.filter((s) => s.id !== deleteTarget.id) : schemas}
        onClose={() => setDeleteTarget(null)}
      />
    </Tooltip.Provider>
  );
}
