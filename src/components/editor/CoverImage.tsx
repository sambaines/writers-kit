import { useState, useEffect } from 'react';
import { Image, PencilSimple, X } from '@phosphor-icons/react';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { coverToUrl, deleteLocalCover, type CoverData } from '../../services/cover.service';
import type { Entity } from '../../types';
import CoverPicker from './CoverPicker';
import styles from './CoverImage.module.css';

interface Props {
  entity: Entity;
}

export default function CoverImage({ entity }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const { vaultPath } = useVaultData();
  const patchEntityFrontmatter = useVaultStore((s) => s.patchEntityFrontmatter);

  const cover = entity.frontmatter.__cover as CoverData | undefined | null;

  // Load image URL whenever the cover changes (local = async base64, unsplash = direct URL)
  useEffect(() => {
    if (!cover || !vaultPath) { setImgSrc(''); return; }
    let cancelled = false;
    coverToUrl(cover, vaultPath)
      .then((url) => { if (!cancelled) setImgSrc(url); })
      .catch(() => { if (!cancelled) setImgSrc(''); });
    return () => { cancelled = true; };
  }, [cover, vaultPath]);

  async function handleSelect(coverData: CoverData) {
    // If replacing a local cover, clean up the old file
    if (cover?.type === 'local' && vaultPath) {
      void deleteLocalCover(vaultPath, cover.src);
    }
    await patchEntityFrontmatter(entity, { ...entity.frontmatter, __cover: coverData });
    setPickerOpen(false);
  }

  async function handleRemove() {
    if (cover?.type === 'local' && vaultPath) {
      void deleteLocalCover(vaultPath, cover.src);
    }
    // Pass __cover: undefined so it explicitly overrides the key in the merge —
    // patchEntityFrontmatter does { ...entity.frontmatter, ...updates }, so omitting
    // the key is not enough; undefined is skipped by js-yaml when serialising.
    await patchEntityFrontmatter(entity, { __cover: undefined });
  }

  return (
    <>
      {cover ? (
        <div className={styles.coverWrap}>
          {imgSrc && <img className={styles.coverImg} src={imgSrc} alt="Cover" />}
          <div className={styles.coverOverlay}>
            <button className={styles.coverBtn} onClick={() => setPickerOpen(true)}>
              <PencilSimple size={13} />
              <span>Change</span>
            </button>
            <button className={styles.coverBtn} onClick={() => void handleRemove()}>
              <X size={13} />
              <span>Remove</span>
            </button>
          </div>
          {cover.attribution && (
            <div className={styles.attribution}>
              Photo by{' '}
              <a
                href={`https://unsplash.com/@${cover.attribution.username}?utm_source=writers-kit&utm_medium=referral`}
                target="_blank"
                rel="noreferrer"
              >
                {cover.attribution.name}
              </a>
              {' '}on{' '}
              <a href="https://unsplash.com?utm_source=writers-kit&utm_medium=referral" target="_blank" rel="noreferrer">
                Unsplash
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.noCover}>
          <button className={styles.addCoverBtn} onClick={() => setPickerOpen(true)}>
            <Image size={12} />
            <span>Add cover</span>
          </button>
        </div>
      )}

      <CoverPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(coverData) => void handleSelect(coverData)}
      />
    </>
  );
}
