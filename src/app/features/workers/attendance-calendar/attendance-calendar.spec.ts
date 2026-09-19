import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AttendanceService, ProjectsService, WorkerAssignmentsService } from '../../../generated';
import { CurrentUserService } from '../../../core/services/current-user';
import { AttendanceCalendarComponent } from './attendance-calendar';

function createCalendar(): AttendanceCalendarComponent {
  TestBed.configureTestingModule({
    providers: [
      { provide: CurrentUserService, useValue: { hasPermission: () => true } },
      { provide: Router, useValue: {} },
      { provide: ProjectsService, useValue: {} },
      { provide: WorkerAssignmentsService, useValue: {} },
      { provide: AttendanceService, useValue: {} },
    ],
  });
  return TestBed.runInInjectionContext(() => new AttendanceCalendarComponent());
}

describe('AttendanceCalendarComponent month grid', () => {
  it('pads the first week so day 1 lands on its real weekday', () => {
    const calendar = createCalendar();
    calendar.viewYear.set(2026);
    calendar.viewMonth.set(8); // September 2026 — the 1st is a Tuesday

    const cells = calendar.calendarCells();
    expect(cells.slice(0, 2).every((c) => c.date === null)).toBe(true);
    expect(cells[2]).toEqual({ date: '2026-09-01', day: 1, workerCount: null });
  });

  it('includes every day of the month and fills out whole weeks', () => {
    const calendar = createCalendar();
    calendar.viewYear.set(2026);
    calendar.viewMonth.set(1); // February 2026 — 28 days

    const cells = calendar.calendarCells();
    expect(cells.filter((c) => c.date !== null)).toHaveLength(28);
    expect(cells.length % 7).toBe(0);
  });

  it('handles a leap-year February', () => {
    const calendar = createCalendar();
    calendar.viewYear.set(2028);
    calendar.viewMonth.set(1);

    expect(calendar.calendarCells().some((c) => c.date === '2028-02-29')).toBe(true);
  });

  it('maps recorded worker counts onto their dates, summing across projects', () => {
    const calendar = createCalendar();
    calendar.viewYear.set(2026);
    calendar.viewMonth.set(8);
    calendar.calendarEntries.set([
      { date: '2026-09-08', projectId: 1, workerCount: 2 },
      { date: '2026-09-08', projectId: 2, workerCount: 3 },
      { date: '2026-09-15', projectId: 1, workerCount: 1 },
    ]);

    const byDate = new Map(calendar.calendarCells().map((c) => [c.date, c.workerCount]));
    expect(byDate.get('2026-09-08')).toBe(5);
    expect(byDate.get('2026-09-15')).toBe(1);
    expect(byDate.get('2026-09-09')).toBeNull();
  });

  it('wraps across year boundaries when paging months', () => {
    const calendar = createCalendar();
    calendar.selectedProjectId.set(null); // keeps paging from triggering a fetch
    calendar.viewYear.set(2026);
    calendar.viewMonth.set(11);

    calendar.nextMonth();
    expect([calendar.viewYear(), calendar.viewMonth()]).toEqual([2027, 0]);

    calendar.prevMonth();
    expect([calendar.viewYear(), calendar.viewMonth()]).toEqual([2026, 11]);
  });
});
