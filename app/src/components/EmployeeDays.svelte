<script lang="ts">
  import { absenceLabel, formatHours, formatRuDate } from '../lib/engine';
  import type { EmployeeDaysData } from '../lib/types';

  let { data }: { data: EmployeeDaysData } = $props();

  const dayLabel = $derived(
    data.days.length > 0
      ? `${formatRuDate(data.days[0].date)} ${data.days[0].date.slice(0, 4)}`
      : null,
  );

  function statusTone(status: string): string {
    if (status === 'Опоздание') return 'late';
    if (status === 'Отсутствие') return 'absence';
    if (status === 'Уважительная') return 'approved';
    if (status === 'Ранний уход') return 'early';
    if (status === 'Нет СКУД' || status === 'Выходной') return 'muted';
    return 'ok';
  }

  function duration(seconds: number | null): string {
    if (!seconds) return '—';
    return `${formatHours(seconds / 3600)} ч`;
  }
</script>

<div class="employee-head">
  <div>
    <div class="employee-name">{data.employee.fullName}</div>
    <div class="employee-meta">
      {data.deptName} · {data.employee.position} · {data.scheduleLabel}
    </div>
    <div class="employee-badges">
      {#if data.employee.hasScud}
        <span class="badge badge-ok">СКУД активен</span>
      {:else}
        <span class="badge badge-muted">Нет СКУД</span>
      {/if}
      <span class="badge badge-muted">
        план {data.employee.plannedArrival}–{data.employee.plannedDeparture}
      </span>
    </div>
  </div>
  <div class="day-badge">{dayLabel ?? 'Нет данных'}</div>
</div>

<div class="table-wrap">
  <table class="data-table days-table">
    <colgroup>
      <col />
      <col />
      <col />
      <col />
      <col />
      <col class="c-wide" />
      <col />
    </colgroup>
    <thead>
      <tr>
        <th>Дата</th>
        <th>Вход</th>
        <th>Выход</th>
        <th>Отработано</th>
        <th>Опоздание</th>
        <th>Отсутствие</th>
        <th>Статус</th>
      </tr>
    </thead>
    <tbody>
      {#each data.days as day (day.date)}
        <tr class:weekend={!day.isWorkday}>
          <td class="date-cell">{formatRuDate(day.date)}</td>
          <td>{day.firstIn ?? '—'}</td>
          <td>{day.lastOut ?? '—'}</td>
          <td>{duration(day.durationSec)}</td>
          <td>
            {#if day.isLate}
              <span class="badge badge-late">+{day.lateMinutes ?? 0} мин</span>
            {:else}
              —
            {/if}
          </td>
          <td>
            {#if day.absenceType}
              <span class="absence-text">{absenceLabel(day.absenceType)}</span>
              {#if day.absenceApproved}
                <span class="badge badge-ok">согласовано</span>
              {:else}
                <span class="badge badge-absence">несогласовано</span>
              {/if}
            {:else}
              —
            {/if}
          </td>
          <td><span class="status {statusTone(day.status)}">{day.status}</span></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if data.days.length === 0}
  <div class="empty">За выбранный день нет данных</div>
{/if}

<style>
  .employee-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 4px 2px 14px;
  }

  .employee-name {
    font-size: 18px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .employee-meta {
    margin-top: 2px;
    font-size: 12px;
    color: var(--muted);
  }

  .employee-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 7px;
  }

  .day-badge {
    flex: none;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    background: var(--surface-soft);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 3px 10px;
  }

  .table-wrap {
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: auto;
    max-height: calc(100vh - 330px);
  }

  .days-table {
    table-layout: fixed;
    width: 100%;
    min-width: 760px;
  }

  .c-wide {
    width: 22%;
  }

  .days-table th,
  .days-table td {
    text-align: center;
  }

  .date-cell {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .weekend {
    color: var(--muted);
    background: var(--surface-soft);
  }

  .absence-text {
    margin-right: 4px;
  }

  .status {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11px;
    white-space: nowrap;
  }

  .status.ok {
    background: var(--ok-soft);
    color: var(--ok);
  }

  .status.late {
    background: var(--amber-soft);
    color: var(--amber);
  }

  .status.absence {
    background: var(--rose-soft);
    color: var(--rose);
  }

  .status.approved {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .status.early {
    background: var(--amber-soft);
    color: var(--amber);
  }

  .status.muted {
    background: var(--surface-soft);
    color: var(--muted);
  }
</style>
