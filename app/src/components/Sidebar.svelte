<script lang="ts">
  import { onMount } from 'svelte';

  let { base }: { base: string } = $props();
  let collapsed = $state(false);

  function apply() {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
  }

  function toggle() {
    collapsed = !collapsed;
    localStorage.setItem('pulse-sidebar', collapsed ? '1' : '0');
    apply();
  }

  onMount(() => {
    collapsed = localStorage.getItem('pulse-sidebar') === '1';
    apply();
  });

  // svelte-ignore state_referenced_locally
  const root = base.endsWith('/') ? base : `${base}/`;
</script>

<aside class="sidebar" class:collapsed>
  <div class="brand" title="Pulse Board">
    <span class="mark">P</span>
    {#if !collapsed}
      <span class="brand-text">Pulse <b>Board</b></span>
    {/if}
  </div>

  <nav aria-label="Разделы">
    <a class="nav-item active" href={root} aria-current="page" title="Обзор">
      <span class="ico">▦</span>
      {#if !collapsed}<span>Обзор</span>{/if}
    </a>
    <span class="nav-item disabled" title="В демо не входит" aria-disabled="true">
      <span class="ico">⚑</span>
      {#if !collapsed}<span>Нарушения</span>{/if}
    </span>
    <span class="nav-item disabled" title="В демо не входит" aria-disabled="true">
      <span class="ico">◇</span>
      {#if !collapsed}<span>Сотрудники</span>{/if}
    </span>
    <span class="nav-item disabled" title="В демо не входит" aria-disabled="true">
      <span class="ico">▤</span>
      {#if !collapsed}<span>Департаменты</span>{/if}
    </span>
  </nav>

  <div class="sidebar-foot">
    {#if !collapsed}
      <span class="foot-note">демо на синтетике</span>
    {/if}
    <button class="collapse" onclick={toggle} aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}>
      {collapsed ? '›' : '‹'}
    </button>
  </div>
</aside>

<style>
  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    width: 100%;
    background: var(--surface);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 18px 12px;
    overflow: hidden;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 32px;
    padding: 0 4px;
  }

  .mark {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: var(--accent);
    color: #fff;
    font-weight: 700;
    display: grid;
    place-items: center;
    font-size: 16px;
    flex: none;
  }

  .brand-text {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
  }

  .brand-text b {
    color: var(--accent);
    font-weight: 600;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
    padding: 0 10px;
    border-radius: 9px;
    color: var(--muted);
    text-decoration: none;
    font-size: 13px;
    white-space: nowrap;
  }

  .nav-item.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }

  .nav-item.disabled {
    opacity: 0.55;
  }

  .ico {
    width: 16px;
    text-align: center;
    flex: none;
    font-size: 14px;
  }

  .sidebar-foot {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 4px;
  }

  .foot-note {
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
  }

  .collapse {
    width: 30px;
    height: 30px;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 8px;
    color: var(--muted);
    display: grid;
    place-items: center;
    font-size: 18px;
    line-height: 1;
    flex: none;
  }

  .collapse:hover {
    background: var(--surface-soft);
    color: var(--text);
  }

  .collapsed {
    padding-inline: 13px;
  }

  .collapsed .brand {
    justify-content: center;
    padding: 0;
  }

  .collapsed .nav-item {
    justify-content: center;
    padding: 0;
  }

  .collapsed .sidebar-foot {
    justify-content: center;
  }
</style>
