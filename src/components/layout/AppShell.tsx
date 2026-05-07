import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import TypeNav from './TypeNav';
import EntityList from './EntityList';
import EditorPane from '../editor/EditorPane';
import PropertiesPanel from '../properties/PropertiesPanel';
import TimelineView from '../timeline/TimelineView';
import StatusBar from './StatusBar';
import styles from './AppShell.module.css';
import clsx from 'clsx';

export default function AppShell() {
  const { propertiesPanelOpen, activeView } = useUIStore(
    useShallow((s) => ({
      propertiesPanelOpen: s.propertiesPanelOpen,
      activeView:          s.activeView,
    })),
  );

  return (
    <div className={styles.shell}>
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
          <PropertiesPanel />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
