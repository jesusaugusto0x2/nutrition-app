import { catalog } from '../samples';

const { families, components } = catalog;

/** Section anchors per family, in spec order. Keep in sync with the ids. */
const index: { family: string; sections: [id: string, title: string][] }[] = [
  {
    family: families.navigation,
    sections: [
      ['brand', components.brand],
      ['sidebar', components.sidebar],
      ['bottom-nav', components.bottomNav],
      ['back-link', components.backLink],
      ['tabs', components.tabs],
      ['pagination', components.pagination],
    ],
  },
  {
    family: families.actions,
    sections: [
      ['button', components.button],
      ['yes-no', components.yesNo],
      ['choice', components.choice],
      ['chips', components.chips],
    ],
  },
  {
    family: families.forms,
    sections: [
      ['text-field', components.textField],
      ['unit-field', components.unitField],
      ['password', components.password],
      ['search', components.search],
      ['textarea', components.textarea],
      ['computed', components.computed],
      ['bmi-result', components.bmiResult],
      ['checkbox', components.checkbox],
      ['field-error', components.fieldError],
    ],
  },
  {
    family: families.data,
    sections: [
      ['card', components.card],
      ['avatar', components.avatar],
      ['patient-header', components.patientHeader],
      ['patient-row', components.patientRow],
      ['trend', components.trend],
      ['classification', components.classification],
      ['diff', components.diff],
      ['stat', components.stat],
      ['chart', components.chart],
      ['records-table', components.recordsTable],
      ['record-card', components.recordCard],
      ['note', components.note],
    ],
  },
  {
    family: families.messages,
    sections: [
      ['success', components.success],
      ['undo', components.undo],
      ['info', components.info],
      ['empty', components.empty],
      ['coming-soon-card', components.comingSoonCard],
      ['save-bar', components.saveBar],
    ],
  },
];

/** Collapsible table of contents linking to every section. */
export function CatalogIndex() {
  return (
    <details className="rounded-card border bg-surface px-5 py-3 md:px-6">
      <summary className="min-h-touch cursor-pointer py-2.5 font-bold">
        {catalog.indexTitle}
      </summary>
      <nav
        aria-label={catalog.indexTitle}
        className="grid gap-5 pt-2 pb-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {index.map(({ family, sections }) => (
          <div key={family} className="flex flex-col gap-1">
            <span className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              {family}
            </span>
            <ul className="flex flex-col">
              {sections.map(([id, title]) => (
                <li key={id}>
                  <a href={`#${id}`} className="flex min-h-touch items-center">
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </details>
  );
}
