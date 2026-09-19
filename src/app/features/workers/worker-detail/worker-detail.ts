import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AttendanceCreateRequest,
  AttendanceResponse,
  AttendanceService,
  ProjectResponse,
  ProjectsService,
  WorkerResponse,
  WorkersService,
  WorkerUpdateRequest,
} from '../../../generated';
import { formatPeso } from '../../../core/model.currency';
import { CurrentUserService } from '../../../core/services/current-user';
import { Permission } from '../../../core/constants/permissions';
import { ModalComponent } from '../../../shared/modal/modal';
import { localDateString } from '../../../core/utils/local-date';

type Mode = 'view' | 'edit';

// search2()'s status filter only takes one value, so — same tradeoff already
// made on the Dashboard and every other "fetch, then filter client-side"
// list in this app — fetch everything once and filter to open (non-terminal)
// projects for the attendance form's project picker.
const PROJECTS_FETCH_SIZE = 300;
const ATTENDANCE_FETCH_SIZE = 300;

@Component({
  selector: 'app-worker-detail',
  imports: [DatePipe, ModalComponent],
  templateUrl: './worker-detail.html',
  styleUrl: './worker-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workersService = inject(WorkersService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly projectsService = inject(ProjectsService);
  private readonly currentUser = inject(CurrentUserService);

  readonly formatPeso = formatPeso;

  readonly canEdit = this.currentUser.hasPermission(Permission.WorkerEdit);
  readonly canDeactivate = this.currentUser.hasPermission(Permission.WorkerDeactivate);
  readonly canRecordAttendance = this.currentUser.hasPermission(Permission.AttendanceCreate);
  readonly canDeleteAttendance = this.currentUser.hasPermission(Permission.AttendanceDelete);

  readonly worker = signal<WorkerResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly deactivateDialogOpen = signal(false);
  readonly deactivating = signal(false);

  // ---- Edit mode ----
  readonly mode = signal<Mode>('view');
  readonly editName = signal('');
  readonly editPosition = signal('');
  readonly editDailyRate = signal('');
  readonly saving = signal(false);

  // ---- Attendance history ----
  readonly attendanceRecords = signal<AttendanceResponse[]>([]);
  readonly attendanceLoading = signal(false);
  readonly attendanceError = signal<string | null>(null);

  readonly deleteAttendanceTarget = signal<AttendanceResponse | null>(null);
  readonly deletingAttendance = signal(false);

  // ---- Record attendance modal ----
  readonly attendanceDialogOpen = signal(false);
  readonly projectOptions = signal<ProjectResponse[]>([]);
  readonly attendanceProjectId = signal<number | null>(null);
  readonly attendanceDate = signal(localDateString(new Date()));
  readonly attendanceDaysPresent = signal('1');
  readonly attendanceNotes = signal('');
  readonly attendanceSaving = signal(false);
  readonly attendanceFormError = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('Invalid worker id.');
      this.loading.set(false);
      return;
    }
    this.loadWorker(id);
    this.loadAttendance(id);
  }

  backToList(): void {
    this.router.navigate(['/workers']);
  }

  canShowEdit(): boolean {
    return this.canEdit;
  }

  canShowDeactivate(worker: WorkerResponse): boolean {
    return this.canDeactivate && worker.active !== false;
  }

  canShowRecordAttendance(worker: WorkerResponse): boolean {
    return this.canRecordAttendance && worker.active !== false;
  }

  // ---- Enter/cancel edit ----
  enterEdit(): void {
    const current = this.worker();
    if (!current) return;
    this.errorMessage.set(null);
    this.syncFormFromWorker(current);
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const current = this.worker();
    if (current) this.syncFormFromWorker(current);
    this.errorMessage.set(null);
    this.mode.set('view');
  }

  private syncFormFromWorker(worker: WorkerResponse): void {
    this.editName.set(worker.name ?? '');
    this.editPosition.set(worker.position ?? '');
    this.editDailyRate.set(worker.dailyRate !== undefined && worker.dailyRate !== null ? String(worker.dailyRate) : '');
  }

  onEditNameChange(value: string): void {
    this.editName.set(value);
  }

  onEditPositionChange(value: string): void {
    this.editPosition.set(value);
  }

  onEditDailyRateChange(value: string): void {
    this.editDailyRate.set(value);
  }

  saveEdit(): void {
    const current = this.worker();
    if (!current || current.id === undefined) return;

    const name = this.editName().trim();
    const dailyRateInput = this.editDailyRate().trim();
    const dailyRate = Number(dailyRateInput);

    if (!name || !dailyRateInput || Number.isNaN(dailyRate) || dailyRate < 0) {
      this.errorMessage.set('Name and a valid daily rate are required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: WorkerUpdateRequest = {
      name,
      position: this.editPosition().trim() || undefined,
      dailyRate,
    };

    this.workersService.update(current.id, body).subscribe({
      next: (updated) => {
        this.worker.set(updated);
        this.saving.set(false);
        this.mode.set('view');
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Could not save changes. Please check the form and try again.');
      },
    });
  }

  // ---- Deactivate ----
  openDeactivateDialog(): void {
    this.deactivateDialogOpen.set(true);
  }

  closeDeactivateDialog(): void {
    this.deactivateDialogOpen.set(false);
  }

  deactivateWorker(): void {
    const current = this.worker();
    if (!current || current.id === undefined) return;
    const workerId = current.id;

    this.deactivating.set(true);
    this.workersService.deactivate(workerId).subscribe({
      next: () => {
        this.deactivating.set(false);
        this.deactivateDialogOpen.set(false);
        this.loadWorker(workerId);
      },
      error: () => {
        this.deactivating.set(false);
        this.deactivateDialogOpen.set(false);
        this.errorMessage.set('Could not deactivate this worker. Please try again.');
      },
    });
  }

  // ---- Record attendance ----
  openAttendanceDialog(): void {
    this.attendanceProjectId.set(null);
    this.attendanceDate.set(localDateString(new Date()));
    this.attendanceDaysPresent.set('1');
    this.attendanceNotes.set('');
    this.attendanceFormError.set(null);
    this.attendanceDialogOpen.set(true);
    this.loadOpenProjects();
  }

  closeAttendanceDialog(): void {
    this.attendanceDialogOpen.set(false);
  }

  onAttendanceProjectChange(value: string): void {
    this.attendanceProjectId.set(value ? Number(value) : null);
  }

  onAttendanceDateChange(value: string): void {
    this.attendanceDate.set(value);
  }

  onAttendanceDaysPresentChange(value: string): void {
    this.attendanceDaysPresent.set(value);
  }

  onAttendanceNotesChange(value: string): void {
    this.attendanceNotes.set(value);
  }

  submitAttendance(): void {
    const current = this.worker();
    if (!current || current.id === undefined) return;
    const workerId = current.id;

    const projectId = this.attendanceProjectId();
    const attendanceDate = this.attendanceDate();
    const daysPresent = Number(this.attendanceDaysPresent());

    if (!projectId) {
      this.attendanceFormError.set('Select a project.');
      return;
    }
    if (!attendanceDate) {
      this.attendanceFormError.set('Date is required.');
      return;
    }
    if (!daysPresent || daysPresent <= 0 || Number.isNaN(daysPresent)) {
      this.attendanceFormError.set('Enter a days-present value greater than zero.');
      return;
    }

    const body: AttendanceCreateRequest = {
      workerId,
      projectId,
      attendanceDate,
      daysPresent,
      notes: this.attendanceNotes().trim() || undefined,
    };

    this.attendanceSaving.set(true);
    this.attendanceFormError.set(null);

    this.attendanceService.create6(body).subscribe({
      next: () => {
        this.attendanceSaving.set(false);
        this.attendanceDialogOpen.set(false);
        this.loadAttendance(workerId);
      },
      error: (err) => {
        this.attendanceSaving.set(false);
        if (err?.status === 409) {
          this.attendanceFormError.set('This worker already has an attendance record for that date.');
        } else if (err?.status === 422) {
          this.attendanceFormError.set('That project can no longer accept expenses — it has been completed or cancelled.');
        } else if (err?.status === 400) {
          this.attendanceFormError.set('This worker is inactive, or the form has invalid values.');
        } else {
          this.attendanceFormError.set('Could not record attendance. Please try again.');
        }
      },
    });
  }

  // ---- Delete attendance ----
  openDeleteAttendanceDialog(record: AttendanceResponse): void {
    this.deleteAttendanceTarget.set(record);
  }

  closeDeleteAttendanceDialog(): void {
    this.deleteAttendanceTarget.set(null);
  }

  deleteAttendance(): void {
    const target = this.deleteAttendanceTarget();
    const current = this.worker();
    if (!target || target.id === undefined || !current || current.id === undefined) return;
    const workerId = current.id;

    this.deletingAttendance.set(true);
    this.attendanceService.delete3(target.id).subscribe({
      next: () => {
        this.deletingAttendance.set(false);
        this.deleteAttendanceTarget.set(null);
        this.loadAttendance(workerId);
      },
      error: (err) => {
        this.deletingAttendance.set(false);
        this.deleteAttendanceTarget.set(null);
        if (err?.status === 422) {
          this.errorMessage.set('That record\'s project can no longer be edited — it has been completed or cancelled.');
        } else {
          this.errorMessage.set('Could not delete this record. Please try again.');
        }
        this.loadAttendance(workerId);
      },
    });
  }

  private loadWorker(id: number): void {
    this.loading.set(true);
    this.workersService.getById(id).subscribe({
      next: (worker) => {
        this.worker.set(worker);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Worker not found.');
        this.loading.set(false);
      },
    });
  }

  private loadAttendance(workerId: number): void {
    this.attendanceLoading.set(true);
    this.attendanceError.set(null);
    this.attendanceService.search7(workerId, undefined, undefined, undefined, 0, ATTENDANCE_FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.attendanceRecords.set((result.content ?? []) as AttendanceResponse[]);
        this.attendanceLoading.set(false);
      },
      error: () => {
        this.attendanceError.set('Could not load attendance history. Please try again.');
        this.attendanceLoading.set(false);
      },
    });
  }

  private loadOpenProjects(): void {
    this.projectsService.search3(undefined, 0, PROJECTS_FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        const all = (result.content ?? []) as ProjectResponse[];
        this.projectOptions.set(
          all.filter(
            (p) => p.status === ProjectResponse.StatusEnum.Active || p.status === ProjectResponse.StatusEnum.OnHold,
          ),
        );
      },
      error: () => {
        this.projectOptions.set([]);
      },
    });
  }
}
