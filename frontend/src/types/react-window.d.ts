declare module 'react-window' {
  import type * as React from 'react';
  import type { ComponentType, CSSProperties } from 'react';

  export interface ListChildComponentProps {
    index: number;
    style: CSSProperties;
    data: unknown;
  }

  export interface FixedSizeListProps {
    children: ComponentType<ListChildComponentProps>;
    height: number;
    itemCount: number;
    itemSize: number;
    width?: number | string;
    itemData?: unknown;
  }

  export class FixedSizeList extends React.Component<FixedSizeListProps> {
    scrollToItem(index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start'): void;
  }
}
