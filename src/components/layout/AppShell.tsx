import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import TypeNav from './TypeNav';
import EntityList from './EntityList';
import EditorPane from '../editor/EditorPane';
import PropertiesPanel from '../properties/PropertiesPanel';
import ChatPanel from '../chat/ChatPanel';
import TimelineView from '../timeline/TimelineView';
import StatusBar from './StatusBar';
import CommitDrawer from '../git/CommitDrawer';
import AskDrawer from '../chat/AskDrawer';
import UpdateBanner from './UpdateBanner';
import styles from './AppShell.module.css';
import clsx from 'clsx';

export default function AppShell() {
  const { propertiesPanelOpen, activeView, activeRightPanel } = useUIStore(
    useShallow((s) => ({
      propertiesPanelOpen: s.propertiesPanelOpen,
      activeView:          s.activeView,
      activeRightPanel:    s.activeRightPanel,
    })),
  );

  return (
    <div className={styles.shell}>
      <UpdateBanner />
      <div className={styles.main}>
        <TypeNav />
        {activeView === 'timeline' ? (
          <TimelineView />
        ) : (
          <>
            <EntityList />
            <EditorPane />
          </>
        )}
        <div
          className={clsx(styles.propsWrapper, !propertiesPanelOpen && styles.propsClosed)}
          aria-hidden={!propertiesPanelOpen}
        >
          {activeRightPanel === 'chat' ? <ChatPanel /> : <PropertiesPanel />}
        </div>
      </div>
      <CommitDrawer />
      <AskDrawer />
      <StatusBar />
    </div>
  );
}
