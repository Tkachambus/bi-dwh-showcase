<script lang="ts">
  import {
    formatDelta,
    formatHours,
    formatNumber,
    formatPercent,
  } from '../lib/engine';
  import type { SummaryRow } from '../lib/types';

  let {
    rows,
    canBack,
    onDrill,
    onBack,
  }: {
    rows: SummaryRow[];
    canBack: boolean;
    onDrill: (row: SummaryRow) => void;
    onBack: () => void;
  } = $props();

  type SortKey =
    | 'name'
    | 'headcount'
    | 'planHours'
    | 'factHours'
    | 'delta'
    | 'lateDays'
    | 'absenceDays'
    | 'discipline';

  let sortKey = $state<SortKey>('discipline');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let showAll = $state(false);

  function setSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      return;
    }
    sortKey = key;
    sortDir = key === 'name' ? 'asc' : 'desc';
  }

  const sorted = $derived.by(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let result = 0;
      if (sortKey === 'name') result = a.name.localeCompare(b.name);
      else if (sortKey === 'discipline') {
        if (a.discipline == null && b.discipline == null) result = 0;
        else if (a.discipline == null) result = 1;
        else if (b.discipline == null) result = -1;
        else result = a.discipline - b.discipline;
      } else {
        result = a[sortKey] - b[sortKey];
      }
      result = result || a.name.localeCompare(b.name);
      return sortDir === 'asc' ? result : -result;
    });
    return list;
  });

  const medals = $derived.by(() => {
    const best = [...rows]
      .filter((row) => row.discipline != null)
      .sort((a, b) => (b.discipline ?? 0) - (a.discipline ?? 0));
    return new Map(best.slice(0, 3).map((row, index) => [row.id, ['🥇', '🥈', '🥉'][index]]));
  });

  const visible = $derived(showAll ? sorted : sorted.slice(0, 10));

  function indicator(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  function disciplineTone(value: number | null): string {
    if (value == null) return '';
    if (value < 50) return 'tone-bad';
    if (value < 70) return 'tone-warn';
    return '';
  }

  function activate(row: SummaryRow) {
    if (row.hasChildren) onDrill(row);
  }
</script>

<section class="panel summary-panel">
  <div class="panel-head">
    <div>
      <div class="title-line">
        {#if canBack}
          <button class="ghost-button back" onclick={onBack}>← Назад</button>
        {/if}
        <h2 class="panel-title">Сводка по департаментам</h2>
      </div>
      <div class="panel-sub">
        сортировка по клику на заголовок · норма и факт часов за день
      </div>
    </div>
  </div>

  {#if rows.length === 0}
    <div class="empty">На этом уровне нет узлов</div>
  {:else}
    <div class="table-wrap">
      <table class="data-table summary-table">
        <colgroup>
          <col class="c-idx" />
          <col />
          <col class="c-count" />
          <col class="c-hours" />
          <col class="c-hours" />
          <col class="c-delta" />
          <col class="c-count" />
          <col class="c-small" />
          <col class="c-score" />
        </colgroup>
        <thead>
          <tr>
            <th class="idx">№</th>
            <th>
              <button class="sort-btn" class:active={sortKey === 'name'} onclick={() => setSort('name')}>
                Департамент {indicator('name')}
              </button>
            </th>
            <th class="num">
              <button class="sort-btn" class:active={sortKey === 'headcount'} onclick={() => setSort('headcount')}>
                Чел. {indicator('headcount')}
              </button>
            </th>
            <th class="num">
              <button class="sort-btn" class:active={sortKey === 'planHours'} onclick={() => setSort('planHours')}>
                Норма {indicator('planHours')}
              </button>
            </th>
            <th class="num">
              <button class="sort-btn" class:active={sortKey === 'factHours'} onclick={() => setSort('factHours')}>
                Факт {indicator('factHours')}
              </button>
            </th>
            <th class="num">
              <button class="sort-btn" class:active={sortKey === 'delta'} onclick={() => setSort('delta')}>
                Δ {indicator('delta')}
              </button>
            </th>
            <th class="num">
              <button class="sort-btn" class:active={sortKey === 'lateDays'} onclick={() => setSort('lateDays')}>
                Опозд. {indicator('lateDays')}
              </button>
            </th>
            <th class="num">
              <button class="sort-btn" class:active={sortKey === 'absenceDays'} onclick={() => setSort('absenceDays')}>
                Отс. {indicator('absenceDays')}
              </button>
            </th>
            <th class="num">
              <button class="sort-btn" class:active={sortKey === 'discipline'} onclick={() => setSort('discipline')}>
                Оценка {indicator('discipline')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each visible as row, index (row.id)}
            <tr
              class:clickable={row.hasChildren}
              tabindex={row.hasChildren ? 0 : -1}
              onclick={() => activate(row)}
              onkeydown={(event) => {
                if (row.hasChildren && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  activate(row);
                }
              }}
            >
              <td class="idx">{index + 1}</td>
              <td class="dept-cell">
                {#if medals.get(row.id)}<span class="medal">{medals.get(row.id)}</span>{/if}
                {row.name}
                {#if row.hasChildren}<span class="chev" aria-hidden="true">›</span>{/if}
              </td>
              <td class="num">{formatNumber(row.headcount)}</td>
              <td class="num">{formatHours(row.planHours)} ч</td>
              <td class="num">{formatHours(row.factHours)} ч</td>
              <td class="num" class:delta-pos={row.delta > 0} class:delta-neg={row.delta < 0}>
                {formatDelta(row.delta)} ч
              </td>
              <td class="num">{formatNumber(row.lateDays)}</td>
              <td class="num">{formatNumber(row.absenceDays)}</td>
              <td class="num score {disciplineTone(row.discipline)}">{formatPercent(row.discipline)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if rows.length > 10}
      <button class="show-all" onclick={() => (showAll = !showAll)}>
        {showAll ? 'Свернуть' : `Показать все (${rows.length})`}
      </button>
    {/if}
  {/if}
</section>

<style>
  .summary-panel {
    margin-top: 16px;
  }

  .title-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .table-wrap {
    max-height: 560px;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 10px;
  }

  .summary-table {
    table-layout: fixed;
    min-width: 920px;
  }

  .c-idx { width: 48px; }
  .c-count { width: 84px; }
  .c-hours { width: 112px; }
  .c-delta { width: 120px; }
  .c-small { width: 76px; }
  .c-score { width: 108px; }

  .summary-table th,
  .summary-table td {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .summary-table th {
    padding: 8px 10px;
  }

  .summary-table td {
    padding: 0 10px;
    height: 44px;
  }

  .idx,
  .summary-table .num {
    text-align: center;
  }

  .idx {
    width: 48px;
    color: var(--muted);
  }

  .sort-btn {
    display: block;
    width: 100%;
    border: 0;
    background: none;
    padding: 0;
    font-size: 12px;
    color: var(--muted);
    font-weight: 500;
    white-space: nowrap;
    text-align: inherit;
  }

  .sort-btn:hover,
  .sort-btn.active {
    color: var(--text);
  }

  .dept-cell {
    font-weight: 550;
    white-space: nowrap;
  }

  .medal {
    margin-right: 4px;
  }

  .chev {
    color: var(--muted);
    margin-left: 4px;
  }

  .clickable {
    cursor: pointer;
  }

  .delta-pos {
    color: var(--ok);
  }

  .delta-neg {
    color: var(--rose);
  }

  .score {
    font-weight: 600;
  }

  .tone-bad {
    color: var(--rose);
  }

  .tone-warn {
    color: var(--amber);
  }

  .show-all {
    margin-top: 8px;
    border: 0;
    background: none;
    padding: 4px 2px;
    font-size: 12px;
    color: var(--accent);
  }

  .show-all:hover {
    text-decoration: underline;
  }
</style>
