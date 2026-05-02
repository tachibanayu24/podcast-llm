import type { Episode } from "@podcast-llm/shared";
import { Section } from "@/components/episode/Section";
import { SanitizedHtml } from "@/components/SanitizedHtml";
import { Card } from "@/components/ui/card";

interface Props {
  episode: Episode;
}

export function ShowNotesSection({ episode }: Props) {
  if (!episode.showNotes && !episode.description) return null;
  const html = episode.showNotes?.html ?? episode.description ?? "";
  const text = episode.showNotes?.text ?? "";
  const hasHtml = /<[a-z][\s\S]*>/i.test(html);

  return (
    <Section title="エピソードについて">
      <Card className="p-5">
        {hasHtml ? (
          <SanitizedHtml html={html} className="prose-podcast" />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
            {text || html}
          </p>
        )}
      </Card>
    </Section>
  );
}
