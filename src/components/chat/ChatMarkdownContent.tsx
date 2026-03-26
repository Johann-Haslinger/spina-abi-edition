import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { chatMarkdownClassName, normalizeMathDelimiters } from './chatMarkdownUtils';

export function ChatMarkdownContent(props: {
  content: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[chatMarkdownClassName, props.compact ? 'text-sm' : 'text-base', props.className ?? ''].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (anchorProps) => <a {...anchorProps} target="_blank" rel="noreferrer noopener" />,
          code: ({ className, children, ...codeProps }) => (
            <code className={className} {...codeProps}>
              {children}
            </code>
          ),
        }}
      >
        {normalizeMathDelimiters(props.content)}
      </ReactMarkdown>
    </div>
  );
}
