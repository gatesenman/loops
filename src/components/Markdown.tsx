import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders markdown text (GFM: tables, strikethrough, task lists) with the
// app's dark-theme styles. Used by the loop preview and the runner's AI
// replies. Raw HTML in the source is NOT rendered (react-markdown default).
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
