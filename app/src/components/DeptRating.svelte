<script lang="ts">
  import { formatPercent } from '../lib/engine';
  import type { Crumb, RatingRow } from '../lib/types';

  let {
    rows,
    total,
    crumbs,
    scopeName,
    periodLabel,
    canBack,
    onDrill,
    onBack,
    onCrumb,
  }: {
    rows: RatingRow[];
    total: number;
    crumbs: Crumb[];
    scopeName: string;
    periodLabel: string;
    canBack: boolean;
    onDrill: (row: RatingRow) => void;
    onBack: () => void;
    onCrumb: (id: number | null) => void;
  } = $props();

  let sort = $state<'discipline' | 'late' | 'absence'>('discipline');
  let showAll = $state(false);

  const sorted = $derived.by(() => {
    const list = [...rows];
    list.sort((a, b) => {
      if (sort === 'late') return b.lateDays - a.lateDays || a.name.localeCompare(b.name);
      if (sort === 'absence') return b.absenceDays - a.absenceDays || a.name.localeCompare(b.name);
      if (a.discipline == null && b.discipline == null) return a.name.localeCompare(b.name);
      if (a.discipline == null) return 1;
      if (b.discipline == null) return -1;
      return b.discipline - a.discipline || a.name.localeCompare(b.name);
    });
    return list;
  });

  const visible = $derived(showAll ? sorted : sorted.slice(0, 8));

  function tone(value: number | null): string {
    if (value == null) return '';
    if (value < 50) return 'bad';
    if (value < 70) return 'warn';
    return '';
  }
</script>

<section class="panel">
  <div class="panel-head">
    <div>
      <div class="title-line">
        {#if canBack}
          <button class="ghost-button back" onclick={onBack}>← Назад</button>
        {/if}
        <h2 class="panel-title">Рейтинг дисциплины — {scopeName}</h2>
      </div>
      <div class="panel-sub">
        {periodLabel} · по поддереву, взвешенно по плановым дням
      </div>
    </div>
    <label class="sort-wrap">
      <span>Сортировка</span>
      <select bind:value={sort}>
        <option value="discipline">по дисциплине</option>
        <option value="late">по опозданиям</option>
        <option value="absence">по отсутствиям</option>
      </select>
    </label>
  </div>

  <div class="crumbs-row">
    <nav class="crumbs" aria-label="Путь по департаментам">
      {#each crumbs as crumb, index}
        {#if index > 0}<span class="crumb-sep">/</span>{/if}
        {#if index === crumbs.length - 1}
          <span class="crumb current">{crumb.label}</span>
        {:else}
          <button class="crumb" onclick={() => onCrumb(crumb.id)}>{crumb.label}</button>
        {/if}
      {/each}
    </nav>
  </div>

  {#if rows.length === 0}
    <div class="empty">На этом уровне нет узлов</div>
  {:else}
    <div class="rating-list">
      {#each visible as row (row.id)}
        <button
          class="rating-row"
          aria-disabled={!row.hasChildren}
          onclick={() => row.hasChildren && onDrill(row)}
          title={row.hasChildren ? `Углубиться: ${row.name}` : row.name}
        >
          <span class="rating-main">
            <span class="rating-name">
              {row.name}
              {#if row.hasChildren}<span class="chev" aria-hidden="true">›</span>{/if}
            </span>
            <span class="progress">
              <span
                class="progress-fill"
                class:warn={tone(row.discipline) === 'warn'}
                class:bad={tone(row.discipline) === 'bad'}
                style={`width:${row.discipline == null ? 0 : Math.max(0, Math.min(100, row.discipline))}%`}
              ></span>
            </span>
            <span class="rating-meta">
              <span>{row.headcount} чел.</span>
              <span>{row.lateDays} опозд.</span>
              <span>{row.absenceDays} отс.</span>
            </span>
          </span>
          <span class="rating-score">{formatPercent(row.discipline)}</span>
        </button>
      {/each}
    </div>

    {#if total > 8}
      <button class="show-all" onclick={() => (showAll = !showAll)}>
        {showAll ? 'Свернуть' : `Показать все (${total})`}
      </button>
    {/if}
  {/if}
</section>

<style>
  .title-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .sort-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
  }

  .sort-wrap select {
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 4px 26px 4px 8px;
    font-size: 12px;
    line-height: 16px;
    color: var(--text);
    background-color: var(--surface);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%236b7a8d' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 12px 12px;
    appearance: none;
    -webkit-appearance: none;
  }

  .crumbs-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .crumb {
    border: 0;
    background: none;
    padding: 0;
    font-size: 12px;
    color: var(--accent);
  }

  .crumb:hover {
    text-decoration: underline;
  }

  .crumb.current {
    color: var(--muted);
  }

  .crumb-sep {
    font-size: 12px;
    color: var(--line);
  }

  .back {
    flex: none;
  }

  .rating-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rating-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 0;
    background: none;
    border-radius: 9px;
    padding: 8px;
    text-align: left;
  }

  .rating-row:hover {
    background: var(--surface-soft);
  }

  .rating-row[aria-disabled='true'] {
    cursor: default;
  }

  .rating-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .rating-name {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 550;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chev {
    color: var(--muted);
    font-size: 15px;
    line-height: 1;
  }

  .progress {
    display: block;
    margin-top: 6px;
  }

  .progress-fill {
    display: block;
  }

  .rating-meta {
    display: flex;
    gap: 10px;
    margin-top: 5px;
    font-size: 11px;
    color: var(--muted);
  }

  .rating-score {
    font-size: 14px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    min-width: 48px;
    text-align: right;
  }

  .show-all {
    margin-top: 8px;
    border: 0;
    background: none;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--accent);
  }

  .show-all:hover {
    text-decoration: underline;
  }
</style>
