import { useEffect, useState, useCallback, useRef } from 'react';
import { useInputMode } from '@/hooks/useInputMode';

export interface UseHomeFeedNavOptions {
  heroSeriesId?: string | null;
  rows?: {
    items: { id: string }[];
  }[];
  onSelectSeries?: (seriesId: string) => void;
  isSpatialMode?: boolean;
}

export interface UseHomeFeedNavReturn {
  focusedRow: number;
  focusedItem: number;
  setFocus: (row: number, item: number) => void;
}

export function useHomeFeedNav(options: UseHomeFeedNavOptions = {}): UseHomeFeedNavReturn {
  const { heroSeriesId, rows = [], onSelectSeries, isSpatialMode: overrideSpatial } = options;
  const { isSpatialMode: hookSpatial } = useInputMode();
  const isSpatialMode = overrideSpatial ?? hookSpatial;

  const [focusedRow, setFocusedRow] = useState(0);
  const [focusedItem, setFocusedItem] = useState(0);

  const setFocus = useCallback((row: number, item: number) => {
    setFocusedRow(row);
    setFocusedItem(item);
  }, []);

  const optionsRef = useRef({ heroSeriesId, rows, onSelectSeries });
  optionsRef.current = { heroSeriesId, rows, onSelectSeries };

  const focusedRowRef = useRef(focusedRow);
  focusedRowRef.current = focusedRow;
  const focusedItemRef = useRef(focusedItem);
  focusedItemRef.current = focusedItem;

  useEffect(() => {
    if (!isSpatialMode) return;

    const getItemCount = (r: number) => {
      if (r === 0) return 1;
      const rowData = optionsRef.current.rows[r - 1];
      return rowData?.items?.length ?? 0;
    };

    const getMaxRow = () => {
      return optionsRef.current.rows.length;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      const curRow = focusedRowRef.current;
      const curItem = focusedItemRef.current;
      const maxRow = getMaxRow();

      if (key === 'ArrowUp') {
        event.preventDefault();
        const nextRow = Math.max(0, curRow - 1);
        if (nextRow !== curRow) {
          const count = getItemCount(nextRow);
          const nextItem = nextRow === 0 ? 0 : Math.min(curItem, Math.max(0, count - 1));
          setFocusedRow(nextRow);
          setFocusedItem(nextItem);
        }
      } else if (key === 'ArrowDown') {
        event.preventDefault();
        const nextRow = Math.min(maxRow, curRow + 1);
        if (nextRow !== curRow) {
          const count = getItemCount(nextRow);
          const nextItem = nextRow === 0 ? 0 : Math.min(curItem, Math.max(0, count - 1));
          setFocusedRow(nextRow);
          setFocusedItem(nextItem);
        }
      } else if (key === 'ArrowLeft') {
        event.preventDefault();
        const nextItem = Math.max(0, curItem - 1);
        setFocusedItem(nextItem);
      } else if (key === 'ArrowRight') {
        event.preventDefault();
        const itemCount = getItemCount(curRow);
        const nextItem = Math.min(Math.max(0, itemCount - 1), curItem + 1);
        setFocusedItem(nextItem);
      } else if (key === 'Enter') {
        event.preventDefault();
        const { heroSeriesId, rows, onSelectSeries } = optionsRef.current;
        if (!onSelectSeries) return;

        if (curRow === 0) {
          if (heroSeriesId) {
            onSelectSeries(heroSeriesId);
          }
        } else {
          const item = rows[curRow - 1]?.items?.[curItem];
          if (item?.id) {
            onSelectSeries(item.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSpatialMode]);

  useEffect(() => {
    if (!isSpatialMode) return;

    const element = document.querySelector<HTMLElement>(
      `[data-nav-row="${focusedRow}"][data-nav-item="${focusedItem}"]`
    );
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [focusedRow, focusedItem, isSpatialMode]);

  return {
    focusedRow,
    focusedItem,
    setFocus,
  };
}
