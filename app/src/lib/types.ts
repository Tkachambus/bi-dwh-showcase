export type ScheduleType = 'office' | 'remote' | 'field' | 'shift';

export interface Department {
  id: number;
  name: string;
  parentId: number | null;
}

export interface Employee {
  id: number;
  fullName: string;
  deptId: number;
  position: string;
  scheduleType: ScheduleType;
  plannedArrival: string;
  plannedDeparture: string;
  isActive: boolean;
  hasScud: boolean;
}

/**
 * Компактная строка «сотрудник × день». Массив вместо объекта экономит
 * примерно половину размера снапшота для GitHub Pages.
 */
export type DayTuple = [
  employeeId: number,
  deptId: number,
  date: string,
  firstIn: string | null,
  lastOut: string | null,
  durationSec: number | null,
  isLate: 0 | 1,
  lateMinutes: number | null,
  isEarlyLeave: 0 | 1,
  absenceType: string | null,
  absenceApproved: 0 | 1,
  hasScud: 0 | 1,
  scheduleType: ScheduleType,
  isWorkday: 0 | 1,
];

export interface OfficeNow {
  employeeId: number;
  ts: string;
}

export interface Snapshot {
  version: number;
  generatedAt: string;
  today: string;
  dateFrom: string;
  dateTo: string;
  departments: Department[];
  employees: Employee[];
  calendar: Array<[string, 0 | 1]>;
  days: DayTuple[];
  officeNow: OfficeNow[];
}

export type ViewName =
  | 'employees'
  | 'in-office'
  | 'attendance'
  | 'absences-approved'
  | 'late'
  | 'absences'
  | 'expected'
  | 'violations';

export interface HistoryStep {
  l: number;
  n: number | null;
}

export interface DashboardState {
  dateFrom: string;
  dateTo: string;
  singleDate: boolean;
  level: number;
  node: number | null;
  history: HistoryStep[];
  view: ViewName | null;
  eid: number | null;
}

export interface CardStats {
  employees: number;
  inOffice: number;
  attendance: number;
  approvedAbsenceDays: number;
  lateDays: number;
  absenceDays: number;
  expected: number;
  discipline: number | null;
  disciplineHint: string | null;
}

export interface RatingRow {
  id: number;
  name: string;
  lvl: number;
  path: string;
  headcount: number;
  discipline: number | null;
  lateDays: number;
  absenceDays: number;
  hasChildren: boolean;
}

export interface SummaryRow extends RatingRow {
  planHours: number;
  factHours: number;
  delta: number;
}

export interface ViolationItem {
  employeeId: number;
  fullName: string;
  deptId: number;
  deptName: string;
  scheduleType: ScheduleType;
  hasScud: boolean;
  date: string;
  kind: 'late' | 'absence';
  firstIn: string | null;
  lateMinutes: number | null;
  absenceType: string | null;
  approved: boolean;
}

export interface Crumb {
  id: number | null;
  label: string;
}

export interface OverviewData {
  today: string;
  generatedAt: string;
  dateFrom: string;
  dateTo: string;
  periodLabel: string;
  scopeId: number | null;
  scopeName: string;
  level: number;
  crumbs: Crumb[];
  canBack: boolean;
  historyDepth: number;
  stats: CardStats;
  rating: RatingRow[];
  ratingTotal: number;
  violations: ViolationItem[];
  violationsTotal: number;
  summary: SummaryRow[];
}

export interface OverlayRow {
  employeeId: number;
  fullName: string;
  deptName: string;
  position: string;
  scheduleType: ScheduleType;
  hasScud: boolean;
  date?: string;
  firstIn?: string | null;
  lastOut?: string | null;
  durationSec?: number | null;
  isLate?: boolean;
  lateMinutes?: number | null;
  absenceType?: string | null;
  approved?: boolean;
  ts?: string;
}

export interface OverlayData {
  view: ViewName;
  title: string;
  rows: OverlayRow[];
  total: number;
}

export interface EmployeeDay {
  date: string;
  isWorkday: boolean;
  firstIn: string | null;
  lastOut: string | null;
  durationSec: number | null;
  isLate: boolean;
  lateMinutes: number | null;
  isEarlyLeave: boolean;
  absenceType: string | null;
  absenceApproved: boolean;
  status: string;
}

export interface EmployeeDaysData {
  employee: Employee;
  deptName: string;
  scheduleLabel: string;
  days: EmployeeDay[];
}
