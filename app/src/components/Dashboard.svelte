<script lang="ts">
  import { onMount } from 'svelte';
  import DashboardHeader from './DashboardHeader.svelte';
  import StatCards from './StatCards.svelte';
  import DeptRating from './DeptRating.svelte';
  import TodayViolations from './TodayViolations.svelte';
  import DeptSummary from './DeptSummary.svelte';
  import OverlayHost from './OverlayHost.svelte';
  import {
    buildEmployeeDays,
    buildOverlay,
    buildOverview,
    formatRuDate,
    parseState,
    stateToSearch,
  } from '../lib/engine';
  import type {
    DashboardState,
    OverviewData,
    RatingRow,
    Snapshot,
    SummaryRow,
    ViewName,
  } from '../lib/types';

  let {
    initial,
    initialState,
    snapshotUrl,
    snapshotToday,
  }: {
    initial: OverviewData;
    initialState: DashboardState;
    snapshotUrl: string;
    snapshotToday: string;
  } = $props();

  let snapshot = $state<Snapshot | null>(null);
  // svelte-ignore state_referenced_locally
  let liveState = $state<DashboardState>(initialState);
  let loadError = $state<string | null>(null);

  let data = $derived(snapshot ? buildOverview(snapshot, liveState) : initial);
  let overlay = $derived(
    snapshot && liveState.view ? buildOverlay(snapshot, liveState) : null,
  );
  let employeeDays = $derived(
    snapshot && liveState.eid != null ? buildEmployeeDays(snapshot, liveState) : null,
  );

  function apply(next: DashboardState, mode: 'push' | 'replace' = 'push') {
    liveState = next;
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.search = stateToSearch(next).toString();
    if (mode === 'replace') {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
  }

  function onDrill(row: RatingRow | SummaryRow) {
    if (!row.hasChildren) return;
    apply({
      ...liveState,
      node: row.id,
      level: Math.min(5, row.lvl + 1),
      history: [...liveState.history, { l: liveState.level, n: liveState.node }],
      view: null,
      eid: null,
    });
  }

  function onBack() {
    const history = [...liveState.history];
    const prev = history.pop();
    if (!prev) {
      apply({ ...liveState, node: null, level: 2, history: [] });
      return;
    }
    apply({ ...liveState, node: prev.n, level: prev.l, history });
  }

  function deptDepth(id: number): number {
    if (!snapshot) return 1;
    const byId = new Map(snapshot.departments.map((d) => [d.id, d]));
    let depth = 0;
    let cur = byId.get(id);
    const seen = new Set<number>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      depth += 1;
      cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
    }
    return depth;
  }

  function onCrumb(id: number | null) {
    if (id == null) {
      apply({ ...liveState, node: null, level: 2, history: [] });
      return;
    }
    if (id === liveState.node) return;
    apply({
      ...liveState,
      node: id,
      level: Math.min(5, deptDepth(id) + 2),
      history: [...liveState.history, { l: liveState.level, n: liveState.node }],
      view: null,
      eid: null,
    });
  }

  function onOpenView(view: ViewName) {
    apply({ ...liveState, view, eid: null });
  }

  function onOpenEmployee(eid: number) {
    apply({ ...liveState, eid });
  }

  function onCloseOverlay() {
    if (liveState.eid != null) {
      apply({ ...liveState, eid: null }, 'replace');
      return;
    }
    apply({ ...liveState, view: null }, 'replace');
  }

  function onBackOverlay() {
    if (liveState.eid != null && liveState.view != null) {
      apply({ ...liveState, eid: null }, 'replace');
      return;
    }
    apply({ ...liveState, view: null, eid: null }, 'replace');
  }

  onMount(() => {
    let disposed = false;

    (async () => {
      try {
        const response = await fetch(snapshotUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const loaded = (await response.json()) as Snapshot;
        if (disposed) return;
        snapshot = loaded;
        liveState = parseState(window.location.search, loaded);
      } catch (error) {
        if (!disposed) {
          loadError = error instanceof Error ? error.message : String(error);
        }
      }
    })();

    const onPop = () => {
      if (snapshot) liveState = parseState(window.location.search, snapshot);
    };
    window.addEventListener('popstate', onPop);

    return () => {
      disposed = true;
      window.removeEventListener('popstate', onPop);
    };
  });
</script>

<DashboardHeader
  periodLabel={data.periodLabel}
  scopeName={data.scopeName}
  absences={data.stats.absenceDays}
  today={snapshotToday}
/>

<StatCards stats={data.stats} dateLabel={formatRuDate(snapshotToday)} onOpenView={onOpenView} />

<div class="two-col pair">
  <div class="rating-col">
    <DeptRating
      rows={data.rating}
      total={data.ratingTotal}
      crumbs={data.crumbs}
      scopeName={data.scopeName}
      periodLabel={data.periodLabel}
      canBack={data.canBack}
      onDrill={onDrill}
      onBack={onBack}
      onCrumb={onCrumb}
    />
  </div>
  <div class="violations-slot">
    <TodayViolations
      items={data.violations}
      total={data.violationsTotal}
      onOpenAll={() => onOpenView('violations')}
      onOpenEmployee={onOpenEmployee}
    />
  </div>
</div>

<DeptSummary
  rows={data.summary}
  canBack={data.canBack}
  onDrill={onDrill}
  onBack={onBack}
/>

{#if snapshot && (liveState.view || liveState.eid != null)}
  <OverlayHost
    view={liveState.view}
    eid={liveState.eid}
    overlay={overlay}
    employeeDays={employeeDays}
    dateFrom={liveState.dateFrom}
    dateTo={liveState.dateTo}
    today={snapshotToday}
    onClose={onCloseOverlay}
    onBack={onBackOverlay}
    onOpenEmployee={onOpenEmployee}
  />
{/if}

{#if loadError}
  <div class="load-error">
    Не удалось загрузить снапшот для интерактива: {loadError}. Показаны данные,
    рассчитанные при сборке.
  </div>
{/if}

<style>
  .pair {
    align-items: stretch;
  }

  .rating-col,
  .violations-slot {
    min-width: 0;
    min-height: 0;
  }

  /* Панель нарушений заполняет ячейку рейтинга и не растягивает ряд. */
  .violations-slot :global(.violations-panel) {
    position: absolute;
    inset: 0;
  }

  .violations-slot {
    position: relative;
  }

  @media (max-width: 1100px) {
    .violations-slot :global(.violations-panel) {
      position: static;
    }
  }
</style>
