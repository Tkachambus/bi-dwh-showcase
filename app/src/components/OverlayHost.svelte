<script lang="ts">
  import { onMount } from 'svelte';
  import EmployeeDays from './EmployeeDays.svelte';
  import {
    absenceLabel,
    formatHours,
    formatPeriodLabel,
    formatRuDate,
    scheduleLabel,
  } from '../lib/engine';
  import type {
    EmployeeDaysData,
    OverlayData,
    OverlayRow,
    ViewName,
  } from '../lib/types';

  let {
    view,
    eid,
    overlay,
    employeeDays,
    dateFrom,
    dateTo,
    onClose,
    onBack,
    onOpenEmployee,
  }: {
    view: ViewName | null;
    eid: number | null;
    overlay: OverlayData | null;
    employeeDays: EmployeeDaysData | null;
    dateFrom: string;
    dateTo: string;
    onClose: () => void;
    onBack: () => void;
    onOpenEmployee: (employeeId: number) => void;
  } = $props();

  let search = $state('');
  let sort = $state<'date' | 'name' | 'dept'>('date');
  let limit = $state(20);
  let panel: HTMLDivElement;

  $effect(() => {
    void view;
    void eid;
    search = '';
    sort =
      view === 'employees' || view === 'in-office' || view === 'expected'
        ? 'name'
        : 'date';
    limit = 20;
  });

  const rows = $derived(overlay?.rows ?? []);

  const filtered = $derived.by(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? rows.filter(
          (row) =>
            row.fullName.toLowerCase().includes(query) ||
            row.deptName.toLowerCase().includes(query),
        )
      : [...rows];
    list.sort((a, b) => {
      if (sort === 'name') return a.fullName.localeCompare(b.fullName);
      if (sort === 'dept') {
        return a.deptName.localeCompare(b.deptName) || a.fullName.localeCompare(b.fullName);
      }
      return (b.date ?? '').localeCompare(a.date ?? '') || a.fullName.localeCompare(b.fullName);
    });
    return list;
  });

  const visible = $derived(filtered.slice(0, limit));
  const title = $derived(employeeDays ? 'Дни сотрудника' : (overlay?.title ?? 'Список'));
  const count = $derived(employeeDays ? employeeDays.days.length : (overlay?.total ?? 0));

  function trapFocus(event: KeyboardEvent) {
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab') trapFocus(event);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  });

  function duration(seconds: number | null | undefined): string {
    if (!seconds) return '—';
    return `${formatHours(seconds / 3600)} ч`;
  }

  function openRow(row: OverlayRow) {
    onOpenEmployee(row.employeeId);
  }

  function statusBadge(row: OverlayRow): string {
    if (!row.hasScud) return 'Нет СКУД';
    if (row.isLate) return 'Опоздание';
    if (row.absenceType) return row.approved ? 'Согласовано' : 'Несогласовано';
    return 'В норме';
  }
</script>

<div
  class="overlay"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}
>
  <div
    class="overlay-panel"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    bind:this={panel}
    tabindex="-1"
  >
    <header class="overlay-head">
      <div>
        <h2>{title}</h2>
        <div class="overlay-sub">
          {formatPeriodLabel(dateFrom, dateTo)} · {count} записей
        </div>
      </div>
      <div class="overlay-actions">
        {#if eid != null && view != null}
          <button class="ghost-button" onclick={onBack}>← К списку</button>
        {/if}
        <button class="close-btn" onclick={onClose} aria-label="Закрыть">×</button>
      </div>
    </header>

    {#if employeeDays}
      <div class="overlay-body employee-body">
        <EmployeeDays data={employeeDays} />
      </div>
    {:else if overlay}
      <div class="overlay-toolbar">
        <input
          class="search"
          bind:value={search}
          placeholder="Поиск по ФИО или отделу"
          aria-label="Поиск по ФИО или отделу"
        />
        <select bind:value={sort} aria-label="Сортировка">
          <option value="date">по дате</option>
          <option value="name">по ФИО</option>
          <option value="dept">по отделу</option>
        </select>
        <span class="count">{filtered.length} из {overlay.total}</span>
      </div>

      <div class="overlay-body">
        <table class="data-table">
          <thead>
            {#if view === 'employees'}
              <tr>
                <th>ФИО</th>
                <th>Отдел</th>
                <th>Должность</th>
                <th class="fit">График</th>
                <th class="fit">СКУД</th>
              </tr>
            {:else if view === 'in-office'}
              <tr>
                <th>ФИО</th>
                <th>Отдел</th>
                <th class="fit">Вход</th>
              </tr>
            {:else if view === 'attendance'}
              <tr>
                <th>ФИО</th>
                <th>Отдел</th>
                <th class="fit">Дата</th>
                <th class="fit">Вход</th>
                <th class="fit">Выход</th>
                <th class="fit num">Отработано</th>
              </tr>
            {:else if view === 'late'}
              <tr>
                <th>ФИО</th>
                <th>Отдел</th>
                <th class="fit">Дата</th>
                <th class="fit">Вход</th>
                <th class="fit">Опоздание</th>
              </tr>
            {:else if view === 'absences' || view === 'absences-approved'}
              <tr>
                <th>ФИО</th>
                <th>Отдел</th>
                <th class="fit">Дата</th>
                <th class="fit">Тип</th>
                <th class="fit">Статус</th>
              </tr>
            {:else if view === 'expected'}
              <tr>
                <th>ФИО</th>
                <th>Отдел</th>
                <th class="fit">График</th>
                <th class="fit">План</th>
              </tr>
            {:else}
              <tr>
                <th>ФИО</th>
                <th>Отдел</th>
                <th class="fit">Дата</th>
                <th class="fit">Тип</th>
                <th>Детали</th>
              </tr>
            {/if}
          </thead>
          <tbody>
            {#each visible as row (row.employeeId + '-' + (row.date ?? '') + '-' + (row.isLate ? 'l' : 'a'))}
              <tr>
                <td>
                  <button class="link-button" onclick={() => openRow(row)}>{row.fullName}</button>
                </td>
                <td>{row.deptName}</td>

                {#if view === 'employees'}
                  <td>{row.position || '—'}</td>
                  <td class="fit">{scheduleLabel(row.scheduleType)}</td>
                  <td class="fit">
                    {#if row.hasScud}
                      <span class="badge badge-ok">активен</span>
                    {:else}
                      <span class="badge badge-muted">Нет СКУД</span>
                    {/if}
                  </td>
                {:else if view === 'in-office'}
                  <td class="fit">{row.ts ?? '—'}</td>
                {:else if view === 'attendance'}
                  <td class="fit">{row.date ? formatRuDate(row.date) : '—'}</td>
                  <td class="fit">{row.firstIn ?? '—'}</td>
                  <td class="fit">{row.lastOut ?? '—'}</td>
                  <td class="fit num">{duration(row.durationSec)}</td>
                {:else if view === 'late'}
                  <td class="fit">{row.date ? formatRuDate(row.date) : '—'}</td>
                  <td class="fit">{row.firstIn ?? '—'}</td>
                  <td class="fit"><span class="badge badge-late">+{row.lateMinutes ?? 0} мин</span></td>
                {:else if view === 'absences' || view === 'absences-approved'}
                  <td class="fit">{row.date ? formatRuDate(row.date) : '—'}</td>
                  <td class="fit">{row.absenceType ? absenceLabel(row.absenceType) : 'Без записи'}</td>
                  <td class="fit">
                    {#if row.approved}
                      <span class="badge badge-ok">Согласовано</span>
                    {:else}
                      <span class="badge badge-absence">Несогласовано</span>
                    {/if}
                  </td>
                {:else if view === 'expected'}
                  <td class="fit">{scheduleLabel(row.scheduleType)}</td>
                  <td class="fit muted">по графику, входа нет</td>
                {:else}
                  <td class="fit">{row.date ? formatRuDate(row.date) : '—'}</td>
                  <td class="fit">
                    {#if row.isLate}
                      <span class="badge badge-late">Опоздание</span>
                    {:else}
                      <span class="badge badge-absence">Отсутствие</span>
                    {/if}
                  </td>
                  <td>
                    {#if row.isLate}
                      {row.firstIn ?? '—'} · +{row.lateMinutes ?? 0} мин
                    {:else}
                      {absenceLabel(row.absenceType)}
                      {#if !row.approved}
                        <span class="badge badge-absence">Несогласовано</span>
                      {/if}
                    {/if}
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>

        {#if visible.length === 0}
          <div class="empty">Ничего не найдено</div>
        {/if}

        {#if filtered.length > limit}
          <button class="show-more" onclick={() => (limit += 20)}>
            Показать ещё 20 из {filtered.length - limit}
          </button>
        {/if}
      </div>
    {:else}
      <div class="empty">Нет данных для этого представления</div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 88px 32px 52px;
    background: rgba(12, 18, 26, 0.45);
  }

  .overlay-panel {
    width: min(1100px, calc(100vw - 64px));
    max-height: calc(100vh - 140px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
    border-radius: 14px;
    box-shadow: 0 24px 80px rgba(12, 18, 26, 0.32);
    outline: none;
  }

  .overlay-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--line);
  }

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 650;
  }

  .overlay-sub {
    margin-top: 2px;
    font-size: 12px;
    color: var(--muted);
  }

  .overlay-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: var(--muted);
    font-size: 20px;
    line-height: 1;
    display: grid;
    place-items: center;
  }

  .close-btn:hover {
    background: var(--surface-soft);
    color: var(--text);
  }

  .overlay-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }

  .search {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 32px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0 10px;
    font-size: 12px;
    outline: none;
  }

  .search:focus {
    border-color: var(--accent);
  }

  .overlay-toolbar select {
    flex: none;
    width: auto;
    min-height: 32px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0 26px 0 10px;
    font-size: 12px;
    line-height: 30px;
    color: var(--text);
    background-color: var(--surface);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%236b7a8d' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 12px 12px;
    appearance: none;
    -webkit-appearance: none;
  }

  .count {
    flex: none;
    min-width: 72px;
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
    text-align: right;
  }

  .overlay-body .data-table {
    table-layout: fixed;
    width: 100%;
    min-width: 0;
  }

  .overlay-body .data-table th,
  .overlay-body .data-table td {
    text-align: center;
    white-space: nowrap;
  }

  .overlay-body .data-table th:first-child,
  .overlay-body .data-table td:first-child,
  .overlay-body .data-table th:nth-child(2),
  .overlay-body .data-table td:nth-child(2) {
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fit,
  .fit.num {
    width: auto;
    text-align: center;
  }

  .overlay-body {
    overflow: auto;
    padding: 0 18px 18px;
  }

  .employee-body {
    padding-top: 14px;
  }

  .data-table {
    min-width: 760px;
  }

  .show-more {
    margin: 10px 0 2px;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    color: var(--accent);
  }

  .show-more:hover {
    background: var(--surface-soft);
  }
</style>
