<script lang="ts">
  import { onMount } from 'svelte';
  import { formatRuDate } from '../lib/engine';

  let {
    periodLabel,
    scopeName,
    absences,
    today,
  }: {
    periodLabel: string;
    scopeName: string;
    absences: number;
    today: string;
  } = $props();

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  let open = $state(false);
  let root: HTMLDivElement;

  const cursorDate = $derived(new Date(`${today}T00:00:00Z`));
  const year = $derived(cursorDate.getUTCFullYear());
  const month = $derived(cursorDate.getUTCMonth());
  const firstWeekday = $derived(
    (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7,
  );
  const daysInMonth = $derived(new Date(Date.UTC(year, month + 1, 0)).getUTCDate());

  const monthLabel = $derived.by(() => {
    const label = new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(cursorDate);
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  const cells = $derived.by(() => {
    const out: Array<string | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) out.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      out.push(`${today.slice(0, 7)}-${String(d).padStart(2, '0')}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  });

  onMount(() => {
    const onDoc = (event: MouseEvent) => {
      if (!open) return;
      if (root && !root.contains(event.target as Node)) open = false;
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  });
</script>

<header class="dash-head">
  <div class="title-wrap">
    <h1>Обзор</h1>
    <span class="scope-chip" title="Текущий scope">{scopeName}</span>
  </div>

  <div class="controls" bind:this={root}>
    <div class="period-wrap">
      <button
        class="period-btn"
        class:open
        onclick={() => (open = !open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Дата фиксирована"
      >
        <span class="cal-ico">▤</span>
        <span class="period-text">{periodLabel}</span>
        <span class="chev">▾</span>
      </button>

      {#if open}
        <div class="calendar-popover" role="dialog" aria-label="Дата отчёта">
          <div class="calendar-head">
            <span class="month-label">{monthLabel}</span>
          </div>

          <div class="weekdays">
            {#each weekdays as weekday}
              <span>{weekday}</span>
            {/each}
          </div>

          <div class="calendar-grid">
            {#each cells as date}
              {#if date}
                <span
                  class="day"
                  class:selected={date === today}
                  class:muted={date !== today}
                  aria-current={date === today ? 'date' : undefined}
                  title={date === today ? 'Дата отчёта' : 'Данные только за выбранный день'}
                >
                  {Number(date.slice(8, 10))}
                </span>
              {:else}
                <span class="day blank"></span>
              {/if}
            {/each}
          </div>

          <div class="calendar-foot">
            <span class="range-caption">
              Данные только за {formatRuDate(today)}
            </span>
            <button class="ghost-button" onclick={() => (open = false)}>Закрыть</button>
          </div>
        </div>
      {/if}
    </div>

    <span class="absence-badge" class:has={absences > 0}>
      {absences} отсутствий
    </span>
  </div>
</header>

<style>
  .dash-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 0 14px;
  }

  .title-wrap {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  .scope-chip {
    font-size: 12px;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 1px 9px;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  .period-wrap {
    position: relative;
  }

  .period-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 0 11px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--surface);
    font-size: 13px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  }

  .period-btn:hover,
  .period-btn.open {
    border-color: var(--accent);
  }

  .cal-ico {
    color: var(--accent);
  }

  .period-text {
    font-weight: 550;
  }

  .chev {
    color: var(--muted);
    font-size: 11px;
  }

  .absence-badge {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 11px;
    border-radius: 999px;
    background: var(--surface-soft);
    color: var(--muted);
    border: 1px solid var(--line);
    font-size: 12px;
    white-space: nowrap;
  }

  .absence-badge.has {
    background: var(--rose-soft);
    color: var(--rose);
    border-color: transparent;
    font-weight: 600;
  }

  .calendar-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 304px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 18px 48px rgba(16, 24, 40, 0.18);
    padding: 12px;
    z-index: 60;
  }

  .calendar-head {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }

  .month-label {
    font-size: 13px;
    font-weight: 600;
  }

  .weekdays,
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .weekdays {
    margin-bottom: 4px;
  }

  .weekdays span {
    text-align: center;
    font-size: 11px;
    color: var(--muted);
    padding: 2px 0;
  }

  .day {
    display: grid;
    place-items: center;
    height: 32px;
    border-radius: 8px;
    font-size: 12px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    cursor: default;
  }

  .day.muted {
    color: var(--muted);
    opacity: 0.5;
  }

  .day.selected {
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    opacity: 1;
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  .day.blank {
    pointer-events: none;
  }

  .calendar-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }

  .range-caption {
    font-size: 11px;
    color: var(--muted);
  }
</style>
