import { CSSProperties, HTMLAttributes, ReactNode, useId, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IoTrash } from 'react-icons/io5';

/**
 * Drag-handle props produced by `useSortable`. Spread onto a `<button>` (or
 * any focusable element) inside the children render-prop to make it the drag
 * grabber. Undefined when `id` is not supplied (swipe-only mode).
 */
export type DragHandleProps = HTMLAttributes<HTMLElement>;

interface ChildrenArgs {
  /** Spread onto the drag-handle element. Undefined when `id` is omitted. */
  dragHandleProps?: DragHandleProps;
  /** True while the row is being drag-reordered. */
  isDragging: boolean;
}

interface SortableSwipeItemProps {
  /** When provided, the row participates in the parent `<SortableContext>`. */
  id?: string;
  /** Fired when the user swipes left past the threshold. */
  onSwipeDelete: () => void;
  /**
   * Outer wrapper class. Pass a function to access `isDragging` for
   * conditional state classes (e.g. `${dragging ? 'dragging' : ''}`).
   */
  wrapperClassName?: string | ((isDragging: boolean) => string);
  /** Class for the inner swipeable layer (the visible card). */
  contentClassName?: string;
  /** Extra inline styles merged onto the inner content (e.g. background). */
  contentStyle?: CSSProperties;
  /** Optional click handler attached to the inner swipeable content. */
  onContentClick?: () => void;
  children: ReactNode | ((args: ChildrenArgs) => ReactNode);
}

const SWIPE_THRESHOLD_PX = -70;
const SWIPE_MAX_OFFSET_PX = -100;
const SWIPE_RESET_DELAY_MS = 300;
const SWIPE_TRANSITION = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

/**
 * Standardized swipe-to-delete row, optionally drag-reorderable.
 *
 * Renders the canonical structure used across Todo / Shopping / Notes /
 * Recipes / Workout pages:
 *
 * ```
 * <wrapper>
 *   <div class="swipe-delete-bg"><IoTrash /></div>
 *   <content style={swipe transform} {...swipeHandlers}>
 *     {children}
 *   </content>
 * </wrapper>
 * ```
 *
 * When `id` is supplied, the wrapper participates in `@dnd-kit` sorting and
 * `dragHandleProps` is exposed via the children render-prop so the consumer
 * can place the handle anywhere inside the card.
 */
export function SortableSwipeItem({
  id,
  onSwipeDelete,
  wrapperClassName,
  contentClassName,
  contentStyle,
  onContentClick,
  children,
}: SortableSwipeItemProps) {
  // Hooks must be called unconditionally; when no `id` is supplied we feed
  // `useSortable` a stable fallback and disable it so the row is purely
  // swipeable. (`useSortable` is safe to call outside a `<DndContext>` —
  // it falls back to inert defaults.)
  const fallbackId = useId();
  const sortable = useSortable({ id: id ?? fallbackId, disabled: id === undefined });
  const isDragging = id !== undefined && sortable.isDragging;

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const resetSwipe = () => {
    setSwipeOffset(0);
    setIsSwiping(false);
  };

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (e.dir === 'Left') {
        setSwipeOffset(Math.min(0, Math.max(SWIPE_MAX_OFFSET_PX, e.deltaX)));
        setIsSwiping(true);
      }
    },
    onSwiped: (e) => {
      if (e.dir === 'Left' && swipeOffset < SWIPE_THRESHOLD_PX) {
        onSwipeDelete();
        // Delay reset so a confirmation modal can mount before the row snaps back.
        setTimeout(resetSwipe, SWIPE_RESET_DELAY_MS);
      } else {
        resetSwipe();
      }
      setIsSwiping(false);
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  const wrapperStyle: CSSProperties | undefined = id !== undefined
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: isSwiping ? 'none' : sortable.transition,
      }
    : undefined;

  const mergedContentStyle: CSSProperties = {
    transform: `translateX(${swipeOffset}px)`,
    transition: isSwiping ? 'none' : SWIPE_TRANSITION,
    ...contentStyle,
  };

  const dragHandleProps: DragHandleProps | undefined = id !== undefined
    ? { ...sortable.attributes, ...sortable.listeners }
    : undefined;

  const resolvedWrapperClassName = typeof wrapperClassName === 'function'
    ? wrapperClassName(isDragging)
    : wrapperClassName;

  const renderedChildren = typeof children === 'function'
    ? children({ dragHandleProps, isDragging })
    : children;

  return (
    <div
      ref={id !== undefined ? sortable.setNodeRef : undefined}
      style={wrapperStyle}
      className={resolvedWrapperClassName}
    >
      <div className="swipe-delete-bg">
        <IoTrash size={20} />
      </div>
      <div
        className={contentClassName}
        style={mergedContentStyle}
        onClick={onContentClick}
        {...swipeHandlers}
      >
        {renderedChildren}
      </div>
    </div>
  );
}
