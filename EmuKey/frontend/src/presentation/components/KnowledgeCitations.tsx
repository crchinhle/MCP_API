import type { CitationDetailDto } from '../../infrastructure/api/generated';
import { Button } from 'antd';

export function KnowledgeCitations({
  citations = [],
}: {
  citations?: readonly CitationDetailDto[];
}) {
  if (!citations.length) return null;
  return (
    <section aria-label="Nguồn tham khảo" className="knowledge-citations">
      {citations
        .filter(
          (citation, index) =>
            citations.findIndex(
              (item) => item.documentId === citation.documentId,
            ) === index,
        )
        .map((citation) => (
          <Button
            key={citation.documentId}
            href={`/help/${encodeURIComponent(citation.documentId)}`}
          >
            Xem nguồn: {citation.documentTitle}
          </Button>
        ))}
    </section>
  );
}
