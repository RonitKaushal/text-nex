import type { CSSProperties } from 'react';

export type SplitLayoutId =
  | 'horizontal-2' // top / bottom
  | 'vertical-2' // left / right
  | 'vertical-3' // left / center / right
  | 'grid-4'; // 2×2

export const SPLIT_LAYOUTS: {
  id: SplitLayoutId;
  label: string;
  slots: number;
}[] = [
  { id: 'horizontal-2', label: 'Top & bottom', slots: 2 },
  { id: 'vertical-2', label: 'Left & right', slots: 2 },
  { id: 'vertical-3', label: '3 columns', slots: 3 },
  { id: 'grid-4', label: '4 panes', slots: 4 },
];

export function slotCountForLayout(layout: SplitLayoutId): number {
  return SPLIT_LAYOUTS.find((l) => l.id === layout)?.slots ?? 2;
}

/** CSS grid template for the split workspace. */
export function gridStyleForLayout(layout: SplitLayoutId): CSSProperties {
  switch (layout) {
    case 'horizontal-2':
      return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 1,
      };
    case 'vertical-2':
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr',
        gap: 1,
      };
    case 'vertical-3':
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr',
        gap: 1,
      };
    case 'grid-4':
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 1,
      };
    default:
      return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 };
  }
}

/** Mini preview cells for the layout picker button. */
export function previewStyleForLayout(layout: SplitLayoutId): CSSProperties {
  switch (layout) {
    case 'horizontal-2':
      return { display: 'grid', gridTemplateRows: '1fr 1fr', gap: 3, height: '100%' };
    case 'vertical-2':
      return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, height: '100%' };
    case 'vertical-3':
      return { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, height: '100%' };
    case 'grid-4':
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 3,
        height: '100%',
      };
    default:
      return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, height: '100%' };
  }
}
