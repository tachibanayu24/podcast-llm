import DOMPurify from "dompurify";
import { useMemo } from "react";

interface Props {
  html: string;
  className?: string;
}

const ALLOWED_TAGS = [
  "a",
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "img",
  "hr",
  "div",
  "span",
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "target", "rel"];

export function SanitizedHtml({ html, className }: Props) {
  const clean = useMemo(
    () =>
      DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ADD_ATTR: ["target", "rel"],
      }),
    [html],
  );
  // Force external links to open in new tab safely
  const withLinkRel = useMemo(
    () =>
      clean.replace(
        /<a\b([^>]*)href=("https?:\/\/[^"]+"|'https?:\/\/[^']+')([^>]*)>/gi,
        (_m, pre, href, post) =>
          `<a${pre}href=${href}${post} target="_blank" rel="noopener noreferrer">`,
      ),
    [clean],
  );
  return (
    <div
      className={className}
      // sanitized via DOMPurify above
      dangerouslySetInnerHTML={{ __html: withLinkRel }}
    />
  );
}
