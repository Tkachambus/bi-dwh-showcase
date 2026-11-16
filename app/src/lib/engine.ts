import type {
  CardStats,
  Crumb,
  DashboardState,
  DayTuple,
  Department,
  Employee,
  EmployeeDay,
  EmployeeDaysData,
  HistoryStep,
  OfficeNow,
  OverlayData,
  OverlayRow,
  OverviewData,
  RatingRow,
  ScheduleType,
  Snapshot,
  SummaryRow,
  ViewName,
  ViolationItem,
} from './types';

const DAY_MS = 86_400_000;
const ALL_VIEWS: ViewName[] = [
  'employees',
  'in-office',
  'attendance',
  'absences-approved',
  'late',
  'absences',
  'expected',
  'violations',
];
const VIEW_SET = new Set<string>(ALL_VIEWS);
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  office: 'Офис',
  remote: 'Удалённо',
  field: 'Выездной',
  shift: 'Сменный',
};

export const ABSENCE_LABELS: Record<string, string> = {
  vacation: 'Отпуск',
  sick: 'Больничный',
  remote: 'Удалёнка',
};

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function formatRuDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatPeriodLabel(from: string, to: string): string {
  if (from === to) {
    const d = new Date(`${from}T00:00:00Z`);
    return `${formatRuDate(from)} ${d.getUTCFullYear()}`;
  }
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) {
    return `${formatRuDate(from)} ${a.getUTCFullYear()} – ${formatRuDate(to)} ${b.getUTCFullYear()}`;
  }
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  }
  return `${formatRuDate(from)} – ${formatRuDate(to)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function formatPercent(value: number | null): string {
  if (value == null) return '—';
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export function formatHours(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatHours(value)}`;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function parseHistory(raw: string | null): HistoryStep[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is HistoryStep =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as HistoryStep).l === 'number' &&
          ((item as HistoryStep).n === null || typeof (item as HistoryStep).n === 'number'),
      )
      .slice(-20)
      .map((item) => ({ l: item.l, n: item.n }));
  } catch {
    return [];
  }
}

export function parseState(
  input: URLSearchParams | string,
  snapshot: Snapshot,
): DashboardState {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input;
  // Демо построено на одном фиксированном дне из снапшота: диапазоны и
  // произвольные даты в URL игнорируются, чтобы метрики всегда были полными.
  const today = snapshot.today;
  const dateFrom = today;
  const dateTo = today;
  const singleDate = true;

  const deptIds = new Set(snapshot.departments.map((d) => d.id));
  const rawNode = Number(params.get('node'));
  let node: number | null =
    Number.isInteger(rawNode) && deptIds.has(rawNode) ? rawNode : null;

  const levelRaw = Number(params.get('level'));
  let level =
    Number.isInteger(levelRaw) && levelRaw >= 2 && levelRaw <= 5 ? levelRaw : 2;
  if (node != null) {
    const dept = snapshot.departments.find((d) => d.id === node);
    if (dept) {
      const depth = deptDepth(snapshot, dept.id);
      level = Math.min(5, depth + 2);
    }
  }

  const rawView = params.get('view');
  const view = rawView && VIEW_SET.has(rawView) ? (rawView as ViewName) : null;

  const empIds = new Set(snapshot.employees.map((e) => e.id));
  const rawEid = Number(params.get('eid'));
  const eid = Number.isInteger(rawEid) && empIds.has(rawEid) ? rawEid : null;

  return {
    dateFrom,
    dateTo,
    singleDate,
    level,
    node,
    history: parseHistory(params.get('h')),
    view,
    eid,
  };
}

export function stateToSearch(state: DashboardState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('date', state.dateFrom);
  if (state.node != null) params.set('node', String(state.node));
  if (state.history.length > 0) params.set('h', JSON.stringify(state.history));
  if (state.view) params.set('view', state.view);
  if (state.eid != null) params.set('eid', String(state.eid));
  return params;
}

function deptDepth(snapshot: Snapshot, id: number): number {
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

interface Ctx {
  snapshot: Snapshot;
  deptById: Map<number, Department>;
  empById: Map<number, Employee>;
  children: Map<number | null, Department[]>;
  byLevel: Map<number, Department[]>;
  levelOf: Map<number, number>;
  paths: Map<number, string[]>;
  chain: Map<number, Department[]>;
  subtreeIds: Map<number, Set<number>>;
  subtreeEmployees: Map<number, Employee[]>;
  employeesByDept: Map<number, Employee[]>;
  allEmployees: Employee[];
  dayByKey: Map<string, DayTuple>;
  workday: Map<string, boolean>;
  officeNowIds: Set<number>;
}

const ctxCache = new WeakMap<Snapshot, Ctx>();

function buildCtx(snapshot: Snapshot): Ctx {
  const cached = ctxCache.get(snapshot);
  if (cached) return cached;

  const deptById = new Map<number, Department>();
  const empById = new Map<number, Employee>();
  const children = new Map<number | null, Department[]>();
  const byLevel = new Map<number, Department[]>();
  const levelOf = new Map<number, number>();
  const paths = new Map<number, string[]>();
  const chain = new Map<number, Department[]>();

  for (const d of snapshot.departments) deptById.set(d.id, d);
  for (const e of snapshot.employees) empById.set(e.id, e);

  for (const d of snapshot.departments) {
    const siblings = children.get(d.parentId) ?? [];
    siblings.push(d);
    children.set(d.parentId, siblings);

    const ancestors: Department[] = [];
    let cur: Department | undefined = d;
    const seen = new Set<number>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      ancestors.unshift(cur);
      cur = cur.parentId != null ? deptById.get(cur.parentId) : undefined;
    }
    levelOf.set(d.id, ancestors.length + 1);
    paths.set(d.id, ancestors.map((x) => x.name));
    chain.set(d.id, ancestors);
    const levelRows = byLevel.get(ancestors.length + 1) ?? [];
    levelRows.push(d);
    byLevel.set(ancestors.length + 1, levelRows);
  }

  const subtreeIds = new Map<number, Set<number>>();
  for (const d of snapshot.departments) subtreeIds.set(d.id, new Set([d.id]));
  for (const d of snapshot.departments) {
    let parent = d.parentId;
    while (parent != null) {
      subtreeIds.get(parent)?.add(d.id);
      parent = deptById.get(parent)?.parentId ?? null;
    }
  }

  const allEmployees = snapshot.employees.filter((e) => e.isActive);
  const employeesByDept = new Map<number, Employee[]>();
  for (const e of allEmployees) {
    const list = employeesByDept.get(e.deptId) ?? [];
    list.push(e);
    employeesByDept.set(e.deptId, list);
  }

  const dayByKey = new Map<string, DayTuple>();
  for (const row of snapshot.days) dayByKey.set(`${row[0]}|${row[2]}`, row);

  const workday = new Map<string, boolean>();
  for (const [date, isWorkday] of snapshot.calendar) workday.set(date, isWorkday === 1);

  const ctx: Ctx = {
    snapshot,
    deptById,
    empById,
    children,
    byLevel,
    levelOf,
    paths,
    chain,
    subtreeIds,
    subtreeEmployees: new Map(),
    employeesByDept,
    allEmployees,
    dayByKey,
    workday,
    officeNowIds: new Set(snapshot.officeNow.map((o) => o.employeeId)),
  };
  ctxCache.set(snapshot, ctx);
  return ctx;
}

function isWorkday(ctx: Ctx, date: string): boolean {
  const known = ctx.workday.get(date);
  return known === undefined ? !isWeekend(date) : known;
}

function employeesInSubtree(ctx: Ctx, deptId: number): Employee[] {
  const cached = ctx.subtreeEmployees.get(deptId);
  if (cached) return cached;
  const ids = ctx.subtreeIds.get(deptId) ?? new Set([deptId]);
  const out: Employee[] = [];
  for (const id of ids) out.push(...(ctx.employeesByDept.get(id) ?? []));
  ctx.subtreeEmployees.set(deptId, out);
  return out;
}

interface EmpStats {
  planned: number;
  late: number;
  unapproved: number;
  lateDays: number;
  absenceDays: number;
  approvedDays: number;
  workedSec: number;
  hadEntry: boolean;
  expectedToday: boolean;
}

function computeStats(
  ctx: Ctx,
  dates: string[],
  disciplineDates: string[],
): Map<number, EmpStats> {
  const disciplineSet = new Set(disciplineDates);
  const today = ctx.snapshot.today;
  const stats = new Map<number, EmpStats>();

  for (const emp of ctx.allEmployees) {
    const row: EmpStats = {
      planned: 0,
      late: 0,
      unapproved: 0,
      lateDays: 0,
      absenceDays: 0,
      approvedDays: 0,
      workedSec: 0,
      hadEntry: false,
      expectedToday: false,
    };

    for (const date of dates) {
      const day = ctx.dayByKey.get(`${emp.id}|${date}`);
      const scud = day ? day[11] === 1 : emp.hasScud;
      if (!scud) continue;

      const schedule = day ? day[12] : emp.scheduleType;
      const firstIn = day?.[3] ?? null;
      const absenceType = day?.[9] ?? null;
      const approved = day?.[10] === 1;
      const late = day?.[6] === 1;
      const duration = day?.[5] ?? 0;
      const workday = isWorkday(ctx, date);
      const hasApprovedAbsence = approved && absenceType != null;

      if (duration > 0) row.workedSec += duration;
      if (firstIn) row.hadEntry = true;
      if (late) row.lateDays += 1;
      if (hasApprovedAbsence) row.approvedDays += 1;
      if (workday && !firstIn && !hasApprovedAbsence) row.absenceDays += 1;

      if (
        date === today &&
        workday &&
        (schedule === 'office' || schedule === 'shift') &&
        !firstIn &&
        !hasApprovedAbsence
      ) {
        row.expectedToday = true;
      }

      if (
        disciplineSet.has(date) &&
        workday &&
        (schedule === 'office' || schedule === 'shift') &&
        !hasApprovedAbsence
      ) {
        row.planned += 1;
        if (firstIn) {
          if (late) row.late += 1;
        } else {
          row.unapproved += 1;
        }
      }
    }

    stats.set(emp.id, row);
  }

  return stats;
}

interface Agg {
  headcount: number;
  planned: number;
  late: number;
  unapproved: number;
  lateDays: number;
  absenceDays: number;
  approvedDays: number;
  workedSec: number;
  attendance: number;
  expected: number;
  discipline: number | null;
}

function aggregate(employees: Employee[], stats: Map<number, EmpStats>): Agg {
  const agg: Agg = {
    headcount: employees.length,
    planned: 0,
    late: 0,
    unapproved: 0,
    lateDays: 0,
    absenceDays: 0,
    approvedDays: 0,
    workedSec: 0,
    attendance: 0,
    expected: 0,
    discipline: null,
  };

  for (const emp of employees) {
    const row = stats.get(emp.id);
    if (!row) continue;
    agg.planned += row.planned;
    agg.late += row.late;
    agg.unapproved += row.unapproved;
    agg.lateDays += row.lateDays;
    agg.absenceDays += row.absenceDays;
    agg.approvedDays += row.approvedDays;
    agg.workedSec += row.workedSec;
    if (row.hadEntry) agg.attendance += 1;
    if (row.expectedToday) agg.expected += 1;
  }

  agg.discipline =
    agg.planned > 0
      ? round1(((agg.planned - agg.late - agg.unapproved) * 100) / agg.planned)
      : null;
  return agg;
}

function scopeEmployees(ctx: Ctx, node: number | null): Employee[] {
  return node != null ? employeesInSubtree(ctx, node) : ctx.allEmployees;
}

function displayedDepartments(ctx: Ctx, state: DashboardState): Department[] {
  if (state.node != null) return ctx.children.get(state.node) ?? [];
  return ctx.byLevel.get(state.level) ?? [];
}

function sortByDiscipline(a: RatingRow, b: RatingRow): number {
  if (a.discipline == null && b.discipline == null) return a.name.localeCompare(b.name);
  if (a.discipline == null) return 1;
  if (b.discipline == null) return -1;
  return b.discipline - a.discipline || a.name.localeCompare(b.name);
}

function buildViolationItems(
  ctx: Ctx,
  dates: string[],
  employees: Employee[],
): ViolationItem[] {
  const out: ViolationItem[] = [];
  for (const emp of employees) {
    for (const date of dates) {
      const day = ctx.dayByKey.get(`${emp.id}|${date}`);
      if (!day || day[11] !== 1) continue;
      const workday = isWorkday(ctx, date);
      const firstIn = day[3];
      const absenceType = day[9];
      const approved = day[10] === 1;
      const isLate = day[6] === 1;

      if (isLate) {
        out.push({
          employeeId: emp.id,
          fullName: emp.fullName,
          deptId: emp.deptId,
          deptName: ctx.deptById.get(emp.deptId)?.name ?? '—',
          scheduleType: day[12],
          hasScud: true,
          date,
          kind: 'late',
          firstIn,
          lateMinutes: day[7],
          absenceType,
          approved: false,
        });
      } else if (workday && !firstIn && !(approved && absenceType)) {
        out.push({
          employeeId: emp.id,
          fullName: emp.fullName,
          deptId: emp.deptId,
          deptName: ctx.deptById.get(emp.deptId)?.name ?? '—',
          scheduleType: day[12],
          hasScud: true,
          date,
          kind: 'absence',
          firstIn: null,
          lateMinutes: null,
          absenceType,
          approved: false,
        });
      }
    }
  }

  out.sort(
    (a, b) => b.date.localeCompare(a.date) || a.fullName.localeCompare(b.fullName),
  );
  return out;
}

export function buildOverview(
  snapshot: Snapshot,
  state: DashboardState,
): OverviewData {
  const ctx = buildCtx(snapshot);
  const dates = dateRange(state.dateFrom, state.dateTo);
  const today = snapshot.today;
  const disciplineDates = dates;

  const stats = computeStats(ctx, dates, disciplineDates);
  const employees = scopeEmployees(ctx, state.node);
  const scopeAgg = aggregate(employees, stats);
  const scopeIds = new Set(employees.map((e) => e.id));
  const inOffice = snapshot.officeNow.filter((o) => scopeIds.has(o.employeeId)).length;

  const depts = displayedDepartments(ctx, state);
  const rating: RatingRow[] = depts
    .map((dept) => {
      const agg = aggregate(employeesInSubtree(ctx, dept.id), stats);
      return {
        id: dept.id,
        name: dept.name,
        lvl: ctx.levelOf.get(dept.id) ?? 1,
        path: (ctx.paths.get(dept.id) ?? [dept.name]).join(' / '),
        headcount: agg.headcount,
        discipline: agg.discipline,
        lateDays: agg.lateDays,
        absenceDays: agg.absenceDays,
        hasChildren: (ctx.children.get(dept.id)?.length ?? 0) > 0,
      };
    })
    .sort(sortByDiscipline);

  const summary: SummaryRow[] = depts
    .map((dept) => {
      const agg = aggregate(employeesInSubtree(ctx, dept.id), stats);
      const factHours = round1(agg.workedSec / 3600);
      const planHours = round1(agg.planned * 8);
      return {
        id: dept.id,
        name: dept.name,
        lvl: ctx.levelOf.get(dept.id) ?? 1,
        path: (ctx.paths.get(dept.id) ?? [dept.name]).join(' / '),
        headcount: agg.headcount,
        discipline: agg.discipline,
        lateDays: agg.lateDays,
        absenceDays: agg.absenceDays,
        hasChildren: (ctx.children.get(dept.id)?.length ?? 0) > 0,
        planHours,
        factHours,
        delta: round1(factHours - planHours),
      };
    })
    .sort((a, b) => (b.discipline ?? -1) - (a.discipline ?? -1) || a.name.localeCompare(b.name));

  const allViolations = buildViolationItems(ctx, dates, employees);

  const crumbs: Crumb[] = [{ id: null, label: 'Все' }];
  if (state.node != null) {
    for (const dept of ctx.chain.get(state.node) ?? []) {
      crumbs.push({ id: dept.id, label: dept.name });
    }
  }

  const disciplineHint =
    scopeAgg.planned === 0 ? 'нет плановых дней' : null;

  const cardStats: CardStats = {
    employees: scopeAgg.headcount,
    inOffice,
    attendance: scopeAgg.attendance,
    approvedAbsenceDays: scopeAgg.approvedDays,
    lateDays: scopeAgg.lateDays,
    absenceDays: scopeAgg.absenceDays,
    expected: scopeAgg.expected,
    discipline: scopeAgg.discipline,
    disciplineHint,
  };

  return {
    today,
    generatedAt: snapshot.generatedAt,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    periodLabel: formatPeriodLabel(state.dateFrom, state.dateTo),
    scopeId: state.node,
    scopeName: state.node != null
      ? (ctx.deptById.get(state.node)?.name ?? 'Все')
      : 'Все',
    level: state.level,
    crumbs,
    canBack: state.history.length > 0,
    historyDepth: state.history.length,
    stats: cardStats,
    rating,
    ratingTotal: rating.length,
    violations: allViolations.slice(0, 10),
    violationsTotal: allViolations.length,
    summary,
  };
}

const OVERLAY_TITLES: Record<ViewName, string> = {
  employees: 'Сотрудники',
  'in-office': 'В офисе сейчас',
  attendance: 'Вышли на работу',
  'absences-approved': 'Уважительные отсутствия',
  late: 'Опоздания',
  absences: 'Отсутствия',
  expected: 'Не пришли по графику',
  violations: 'Нарушения',
};

function baseRow(ctx: Ctx, emp: Employee): OverlayRow {
  return {
    employeeId: emp.id,
    fullName: emp.fullName,
    deptName: ctx.deptById.get(emp.deptId)?.name ?? '—',
    position: emp.position,
    scheduleType: emp.scheduleType,
    hasScud: emp.hasScud,
  };
}

function lastEntry(ctx: Ctx, empId: number, dates: string[]): DayTuple | null {
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    const day = ctx.dayByKey.get(`${empId}|${dates[i]}`);
    if (day?.[3]) return day;
  }
  return null;
}

export function buildOverlay(snapshot: Snapshot, state: DashboardState): OverlayData | null {
  if (!state.view) return null;
  const ctx = buildCtx(snapshot);
  const dates = dateRange(state.dateFrom, state.dateTo);
  const employees = scopeEmployees(ctx, state.node);
  const scopeIds = new Set(employees.map((e) => e.id));
  const view = state.view;
  let rows: OverlayRow[] = [];

  if (view === 'employees') {
    rows = employees.map((emp) => baseRow(ctx, emp));
  } else if (view === 'in-office') {
    const byId = new Map(employees.map((e) => [e.id, e]));
    rows = snapshot.officeNow.flatMap((o): OverlayRow[] => {
      if (!scopeIds.has(o.employeeId)) return [];
      const emp = byId.get(o.employeeId);
      return emp ? [{ ...baseRow(ctx, emp), ts: o.ts }] : [];
    });
  } else if (view === 'attendance') {
    rows = employees.flatMap((emp): OverlayRow[] => {
      const day = lastEntry(ctx, emp.id, dates);
      if (!day) return [];
      return [
        {
          ...baseRow(ctx, emp),
          date: day[2],
          firstIn: day[3],
          lastOut: day[4],
          durationSec: day[5],
        },
      ];
    });
  } else if (view === 'expected') {
    const stats = computeStats(ctx, dates, dates);
    rows = employees
      .filter((emp) => stats.get(emp.id)?.expectedToday)
      .map((emp) => baseRow(ctx, emp));
  } else {
    const violations = buildViolationItems(ctx, dates, employees);
    if (view === 'late' || view === 'violations') {
      let items = violations.filter((v) => v.kind === 'late');
      if (view === 'violations') items = violations;
      rows = items.map((v) => ({
        employeeId: v.employeeId,
        fullName: v.fullName,
        deptName: v.deptName,
        position: ctx.empById.get(v.employeeId)?.position ?? '',
        scheduleType: v.scheduleType,
        hasScud: v.hasScud,
        date: v.date,
        firstIn: v.firstIn,
        lateMinutes: v.lateMinutes,
        absenceType: v.absenceType,
        approved: v.approved,
        isLate: v.kind === 'late',
      }));
    } else {
      const approvedOnly = view === 'absences-approved';
      rows = [];
      for (const emp of employees) {
        for (const date of dates) {
          const day = ctx.dayByKey.get(`${emp.id}|${date}`);
          if (!day || day[11] !== 1) continue;
          const absenceType = day[9];
          const isApproved = day[10] === 1 && absenceType != null;
          const firstIn = day[3];
          if (approvedOnly) {
            if (!isApproved) continue;
          } else if (!(isWorkday(ctx, date) && !firstIn && !isApproved)) {
            continue;
          }
          rows.push({
            ...baseRow(ctx, emp),
            date,
            absenceType,
            approved: isApproved,
            firstIn,
          });
        }
      }
    }
  }

  if (view === 'employees' || view === 'in-office' || view === 'expected') {
    rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
  } else {
    rows.sort(
      (a, b) =>
        (b.date ?? '').localeCompare(a.date ?? '') ||
        a.fullName.localeCompare(b.fullName),
    );
  }

  return { view, title: OVERLAY_TITLES[view], rows, total: rows.length };
}

export function buildEmployeeDays(
  snapshot: Snapshot,
  state: DashboardState,
): EmployeeDaysData | null {
  if (state.eid == null) return null;
  const ctx = buildCtx(snapshot);
  const employee = ctx.empById.get(state.eid);
  if (!employee) return null;

  const days: EmployeeDay[] = dateRange(state.dateFrom, state.dateTo).map((date) => {
    const day = ctx.dayByKey.get(`${employee.id}|${date}`);
    const workday = isWorkday(ctx, date);
    const firstIn = day?.[3] ?? null;
    const lastOut = day?.[4] ?? null;
    const durationSec = day?.[5] ?? null;
    const isLate = day?.[6] === 1;
    const lateMinutes = day?.[7] ?? null;
    const isEarlyLeave = day?.[8] === 1;
    const absenceType = day?.[9] ?? null;
    const absenceApproved = day?.[10] === 1;

    let status = 'В норме';
    if (!employee.hasScud) status = 'Нет СКУД';
    else if (absenceApproved && absenceType) status = 'Уважительная';
    else if (!workday && !firstIn && !absenceType) status = 'Выходной';
    else if (!firstIn) status = 'Отсутствие';
    else if (isLate) status = 'Опоздание';
    else if (isEarlyLeave) status = 'Ранний уход';

    return {
      date,
      isWorkday: workday,
      firstIn,
      lastOut,
      durationSec,
      isLate,
      lateMinutes,
      isEarlyLeave,
      absenceType,
      absenceApproved,
      status,
    };
  });

  return {
    employee,
    deptName: ctx.deptById.get(employee.deptId)?.name ?? '—',
    scheduleLabel: SCHEDULE_LABELS[employee.scheduleType],
    days,
  };
}

export function scheduleLabel(value: ScheduleType): string {
  return SCHEDULE_LABELS[value];
}

export function absenceLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return ABSENCE_LABELS[value] ?? value;
}

export function officeNowRows(snapshot: Snapshot): OfficeNow[] {
  return snapshot.officeNow;
}
