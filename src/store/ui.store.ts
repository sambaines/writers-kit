import { create } from 'zustand';
import type { ViewMode, EditorView } from '../types';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';
export type RightPanel = 'properties' | 'chat';

interface UIState {
  /* Navigation */
  activeView: ViewMode;
  activeTypeId: string | null;
  activeEntityId: string | null;

  /* Panel visibility */
  propertiesPanelOpen: boolean;
  activeRightPanel: RightPanel;
  askDrawerOpen: boolean;
  commandPaletteOpen: boolean;

  /* Editor state */
  editorView: EditorView;
  saveStatus: SaveStatus;

  /* Timeline */
  timelineScrollTarget: string | null;

  /* Actions */
  setActiveView: (view: ViewMode) => void;
  setActiveTypeId: (id: string | null) => void;
  setActiveEntityId: (id: string | null) => void;
  togglePropertiesPanel: () => void;
  setPropertiesPanelOpen: (open: boolean) => void;
  setActiveRightPanel: (panel: RightPanel) => void;
  setAskDrawerOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setEditorView: (view: EditorView) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setTimelineScrollTarget: (entityId: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'editor',
  activeTypeId: null,
  activeEntityId: null,
  propertiesPanelOpen: true,
  activeRightPanel: 'properties',
  askDrawerOpen: false,
  commandPaletteOpen: false,
  editorView: 'rich',
  saveStatus: 'idle',
  timelineScrollTarget: null,

  setActiveView: (view) => set({ activeView: view }),
  setActiveTypeId: (id) => set({ activeTypeId: id, activeEntityId: null }),
  setActiveEntityId: (id) => set({ activeEntityId: id }),
  togglePropertiesPanel: () =>
    set((state) => ({ propertiesPanelOpen: !state.propertiesPanelOpen })),
  setPropertiesPanelOpen: (open) => set({ propertiesPanelOpen: open }),
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel, propertiesPanelOpen: true }),
  setAskDrawerOpen: (open) => set({ askDrawerOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setEditorView: (view) => set({ editorView: view }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setTimelineScrollTarget: (entityId) => set({ timelineScrollTarget: entityId }),
}));
