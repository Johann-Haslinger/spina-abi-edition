import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IoArrowUp, IoSquare } from 'react-icons/io5';
import { PrimaryButton } from '../Button';

const SPRING = { type: 'spring', stiffness: 520, damping: 44 } as const;
const HEIGHT_TWEEN = { type: 'tween', duration: 0.12, ease: 'easeOut' } as const;

export function ChatInputRow(props: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  sending: boolean;
  placeholder: string;
  dense?: boolean;
  autoFocus?: boolean;
  rightAccessory?: ReactNode;
  onStop?: () => void;
  disabled?: boolean;
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

    const measureForWidth = (width: number) => {
      const previousWidth = measure.style.width;
      const previousHeight = measure.style.height;
      const previousMinHeight = measure.style.minHeight;
      const previousValue = measure.value;

      try {
        measure.style.width = `${width}px`;
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
        measure.style.width = previousWidth;
        measure.style.height = previousHeight;
        measure.style.minHeight = previousMinHeight;
        measure.value = previousValue;
      }
    };

    const rowMeasure = measureForWidth(rowTextareaWidth);
    setRowsAtRowWidth((previous) => (previous === rowMeasure.rows ? previous : rowMeasure.rows));

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
    setHeightPx((previous) => (previous === nextHeight ? previous : nextHeight));
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
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      const last = lastWrapperWidthRef.current;
      if (last != null && Math.abs(width - last) < 0.5) return;
      lastWrapperWidthRef.current = width;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        recalc();
      });
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [recalc]);

  const isMultiline = layoutMode === 'col' || rowsAtRowWidth > 1;
  const submitDisabled = props.sending ? false : props.disabled || !props.value.trim();

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
        className="absolute pointer-events-none -z-10 flex items-center gap-2 opacity-0 p-1"
        style={{ left: -9999, top: -9999, paddingLeft: '16px' }}
      />
      <div
        ref={colProbeRef}
        aria-hidden="true"
        className="absolute pointer-events-none -z-10 flex flex-col gap-2 opacity-0 p-2"
        style={{ left: -9999, top: -9999, paddingLeft: '8px' }}
      />

      <textarea
        ref={measureRef}
        aria-hidden="true"
        tabIndex={-1}
        className="absolute pointer-events-none -z-10 resize-none overflow-hidden opacity-0 outline-none"
      />

      <motion.textarea
        transition={HEIGHT_TWEEN}
        initial={false}
        ref={inputRef}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        rows={1}
        disabled={props.disabled}
        animate={{ height: heightPx || undefined }}
        style={{ willChange: 'height' }}
        className={[
          'resize-none overflow-hidden outline-none',
          isMultiline ? 'w-full flex-none' : 'flex-1',
          props.disabled ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!props.disabled) props.onSubmit();
          }
        }}
      />

      <motion.div
        layout="position"
        transition={SPRING}
        ref={actionsRef}
        className={[
          'flex w-fit flex-none items-center gap-2',
          isMultiline ? 'self-end justify-end' : '',
        ].join(' ')}
      >
        {props.rightAccessory}
        <PrimaryButton
          disabled={submitDisabled}
          onClick={props.sending ? (props.onStop ?? (() => {})) : props.onSubmit}
          icon={props.sending ? <IoSquare className="opacity-60" /> : <IoArrowUp />}
          className="shrink-0"
        />
      </motion.div>
    </motion.div>
  );
}
