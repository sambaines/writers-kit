import { useUIStore } from '../../store/ui.store';
import TypeNav from './TypeNav';
import EntityList from './EntityList';
import EditorPane from '../editor/EditorPane';
import PropertiesPanel from '../properties/PropertiesPanel';
import StatusBar from './StatusBar';
import styles from './AppShell.module.css';
import clsx from 'clsx';

export default function AppShell() {
  const propertiesPanelOpen = useUIStore((s) => s.propertiesPanelOpen);

  return (
    <div className={styles.shell}>
      <div className={styles.main}>
        <TypeNav />
        <EntityList />
        <EditorPane />
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
