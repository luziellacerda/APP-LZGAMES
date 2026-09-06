import type { MarketplaceProduct } from "../api";

export type CatalogFilters = {
  query: string;
  category: string;
  condition: string;
};
type Page = { products: MarketplaceProduct[]; nextCursor: string | null };
export type CatalogState = Page & {
  loading: boolean;
  loadingMore: boolean;
  error: string;
};

/** A new search invalidates every older response, including pagination. */
export function createCatalogController(
  load: (
    filters: CatalogFilters & { cursor?: string | null; signal: AbortSignal },
  ) => Promise<Page>,
) {
  let generation = 0,
    disposed = false,
    request: AbortController | null = null;
  let filters: CatalogFilters = { query: "", category: "", condition: "" };
  let state: CatalogState = {
    products: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: "",
  };
  const listeners = new Set<(value: CatalogState) => void>();
  const emit = (patch: Partial<CatalogState>) => {
    state = { ...state, ...patch };
    if (!disposed) listeners.forEach((fn) => fn(state));
  };
  async function run(more: boolean) {
    if (
      disposed ||
      (more && (state.loading || state.loadingMore || !state.nextCursor))
    )
      return;
    const id = ++generation,
      cursor = more ? state.nextCursor : null;
    request?.abort();
    request = new AbortController();
    const active = request;
    emit({ loading: !more, loadingMore: more, error: "" });
    const timeout = setTimeout(() => active.abort(), 25000);
    try {
      const result = await load({ ...filters, cursor, signal: active.signal });
      if (disposed || id !== generation) return;
      const products = more ? [...state.products] : [];
      const ids = new Set(products.map((p) => p.id));
      for (const product of result.products)
        if (!ids.has(product.id)) {
          ids.add(product.id);
          products.push(product);
        }
      emit({
        products,
        nextCursor: result.nextCursor === cursor ? null : result.nextCursor,
      });
    } catch (error) {
      if (disposed || id !== generation) return;
      emit({
        error: active.signal.aborted
          ? "A conexão demorou. Tente novamente."
          : error instanceof Error
            ? error.message
            : "Não foi possível carregar os anúncios.",
      });
    } finally {
      clearTimeout(timeout);
      if (!disposed && id === generation)
        emit({ loading: false, loadingMore: false });
    }
  }
  return {
    getState: () => state,
    subscribe(fn: (value: CatalogState) => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    invalidate() {
      generation++;
      request?.abort();
      emit({
        products: [],
        nextCursor: null,
        loading: true,
        loadingMore: false,
        error: "",
      });
    },
    search(next: CatalogFilters) {
      filters = next;
      emit({ products: [], nextCursor: null });
      return run(false);
    },
    refresh: () => run(false),
    more: () => run(true),
    dispose() {
      disposed = true;
      generation++;
      request?.abort();
      listeners.clear();
    },
  };
}

/** BRL input, rejecting ambiguous/malformed grouping instead of guessing a price. */
export function parseMarketplacePrice(input: string): number {
  const raw = input.trim().replace(/^R\$\s*/i, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw)) return 0;
  const number = Number(raw.replace(/\./g, "").replace(",", "."));
  const cents = Math.round(number * 100);
  return Number.isSafeInteger(cents) && cents >= 100 && cents <= 100000000
    ? cents
    : 0;
}
