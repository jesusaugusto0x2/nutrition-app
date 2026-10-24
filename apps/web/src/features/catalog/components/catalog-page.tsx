import { catalog } from '../samples';
import { ActionsCatalog } from './actions-catalog';
import { CatalogIndex } from './catalog-index';
import { DataCatalog } from './data-catalog';
import { FormsCatalog } from './forms-catalog';
import { MessagesCatalog } from './messages-catalog';
import { NavigationCatalog } from './navigation-catalog';

/** Dev-only page showing every spec component with its variants. */
export function CatalogPage() {
  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 px-5 py-8 md:px-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-display font-medium md:text-display-lg">
          {catalog.title}
        </h1>
        <p className="text-muted-foreground">{catalog.intro}</p>
      </header>
      <CatalogIndex />
      <Family title={catalog.families.navigation}>
        <NavigationCatalog />
      </Family>
      <Family title={catalog.families.actions}>
        <ActionsCatalog />
      </Family>
      <Family title={catalog.families.forms}>
        <FormsCatalog />
      </Family>
      <Family title={catalog.families.data}>
        <DataCatalog />
      </Family>
      <Family title={catalog.families.messages}>
        <MessagesCatalog />
      </Family>
    </main>
  );
}

function Family({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-[28px] font-medium">{title}</h2>
      {children}
    </section>
  );
}
