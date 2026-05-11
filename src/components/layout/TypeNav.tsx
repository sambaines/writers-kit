import { useState, useRef } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  Feather, Files, Archive, Plus, Gear, FolderOpen,
  PencilSimple, Trash, ChartLine, DotsSixVertical,
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
  const openVault       = useVaultStore((s) => s.openVault);
  const closeVault      = useVaultStore((s) => s.closeVault);
  const reorderSchemas  = useVaultStore((s) => s.reorderSchemas);

  const [newTypeOpen, setNewTypeOpen]     = useState(false);
  const [editSchema, setEditSchema]       = useState<SchemaDefinition | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<SchemaDefinition | null>(null);
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [draggingId, setDraggingId]       = useState<string | null>(null);
  const [dragOverId, setDragOverId]       = useState<string | null>(null);
  const schemasRef   = useRef(schemas);
  schemasRef.current = schemas;
  const dragStateRef = useRef<{ id: string; overId: string | null } | null>(null);

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

  function startDrag(e: React.MouseEvent, id: string) {
    e.preventDefault(); // prevent text selection while dragging
    setDraggingId(id);
    dragStateRef.current = { id, overId: null };

    function onMouseMove(me: MouseEvent) {
      const state = dragStateRef.current;
      if (!state) return;
      const el  = document.elementFromPoint(me.clientX, me.clientY);
      const row = el?.closest('[data-schema-id]') as HTMLElement | null;
      const hoverId = row?.dataset.schemaId ?? null;
      const newOver = hoverId && hoverId !== state.id ? hoverId : null;
      if (newOver !== state.overId) {
        state.overId = newOver;
        setDragOverId(newOver);
      }
    }

    function onMouseUp() {
      const state = dragStateRef.current;
      if (state?.overId) {
        const order = schemasRef.current.map((s) => s.id);
        const from  = order.indexOf(state.id);
        const to    = order.indexOf(state.overId);
        if (from !== -1 && to !== -1) {
          order.splice(from, 1);
          order.splice(to, 0, state.id);
          reorderSchemas(order);
        }
      }
      setDraggingId(null);
      setDragOverId(null);
      dragStateRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

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
                className={clsx(styles.navItem, activeTypeId === '__all' && activeView !== 'timeline' && styles.active)}
                onClick={() => handleNavClick('__all')}
              >
                <Files size={15} weight={activeTypeId === '__all' && activeView !== 'timeline' ? 'fill' : 'regular'} />
                <span>All Files</span>
                <span className={styles.count}>{allCount}</span>
              </button>
              <button
                className={clsx(styles.navItem, activeTypeId === '__archive' && activeView !== 'timeline' && styles.active)}
                onClick={() => handleNavClick('__archive')}
              >
                <Archive size={15} weight={activeTypeId === '__archive' && activeView !== 'timeline' ? 'fill' : 'regular'} />
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
              <div className={styles.sectionHeader}>
                <span>Types</span>
                <button className={styles.addTypeBtn} onClick={() => setNewTypeOpen(true)} title="New type">
                  <Plus size={13} />
                </button>
              </div>
              {schemas.length === 0 ? (
                <p className={styles.emptyTypes}>No types yet</p>
              ) : (
                schemas.map((schema) => {
                  const count = entities.filter(
                    (e) => e.type === schema.name && !e.archived,
                  ).length;
                  const isActive = activeTypeId === schema.id && activeView !== 'timeline';
                  return (
                    <div
                      key={schema.id}
                      data-schema-id={schema.id}
                      className={clsx(
                        styles.typeRow,
                        draggingId === schema.id && styles.dragging,
                        dragOverId === schema.id && styles.dragOver,
                      )}
                    >
                      <span
                        className={styles.dragHandle}
                        onMouseDown={(e) => startDrag(e, schema.id)}
                      >
                        <DotsSixVertical size={12} />
                      </span>
                      <ContextMenu.Root>
                        <ContextMenu.Trigger asChild>
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
                        </ContextMenu.Trigger>
                        <ContextMenu.Portal>
                          <ContextMenu.Content className={styles.dropMenu}>
                            <ContextMenu.Item
                              className={styles.dropItem}
                              onSelect={() => setEditSchema(schema)}
                            >
                              <PencilSimple size={13} />
                              <span>Edit type</span>
                            </ContextMenu.Item>
                            <ContextMenu.Separator className={styles.dropSep} />
                            <ContextMenu.Item
                              className={`${styles.dropItem} ${styles.dropItemDanger}`}
                              onSelect={() => handleDeleteSchema(schema)}
                            >
                              <Trash size={13} />
                              <span>Delete type</span>
                            </ContextMenu.Item>
                          </ContextMenu.Content>
                        </ContextMenu.Portal>
                      </ContextMenu.Root>
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
