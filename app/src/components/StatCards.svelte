<script lang="ts">
  import { formatNumber, formatPercent } from '../lib/engine';
  import type { CardStats, ViewName } from '../lib/types';

  let {
    stats,
    dateLabel,
    onOpenView,
  }: {
    stats: CardStats;
    dateLabel: string;
    onOpenView: (view: ViewName) => void;
  } = $props();

  interface StatCard {
    key: string;
    label: string;
    value: string;
    hint: string;
    view: ViewName | null;
    tone: 'neutral' | 'bad' | 'good' | 'accent' | 'warn';
  }

  const cards = $derived<StatCard[]>([
    {
      key: 'employees',
      label: 'Всего сотрудников',
      value: formatNumber(stats.employees),
      hint: dateLabel,
      view: 'employees',
      tone: 'neutral',
    },
    {
      key: 'in-office',
      label: 'В офисе сейчас',
      value: formatNumber(stats.inOffice),
      hint: dateLabel,
      view: 'in-office',
      tone: 'good',
    },
    {
      key: 'attendance',
      label: 'Вышли на работу',
      value: formatNumber(stats.attendance),
      hint: 'сотрудников с входом',
      view: 'attendance',
      tone: 'neutral',
    },
    {
      key: 'absences-approved',
      label: 'Уважительные отсутствия',
      value: formatNumber(stats.approvedAbsenceDays),
      hint: 'сотрудников с согласованием',
      view: 'absences-approved',
      tone: 'neutral',
    },
    {
      key: 'late',
      label: 'Опоздания',
      value: formatNumber(stats.lateDays),
      hint: 'сотрудников с опозданием',
      view: 'late',
      tone: 'warn',
    },
    {
      key: 'absences',
      label: 'Отсутствия',
      value: formatNumber(stats.absenceDays),
      hint: 'сотрудников без входа',
      view: 'absences',
      tone: stats.absenceDays > 0 ? 'bad' : 'good',
    },
    {
      key: 'expected',
      label: 'Не пришли по графику',
      value: formatNumber(stats.expected),
      hint: 'по графику, входа нет',
      view: 'expected',
      tone: 'neutral',
    },
    {
      key: 'discipline',
      label: 'Дисциплина',
      value: formatPercent(stats.discipline),
      hint: stats.disciplineHint ?? 'плановые дни без нарушений',
      view: null,
      tone: 'accent',
    },
  ]);

  function open(card: StatCard) {
    if (card.view) onOpenView(card.view);
  }
</script>

<div class="cards">
  {#each cards as card (card.key)}
    {#if card.view}
      <button
        class="card stat-card"
        class:bad={card.tone === 'bad'}
        class:good={card.tone === 'good'}
        class:warn={card.tone === 'warn'}
        class:accent={card.tone === 'accent'}
        onclick={() => open(card)}
        aria-label={`${card.label}: ${card.value}. Открыть список`}
      >
        <span class="card-label">{card.label}</span>
        <span class="card-value">{card.value}</span>
        <span class="card-hint">{card.hint}</span>
        <span class="arrow" aria-hidden="true">↗</span>
      </button>
    {:else}
      <div
        class="card stat-card static"
        class:bad={card.tone === 'bad'}
        class:good={card.tone === 'good'}
        class:warn={card.tone === 'warn'}
        class:accent={card.tone === 'accent'}
      >
        <span class="card-label">{card.label}</span>
        <span class="card-value">{card.value}</span>
        <span class="card-hint">{card.hint}</span>
      </div>
    {/if}
  {/each}
</div>

<style>
  .stat-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 100%;
    min-height: 106px;
    transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
  }

  button.stat-card:hover {
    transform: translateY(-1px);
    border-color: var(--accent);
    box-shadow: 0 6px 18px rgba(16, 24, 40, 0.08);
  }

  .stat-card.static {
    cursor: default;
  }

  .stat-card .card-label,
  .stat-card .card-value,
  .stat-card .card-hint {
    width: 100%;
  }

  .stat-card .card-value {
    line-height: 1.15;
  }

  .stat-card.bad .card-value {
    color: var(--rose);
  }

  .stat-card.good .card-value {
    color: var(--ok);
  }

  .stat-card.warn .card-value {
    color: var(--amber);
  }

  .stat-card.accent .card-value {
    color: var(--accent);
  }

  .arrow {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 12px;
    color: var(--muted);
    opacity: 0;
    transition: opacity 0.12s ease;
  }

  button.stat-card:hover .arrow {
    opacity: 1;
  }
</style>
