import { create } from 'zustand';
import type { ViewMode, EditorView } from '../types';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface UIState {
  /* Navigation */
  activeView: ViewMode;
  activeTypeId: string | null;
  activeEntityId: string | null;

  /* Panel visibility */
  propertiesPanelOpen: boolean;

  /* Editor state */
  editorView: EditorView;
  saveStatus: SaveStatus;

  /* Actions */
  setActiveView: (view: ViewMode) => void;
  setActiveTypeId: (id: string | null) => void;
  setActiveEntityId: (id: string | null) => void;
  togglePropertiesPanel: () => void;
  setPropertiesPanelOpen: (open: boolean) => void;
  setEditorView: (view: EditorView) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'editor',
  activeTypeId: null,
  activeEntityId: null,
  propertiesPanelOpen: true,
  editorView: 'rich',
  saveStatus: 'idle',

  setActiveView: (view) => set({ activeView: view }),
  setActiveTypeId: (id) => set({ activeTypeId: id, activeEntityId: null }),
  setActiveEntityId: (id) => set({ activeEntityId: id }),
  togglePropertiesPanel: () =>
    set((state) => ({ propertiesPanelOpen: !state.propertiesPanelOpen })),
  setPropertiesPanelOpen: (open) => set({ propertiesPanelOpen: open }),
  setEditorView: (view) => set({ editorView: view }),
  setSaveStatus: (status) => set({ saveStatus: status }),
}));
