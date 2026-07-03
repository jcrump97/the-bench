import { z } from 'zod';
import { SentenceSchema } from '../../schemas/gameSchemas';
import { formatSentence } from '../../lib/format';

type Sentence = z.infer<typeof SentenceSchema>;

interface SentenceListProps {
  sentences: Sentence[];
}

export function SentenceList({ sentences }: SentenceListProps) {
  if (sentences.length === 0) {
    return <p className="text-(--text-muted)">No sentence recorded</p>;
  }

  return (
    <ul className="list-disc space-y-1 pl-5">
      {sentences.map((sentence, index) => (
        <li key={index} className="text-(--text)">
          {formatSentence(sentence)}
        </li>
      ))}
    </ul>
  );
}
