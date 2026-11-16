<script lang="ts">
  import { absenceLabel, formatRuDate } from '../lib/engine';
  import type { ViolationItem } from '../lib/types';

  let {
    items,
    total,
    onOpenAll,
    onOpenEmployee,
  }: {
    items: ViolationItem[];
    total: number;
    onOpenAll: () => void;
    onOpenEmployee: (employeeId: number) => void;
  } = $props();

  let sort = $state<'name' | 'dept'>('name');

  const sorted = $derived.by(() => {
    const list = [...items];
    list.sort((a, b) =>
      sort === 'dept'
        ? a.deptName.localeCompare(b.deptName) || a.fullName.localeCompare(b.fullName)
        : a.fullName.localeCompare(b.fullName),
    );
    return list;
  });

  const visible = $derived(sorted.slice(0, 10));

  function absenceText(item: ViolationItem): string {
    if (!item.absenceType) return 'Без записи';
    return absenceLabel(item.absenceType);
  }
</script>

<section class="panel violations-panel">
  <div class="panel-head">
    <div>
      <h2 class="panel-title">Нарушения</h2>
      <div class="panel-sub">опоздания и несогласованные отсутствия</div>
    </div>
    <div class="sort-toggle" role="group" aria-label="Сортировка нарушений">
      <button class:active={sort === 'name'} onclick={() => (sort = 'name')}>по ФИО</button>
      <button class:active={sort === 'dept'} onclick={() => (sort = 'dept')}>по отделу</button>
    </div>
  </div>

  {#if total === 0}
    <div class="empty">Нарушений нет</div>
  {:else}
    <div class="violation-list">
      {#each visible as item (item.employeeId + '-' + item.date + '-' + item.kind)}
        <button class="violation-row" onclick={() => onOpenEmployee(item.employeeId)}>
          <span class="v-main">
            <span class="v-name">{item.fullName}</span>
            <span class="v-dept">{item.deptName}</span>
            <span class="v-tags">
              {#if item.kind === 'late'}
                <span class="badge badge-late">Опоздание</span>
                <span class="v-detail">
                  {item.firstIn ?? '—'}
                  {#if item.lateMinutes != null}· +{item.lateMinutes} мин{/if}
                </span>
              {:else}
                <span class="badge badge-absence">Отсутствие</span>
                <span class="v-detail">{absenceText(item)}</span>
                {#if !item.approved}
                  <span class="badge badge-absence">Несогласовано</span>
                {/if}
              {/if}
            </span>
          </span>
          <span class="v-right">{formatRuDate(item.date)}</span>
        </button>
      {/each}
    </div>

    {#if total > 10}
      <button class="show-all" onclick={onOpenAll}>Показать все ({total})</button>
    {/if}
  {/if}
</section>

<style>
  .violations-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .violations-panel .panel-head {
    flex: none;
  }

  .sort-toggle {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
    flex: none;
  }

  .sort-toggle button {
    border: 0;
    background: var(--surface);
    padding: 5px 8px;
    font-size: 11px;
    color: var(--muted);
  }

  .sort-toggle button + button {
    border-left: 1px solid var(--line);
  }

  .sort-toggle button.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }

  .violation-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
    scrollbar-width: thin;
  }

  .violation-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 8px;
    flex: none;
    width: 100%;
    border: 0;
    background: none;
    border-radius: 9px;
    padding: 8px;
    text-align: left;
  }

  .violation-row:hover {
    background: var(--surface-soft);
  }

  .v-main {
    min-width: 0;
  }

  .v-name {
    display: block;
    font-size: 13px;
    font-weight: 550;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .v-dept {
    display: block;
    font-size: 11px;
    color: var(--muted);
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .v-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 5px;
  }

  .v-detail {
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .v-right {
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
    padding-top: 2px;
  }

  .show-all {
    flex: none;
    margin-top: 8px;
    border: 0;
    background: none;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--accent);
    text-align: left;
  }

  .show-all:hover {
    text-decoration: underline;
  }
</style>
