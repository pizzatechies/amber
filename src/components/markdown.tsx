import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders user-written Markdown (course descriptions, articles, Q&A).
 * Raw HTML in the source is not rendered, and unsafe link protocols are
 * stripped by react-markdown, so this is safe for untrusted input.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
          img: ({ node: _node, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote images from user content
            <img {...props} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
