import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AttendanceBatchCreateRequest,
  AttendanceBatchLineRequest,
  AttendanceCalendarEntry,
  AttendanceResponse,
  AttendanceService,
  ProjectResponse,
  ProjectsService,
  WorkerAssignmentsService,
  WorkerProjectAssignmentResponse,
} from '../../../generated';
import { CurrentUserService } from '../../../core/services/current-user';
import { Permission } from '../../../core/constants/permissions';
import { ModalComponent } from '../../../shared/modal/modal';
import { localDateString } from '../../../core/utils/local-date';

const PROJECTS_FETCH_SIZE = 300;
const CREW_FETCH_SIZE = 300;

interface CalendarCell {
  date: string | null;
  day: number | null;
  workerCount: number | null;
}

interface DayLine {
  workerId: number;
  workerName: string;
  existing: AttendanceResponse | null;
  include: boolean;
  timeIn: string;
  timeOut: string;
  notes: string;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-attendance-calendar',
  imports: [DatePipe, ModalComponent],
  templateUrl: './attendance-calendar.html',
  styleUrl: './attendance-calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceCalendarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  private readonly workerAssignmentsService = inject(WorkerAssignmentsService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly currentUser = inject(CurrentUserService);

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly canRecordBatch = this.currentUser.hasPermission(Permission.AttendanceBatchCreate);

  readonly projects = signal<ProjectResponse[]>([]);
  readonly selectedProjectId = signal<number | null>(null);

  private readonly today = new Date();
  readonly viewYear = signal(this.today.getFullYear());
  readonly viewMonth = signal(this.today.getMonth());

  readonly calendarEntries = signal<AttendanceCalendarEntry[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly monthLabel = computed(() =>
    new Date(this.viewYear(), this.viewMonth(), 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  );

  private readonly entriesByDate = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.calendarEntries()) {
      if (!e.date) continue;
      map.set(e.date, (map.get(e.date) ?? 0) + (e.workerCount ?? 0));
    }
    return map;
  });

  readonly todayDateStr = localDateString(this.today);

  readonly calendarCells = computed<CalendarCell[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const byDate = this.entriesByDate();

    const cells: CalendarCell[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ date: null, day: null, workerCount: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = localDateString(new Date(year, month, day));
      cells.push({ date, day, workerCount: byDate.get(date) ?? null });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, day: null, workerCount: null });
    }
    return cells;
  });

  // ---- Day dialog ----
  readonly dayDialogOpen = signal(false);
  readonly dayDialogDate = signal<string | null>(null);
  readonly dayLines = signal<DayLine[]>([]);
  readonly dayLoading = signal(false);
  readonly dayError = signal<string | null>(null);
  readonly daySaving = signal(false);
  readonly dayResultMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.projectsService.search3(undefined, 0, PROJECTS_FETCH_SIZE, undefined).subscribe({
      next: (result) => this.projects.set((result.content ?? []) as ProjectResponse[]),
      error: () => this.projects.set([]),
    });
  }

  backToWorkers(): void {
    this.router.navigate(['/workers']);
  }

  onProjectChange(value: string): void {
    this.selectedProjectId.set(value ? Number(value) : null);
    this.loadCalendar();
  }

  prevMonth(): void {
    let m = this.viewMonth() - 1;
    let y = this.viewYear();
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    this.viewMonth.set(m);
    this.viewYear.set(y);
    this.loadCalendar();
  }

  nextMonth(): void {
    let m = this.viewMonth() + 1;
    let y = this.viewYear();
    if (m > 11) {
      m = 0;
      y += 1;
    }
    this.viewMonth.set(m);
    this.viewYear.set(y);
    this.loadCalendar();
  }

  openDayDialog(date: string | null): void {
    const projectId = this.selectedProjectId();
    if (!projectId || !date) return;

    this.dayDialogDate.set(date);
    this.dayDialogOpen.set(true);
    this.dayLoading.set(true);
    this.dayError.set(null);
    this.dayResultMessage.set(null);
    this.dayLines.set([]);

    forkJoin({
      crew: this.workerAssignmentsService.search1(projectId, true, 0, CREW_FETCH_SIZE, undefined),
      existing: this.attendanceService.search7(undefined, projectId, date, date, 0, CREW_FETCH_SIZE, undefined),
    }).subscribe({
      next: ({ crew, existing }) => {
        const crewList = (crew.content ?? []) as WorkerProjectAssignmentResponse[];
        const existingList = (existing.content ?? []) as AttendanceResponse[];
        const existingByWorkerId = new Map(existingList.map((e) => [e.workerId, e]));

        this.dayLines.set(
          crewList
            .filter((c) => c.workerId !== undefined)
            .map((c): DayLine => {
              const existingRecord = existingByWorkerId.get(c.workerId!) ?? null;
              return {
                workerId: c.workerId!,
                workerName: c.workerName ?? '',
                existing: existingRecord,
                include: !existingRecord,
                timeIn: '07:00',
                timeOut: '16:00',
                notes: '',
              };
            }),
        );
        this.dayLoading.set(false);
      },
      error: () => {
        this.dayError.set('Could not load the crew or existing attendance for this day.');
        this.dayLoading.set(false);
      },
    });
  }

  closeDayDialog(): void {
    this.dayDialogOpen.set(false);
  }

  toggleLineInclude(workerId: number, include: boolean): void {
    this.dayLines.update((lines) => lines.map((l) => (l.workerId === workerId ? { ...l, include } : l)));
  }

  onLineTimeInChange(workerId: number, value: string): void {
    this.dayLines.update((lines) => lines.map((l) => (l.workerId === workerId ? { ...l, timeIn: value } : l)));
  }

  onLineTimeOutChange(workerId: number, value: string): void {
    this.dayLines.update((lines) => lines.map((l) => (l.workerId === workerId ? { ...l, timeOut: value } : l)));
  }

  onLineNotesChange(workerId: number, value: string): void {
    this.dayLines.update((lines) => lines.map((l) => (l.workerId === workerId ? { ...l, notes: value } : l)));
  }

  submitDayBatch(): void {
    const projectId = this.selectedProjectId();
    const date = this.dayDialogDate();
    if (!projectId || !date) return;

    const candidates = this.dayLines().filter((l) => !l.existing && l.include);
    if (candidates.length === 0) {
      this.dayError.set('Select at least one worker to record.');
      return;
    }
    for (const l of candidates) {
      if (!l.timeIn || !l.timeOut || l.timeOut <= l.timeIn) {
        this.dayError.set(`Time out must be after time in for ${l.workerName}.`);
        return;
      }
    }

    const entries: AttendanceBatchLineRequest[] = candidates.map((l) => ({
      workerId: l.workerId,
      timeIn: `${l.timeIn}:00`,
      timeOut: `${l.timeOut}:00`,
      notes: l.notes.trim() || undefined,
    }));

    this.daySaving.set(true);
    this.dayError.set(null);

    const body: AttendanceBatchCreateRequest = { projectId, date, entries };
    this.attendanceService.createBatch(body).subscribe({
      next: (result) => {
        this.daySaving.set(false);
        const createdCount = result.created?.length ?? 0;
        const skippedCount = result.skipped?.length ?? 0;
        this.dayResultMessage.set(
          skippedCount > 0
            ? `Recorded ${createdCount}; ${skippedCount} already had a record for this date.`
            : `Recorded ${createdCount}.`,
        );
        this.loadCalendar();
        this.openDayDialog(date);
      },
      error: (err) => {
        this.daySaving.set(false);
        if (err?.status === 422) {
          this.dayError.set('This project can no longer accept expenses — it has been completed or cancelled.');
        } else if (err?.status === 400) {
          this.dayError.set('One of the selected workers is inactive, or a time range is invalid.');
        } else if (err?.status === 404) {
          this.dayError.set('A selected worker or the project could not be found.');
        } else {
          this.dayError.set('Could not record attendance. Please try again.');
        }
      },
    });
  }

  private loadCalendar(): void {
    const projectId = this.selectedProjectId();
    if (!projectId) {
      this.calendarEntries.set([]);
      return;
    }

    const year = this.viewYear();
    const month = this.viewMonth();
    const dateFrom = localDateString(new Date(year, month, 1));
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dateTo = localDateString(new Date(year, month, lastDay));

    this.loading.set(true);
    this.errorMessage.set(null);
    this.attendanceService.calendar(projectId, dateFrom, dateTo).subscribe({
      next: (result) => {
        // The spec documents this endpoint's 200 response as a single
        // AttendanceCalendarEntry rather than an array, even though its own
        // description says "one entry per (date, project)" — the same
        // springdoc array-response regression seen elsewhere in this
        // project (Equipment endpoints hit this earlier and were fixed).
        // Casting rather than silently trusting the generated type, per the
        // standing rule of never guessing which one is right.
        this.calendarEntries.set((result as unknown as AttendanceCalendarEntry[]) ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load the calendar. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
