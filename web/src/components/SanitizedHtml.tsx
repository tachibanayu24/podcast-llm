import DOMPurify from "dompurify";
import { useEffect, useMemo } from "react";

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

const URL_RE = /(https?:\/\/[^\s<>"'`)]+)/g;

/**
 * Autolinkify bare URLs in text nodes only (skip text inside existing <a>).
 * Done before sanitize so that DOMPurify cleans the resulting anchors.
 */
function autolinkify(html: string): string {
  if (typeof window === "undefined") return html;
  const tmpl = document.createElement("div");
  tmpl.innerHTML = html;

  const walker = document.createTreeWalker(tmpl, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      let parent: Node | null = node.parentNode;
      while (parent) {
        if (parent.nodeName === "A") return NodeFilter.FILTER_REJECT;
        parent = parent.parentNode;
      }
      return URL_RE.test(node.textContent ?? "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const targets: Text[] = [];
  let cur: Node | null;
  while ((cur = walker.nextNode())) {
    targets.push(cur as Text);
  }

  for (const n of targets) {
    const text = n.textContent ?? "";
    URL_RE.lastIndex = 0;
    if (!URL_RE.test(text)) continue;
    const span = document.createElement("span");
    span.innerHTML = text.replace(URL_RE, (m) => {
      const escaped = m
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<a href="${escaped}">${escaped}</a>`;
    });
    n.replaceWith(...Array.from(span.childNodes));
  }

  return tmpl.innerHTML;
}

let hookRegistered = false;
function ensureHooks() {
  if (hookRegistered) return;
  hookRegistered = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (
      node instanceof HTMLAnchorElement &&
      node.hasAttribute("href") &&
      /^https?:/i.test(node.getAttribute("href") ?? "")
    ) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function SanitizedHtml({ html, className }: Props) {
  useEffect(() => {
    ensureHooks();
  }, []);

  const cleaned = useMemo(() => {
    ensureHooks();
    const linked = autolinkify(html);
    return DOMPurify.sanitize(linked, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
    });
  }, [html]);

  return (
    <div
      className={className}
      // sanitized via DOMPurify above
      dangerouslySetInnerHTML={{ __html: cleaned }}
    />
  );
}
