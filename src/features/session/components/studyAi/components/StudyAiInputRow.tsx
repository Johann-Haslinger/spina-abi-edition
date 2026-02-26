import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IoArrowUp } from 'react-icons/io5';
import { PrimaryButton } from '../../../../../components/Button';

const SPRING = { type: 'spring', stiffness: 520, damping: 44 } as const;
const HEIGHT_TWEEN = { type: 'tween', duration: 0.12, ease: 'easeOut' } as const;

export function StudyAiInputRow(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  sending: boolean;
  placeholder: string;
  dense?: boolean;
  autoFocus?: boolean;
  rightAccessory?: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rowProbeRef = useRef<HTMLDivElement | null>(null);
  const colProbeRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const measureRef = useRef<HTMLTextAreaElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const minRows = 1;
  const [rowsAtRowWidth, setRowsAtRowWidth] = useState(minRows);
  const [heightPx, setHeightPx] = useState<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastWrapperWidthRef = useRef<number | null>(null);
  const [layoutMode, setLayoutMode] = useState<'row' | 'col'>('row');

  useEffect(() => {
    if (props.autoFocus) inputRef.current?.focus();
  }, [props.autoFocus]);

  const recalc = useCallback(() => {
    const wrapper = wrapperRef.current;
    const rowProbe = rowProbeRef.current;
    const colProbe = colProbeRef.current;
    const input = inputRef.current;
    const measure = measureRef.current;
    const actions = actionsRef.current;
    if (!wrapper || !rowProbe || !colProbe || !input || !measure || !actions) return;

    const rowStyle = window.getComputedStyle(rowProbe);
    const colStyle = window.getComputedStyle(colProbe);

    const rowPaddingX =
      Number.parseFloat(rowStyle.paddingLeft || '0') +
      Number.parseFloat(rowStyle.paddingRight || '0');
    const colPaddingX =
      Number.parseFloat(colStyle.paddingLeft || '0') +
      Number.parseFloat(colStyle.paddingRight || '0');
    const gapX = Number.parseFloat(rowStyle.columnGap || '') || 8;

    const rowInnerWidth = Math.max(0, wrapper.clientWidth - rowPaddingX);
    const colInnerWidth = Math.max(0, wrapper.clientWidth - colPaddingX);
    const actionsWidth = actions.getBoundingClientRect().width;
    const rowTextareaWidth = Math.max(40, rowInnerWidth - actionsWidth - gapX);
    const colTextareaWidth = Math.max(40, colInnerWidth);

    const measureForWidth = (w: number) => {
      const prevW = measure.style.width;
      const prevH = measure.style.height;
      const prevMinH = measure.style.minHeight;
      const prevVal = measure.value;

      try {
        measure.style.width = `${w}px`;
        measure.style.minHeight = '0px';
        measure.style.height = '0px';
        measure.value = input.value;

        const style = window.getComputedStyle(measure);
        const lineHeight = Number.parseFloat(style.lineHeight || '');
        if (!Number.isFinite(lineHeight) || lineHeight <= 0) return { rows: 1, lineHeight, style };

        const paddingY =
          Number.parseFloat(style.paddingTop || '0') +
          Number.parseFloat(style.paddingBottom || '0');
        const scrollHeight = measure.scrollHeight;
        const contentHeight = Math.max(0, scrollHeight - paddingY);
        const rawRows = contentHeight / lineHeight;
        const rows = Math.max(minRows, Math.ceil(rawRows - 0.15));
        return { rows, lineHeight, style };
      } finally {
        measure.style.width = prevW;
        measure.style.height = prevH;
        measure.style.minHeight = prevMinH;
        measure.value = prevVal;
      }
    };

    const rowMeasure = measureForWidth(rowTextareaWidth);
    setRowsAtRowWidth((prev) => (prev === rowMeasure.rows ? prev : rowMeasure.rows));

    let nextMode: 'row' | 'col' = layoutMode;
    if (layoutMode === 'row' && rowMeasure.rows >= 2) nextMode = 'col';
    else if (layoutMode === 'col' && rowMeasure.rows <= 1) nextMode = 'row';
    if (nextMode !== layoutMode) setLayoutMode(nextMode);

    const effectiveWidth = nextMode === 'col' ? colTextareaWidth : rowTextareaWidth;
    const effectiveMeasure = measureForWidth(effectiveWidth);
    const style = effectiveMeasure.style;
    const lineHeight = effectiveMeasure.lineHeight;
    const paddingY =
      Number.parseFloat(style.paddingTop || '0') + Number.parseFloat(style.paddingBottom || '0');
    const borderY =
      Number.parseFloat(style.borderTopWidth || '0') +
      Number.parseFloat(style.borderBottomWidth || '0');

    const minLines = nextMode === 'col' ? 2 : 1;
    const minHeightPx = Math.max(0, minLines * lineHeight + paddingY + borderY);

    measure.style.width = `${effectiveWidth}px`;
    measure.style.minHeight = '0px';
    measure.style.height = '0px';
    measure.value = input.value;
    const nextHeight = Math.max(measure.scrollHeight + borderY, minHeightPx);
    setHeightPx((prev) => (prev === nextHeight ? prev : nextHeight));
  }, [layoutMode]);

  useLayoutEffect(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recalc();
    });
  }, [props.value, layoutMode, recalc]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      const last = lastWrapperWidthRef.current;
      if (last != null && Math.abs(w - last) < 0.5) return;
      lastWrapperWidthRef.current = w;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        recalc();
      });
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [recalc]);

  const isMultiline = layoutMode === 'col' || rowsAtRowWidth > 1;

  return (
    <motion.div
      layout
      transition={SPRING}
      ref={wrapperRef}
      style={{ paddingLeft: isMultiline ? '8px' : '16px' }}
      className={['flex gap-2', isMultiline ? 'flex-col p-2' : 'items-center p-1'].join(' ')}
    >
      <div
        ref={rowProbeRef}
        aria-hidden="true"
        className="absolute pointer-events-none opacity-0 -z-10 flex gap-2 items-center p-1"
        style={{ left: -9999, top: -9999, paddingLeft: '16px' }}
      />
      <div
        ref={colProbeRef}
        aria-hidden="true"
        className="absolute pointer-events-none opacity-0 -z-10 flex gap-2 flex-col p-2"
        style={{ left: -9999, top: -9999, paddingLeft: '8px' }}
      />

      <textarea
        ref={measureRef}
        aria-hidden="true"
        tabIndex={-1}
        className={[
          'absolute pointer-events-none opacity-0 -z-10',
          'outline-none resize-none overflow-hidden',
        ].join(' ')}
      />

      <motion.textarea
        transition={HEIGHT_TWEEN}
        initial={false}
        ref={inputRef}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={1}
        animate={{ height: heightPx || undefined }}
        style={{ willChange: 'height' }}
        className={[
          'outline-none resize-none overflow-hidden',
          isMultiline ? 'w-full flex-none' : 'flex-1',
        ].join(' ')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            props.onSubmit();
          }
        }}
      />

      <motion.div
        layout="position"
        transition={SPRING}
        ref={actionsRef}
        className={[
          'flex items-center gap-2 flex-none w-fit',
          isMultiline ? 'self-end justify-end' : '',
        ].join(' ')}
      >
        {props.rightAccessory}
        <PrimaryButton
          disabled={props.sending || !props.value.trim()}
          onClick={props.onSubmit}
          icon={<IoArrowUp />}
          className="shrink-0"
        />
      </motion.div>
    </motion.div>
  );
}
