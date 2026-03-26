export function normalizeMathDelimiters(input: string) {
  return input
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

export const chatMarkdownClassName = [
  'max-w-full',
  'text-slate-100 leading-relaxed wrap-anywhere',
  '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
  '[&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:list-outside [&_ol]:list-outside [&_li]:list-item',
  '[&_li::marker]:text-slate-200/80',
  '[&_h1]:text-[1.05em] [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1',
  '[&_h2]:text-[1.02em] [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1',
  '[&_h3]:text-[1em] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
  '[&_blockquote]:my-2 [&_blockquote]:border-l [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_blockquote]:text-slate-200/90',
  '[&_hr]:my-3 [&_hr]:border-white/10',
  '[&_a]:text-sky-300 [&_a]:underline [&_a:hover]:text-sky-200',
  '[&_table]:my-2 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border [&_table]:border-white/10 [&_table]:rounded-lg',
  '[&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:border-b [&_th]:border-white/10 [&_th]:bg-white/5',
  '[&_td]:px-2 [&_td]:py-1 [&_td]:border-b [&_td]:border-white/10',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/30 [&_pre]:p-3',
  '[&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.95em]',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:px-0 [&_pre_code]:py-0',
  '[&_.katex]:leading-[1.75] [&_.katex-display]:my-3 [&_.katex-display]:leading-[1.75] [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden',
].join(' ');
