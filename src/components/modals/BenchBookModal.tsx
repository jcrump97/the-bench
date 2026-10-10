import { useId, useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { BENCH_BOOK_TERMS, SIMPLIFICATIONS, UNDER_THE_HOOD } from '../../lib/benchBook';
import { Modal } from './Modal';

const TABS = [
  { id: 'terms', label: 'Terms' },
  { id: 'modeled', label: 'How this court is modeled' },
  { id: 'hood', label: 'Under the hood' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function TermsTab() {
  return (
    <div className="space-y-6">
      {BENCH_BOOK_TERMS.map((group) => (
        <section key={group.title}>
          <h3 className="text-sm font-medium tracking-wide text-(--text-muted) uppercase">{group.title}</h3>
          <dl className="mt-2 space-y-4">
            {group.terms.map((entry) => (
              <div key={entry.term} data-bench-book-term={entry.term}>
                <dt className="font-medium text-(--text-h)">{entry.term}</dt>
                <dd className="mt-0.5 text-(--text)">{entry.plain}</dd>
                {entry.inThisCourt !== undefined && (
                  <dd className="mt-1 border-l-2 border-(--accent-border) pl-2 text-sm text-(--text)">
                    <span className="text-(--text-muted)">In this court: </span>
                    {entry.inThisCourt}
                  </dd>
                )}
                {entry.authority !== undefined && (
                  <dd className="mt-1 font-mono text-xs text-(--text-muted)">{entry.authority}</dd>
                )}
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function ModeledTab() {
  return (
    <div>
      <p>
        The procedure follows a California criminal courtroom, and the terms cite the law it rests on. Where the game
        departs from real practice, it says so here rather than pass a mechanic off as the law:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        {SIMPLIFICATIONS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function UnderTheHoodTab() {
  return (
    <div className="space-y-4">
      {UNDER_THE_HOOD.map((item) => (
        <section key={item.heading}>
          <h3 className="font-medium text-(--text-h)">{item.heading}</h3>
          <p className="mt-0.5">{item.body}</p>
        </section>
      ))}
      <p className="text-sm text-(--text-muted)">
        The architecture, its decisions and its test suite are documented in the{' '}
        <a
          href="https://github.com/jcrump97/the-bench#readme"
          target="_blank"
          rel="noreferrer"
          className="text-(--accent) underline"
        >
          project README
        </a>
        .
      </p>
    </div>
  );
}

// The judge's reference, openable from the docket or mid-case. It reads no
// case data, so it can never reveal anything the record has not.
export function BenchBookModal() {
  const closeModal = useUIStore((state) => state.closeModal);
  const [tab, setTab] = useState<TabId>('terms');
  const tabsId = useId();

  return (
    <Modal title="Bench Book" onClose={closeModal}>
      <div role="tablist" aria-label="Bench Book sections" className="mb-4 flex flex-wrap gap-2">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${tabsId}-${id}`}
            aria-selected={tab === id}
            aria-controls={`${tabsId}-panel`}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm ${
              tab === id
                ? 'border-(--accent-border) bg-(--accent-bg) text-(--text-h)'
                : 'border-(--border) text-(--text-muted) hover:text-(--text-h)'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} data-bench-book-tab={tab}>
        {tab === 'terms' && <TermsTab />}
        {tab === 'modeled' && <ModeledTab />}
        {tab === 'hood' && <UnderTheHoodTab />}
      </div>
    </Modal>
  );
}
