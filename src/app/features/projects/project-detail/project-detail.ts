import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ModalComponent } from '../../../shared/modal/modal';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ProjectExpenseCreateRequest,
  ProjectExpenseResponse,
  ProjectExpensesService,
  ProjectResponse,
  ProjectsService,
  ProjectSummaryResponse,
  ProjectUpdateRequest,
  WorkerAssignmentsService,
  WorkerProjectAssignmentCreateRequest,
  WorkerProjectAssignmentResponse,
  WorkerResponse,
  WorkersService,
} from '../../../generated';

// Same tradeoff as every other "fetch a batch, filter client-side" list in
// this app — search()'s active filter already narrows the roster, so this
// is just a generous page size, not full pagination.
const ACTIVE_WORKERS_FETCH_SIZE = 300;
import { formatPeso } from '../../../core/model.currency';
import { CurrentUserService } from '../../../core/services/current-user';
import { Permission } from '../../../core/constants/permissions';

type Mode = 'view' | 'edit';

const EXPENSES_FETCH_SIZE = 300;

@Component({
  selector: 'app-project-detail',
  imports: [DatePipe, ModalComponent],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  private readonly expensesService = inject(ProjectExpensesService);
  private readonly workerAssignmentsService = inject(WorkerAssignmentsService);
  private readonly workersService = inject(WorkersService);
  private readonly currentUser = inject(CurrentUserService);

  readonly formatPeso = formatPeso;

  readonly canEdit = this.currentUser.hasPermission(Permission.ProjectEdit);
  readonly canComplete = this.currentUser.hasPermission(Permission.ProjectComplete);
  readonly canAddExpense = this.currentUser.hasPermission(Permission.ProjectExpenseCreate);
  readonly canAddToCrew = this.currentUser.hasPermission(Permission.WorkerAssignmentCreate);
  readonly canRemoveFromCrew = this.currentUser.hasPermission(Permission.WorkerAssignmentDeactivate);

  readonly project = signal<ProjectResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly completeDialogOpen = signal(false);
  readonly completing = signal(false);

  // ---- Edit mode ----
  readonly mode = signal<Mode>('view');
  readonly editName = signal('');
  readonly editDescription = signal('');
  readonly editBudget = signal('');
  readonly editStartDate = signal('');
  readonly editEndDate = signal('');
  readonly saving = signal(false);

  // ---- Expense summary ----
  readonly summary = signal<ProjectSummaryResponse | null>(null);
  readonly summaryLoading = signal(false);

  // ---- Expenses list ----
  private readonly allExpenses = signal<ProjectExpenseResponse[]>([]);
  readonly expensesLoading = signal(false);
  readonly expensesError = signal<string | null>(null);
  readonly categoryFilter = signal<'all' | ProjectExpenseResponse.CategoryEnum>('all');

  readonly filteredExpenses = computed(() => {
    const category = this.categoryFilter();
    return this.allExpenses().filter((e) => category === 'all' || e.category === category);
  });

  // ---- Add expense modal ----
  readonly expenseDialogOpen = signal(false);
  readonly expenseCategory = signal<ProjectExpenseResponse.CategoryEnum>(ProjectExpenseResponse.CategoryEnum.Material);
  readonly expenseDescription = signal('');
  readonly expenseAmount = signal('');
  readonly expenseDate = signal(new Date().toISOString().slice(0, 10));
  readonly expenseSaving = signal(false);
  readonly expenseError = signal<string | null>(null);

  // ---- Crew ----
  readonly crew = signal<WorkerProjectAssignmentResponse[]>([]);
  readonly crewLoading = signal(false);
  readonly crewError = signal<string | null>(null);

  readonly addCrewDialogOpen = signal(false);
  private readonly activeWorkers = signal<WorkerResponse[]>([]);
  readonly addCrewWorkerId = signal<number | null>(null);
  readonly addingToCrew = signal(false);
  readonly addCrewError = signal<string | null>(null);

  readonly removeCrewTarget = signal<WorkerProjectAssignmentResponse | null>(null);
  readonly removingFromCrew = signal(false);

  // Excludes workers already on this project's crew, so the picker only
  // offers someone actually assignable — the backend still enforces this
  // with a 409 (a worker can only have one active assignment anywhere), but
  // filtering client-side avoids an avoidable round-trip for the common case.
  readonly addableWorkers = computed(() => {
    const onCrew = new Set(this.crew().map((c) => c.workerId));
    return this.activeWorkers().filter((w) => w.id === undefined || !onCrew.has(w.id));
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('Invalid project id.');
      this.loading.set(false);
      return;
    }
    this.loadProject(id);
    this.loadSummary(id);
    this.loadExpenses(id);
    this.loadCrew(id);
  }

  backToList(): void {
    this.router.navigate(['/projects']);
  }

  statusLabel(project: ProjectResponse): string {
    switch (project.status) {
      case ProjectResponse.StatusEnum.Active:
        return 'Active';
      case ProjectResponse.StatusEnum.OnHold:
        return 'On Hold';
      case ProjectResponse.StatusEnum.Completed:
        return 'Completed';
      case ProjectResponse.StatusEnum.Cancelled:
        return 'Cancelled';
      default:
        return '—';
    }
  }

  categoryLabel(category: ProjectExpenseResponse.CategoryEnum | undefined): string {
    switch (category) {
      case ProjectExpenseResponse.CategoryEnum.Labor:
        return 'Labor';
      case ProjectExpenseResponse.CategoryEnum.Material:
        return 'Material';
      case ProjectExpenseResponse.CategoryEnum.Other:
        return 'Other';
      default:
        return '—';
    }
  }

  // Same lock condition documented for PUT/POST expense — 422 once
  // COMPLETED/CANCELLED. ON_HOLD is still editable/still accepts expenses.
  isLocked(project: ProjectResponse): boolean {
    return (
      project.status === ProjectResponse.StatusEnum.Completed ||
      project.status === ProjectResponse.StatusEnum.Cancelled
    );
  }

  canShowEdit(project: ProjectResponse): boolean {
    return this.canEdit && !this.isLocked(project);
  }

  canShowComplete(project: ProjectResponse): boolean {
    return this.canComplete && !this.isLocked(project);
  }

  canShowAddExpense(project: ProjectResponse): boolean {
    return this.canAddExpense && !this.isLocked(project);
  }

  onCategoryFilterChange(value: 'all' | ProjectExpenseResponse.CategoryEnum): void {
    this.categoryFilter.set(value);
  }

  // ---- Complete ----
  openCompleteDialog(): void {
    this.completeDialogOpen.set(true);
  }

  closeCompleteDialog(): void {
    this.completeDialogOpen.set(false);
  }

  completeProject(): void {
    const current = this.project();
    if (!current || current.id === undefined) return;
    const projectId = current.id;

    this.completing.set(true);
    this.projectsService.complete(projectId).subscribe({
      next: (updated) => {
        this.project.set(updated);
        this.completing.set(false);
        this.completeDialogOpen.set(false);
      },
      error: (err) => {
        this.completing.set(false);
        this.completeDialogOpen.set(false);
        this.errorMessage.set(err?.error?.message || 'Could not mark this project as completed. Please try again.');
        this.loadProject(projectId);
      },
    });
  }

  // ---- Enter/cancel edit ----
  enterEdit(): void {
    const current = this.project();
    if (!current) return;
    this.errorMessage.set(null);
    this.syncFormFromProject(current);
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const current = this.project();
    if (current) this.syncFormFromProject(current);
    this.errorMessage.set(null);
    this.mode.set('view');
  }

  private syncFormFromProject(project: ProjectResponse): void {
    this.editName.set(project.name ?? '');
    this.editDescription.set(project.description ?? '');
    this.editBudget.set(project.budget !== undefined && project.budget !== null ? String(project.budget) : '');
    this.editStartDate.set(project.startDate ?? '');
    this.editEndDate.set(project.endDate ?? '');
  }

  onEditNameChange(value: string): void {
    this.editName.set(value);
  }

  onEditDescriptionChange(value: string): void {
    this.editDescription.set(value);
  }

  onEditBudgetChange(value: string): void {
    this.editBudget.set(value);
  }

  onEditStartDateChange(value: string): void {
    this.editStartDate.set(value);
  }

  onEditEndDateChange(value: string): void {
    this.editEndDate.set(value);
  }

  saveEdit(): void {
    const current = this.project();
    if (!current || current.id === undefined) return;

    const name = this.editName().trim();
    const startDate = this.editStartDate();
    if (!name || !startDate) {
      this.errorMessage.set('Name and start date are required.');
      return;
    }

    const budgetInput = this.editBudget().trim();
    const budget = budgetInput ? Number(budgetInput) : undefined;
    if (budget !== undefined && Number.isNaN(budget)) {
      this.errorMessage.set('Budget must be a number.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: ProjectUpdateRequest = {
      name,
      description: this.editDescription().trim() || undefined,
      budget,
      startDate,
      endDate: this.editEndDate() || undefined,
    };

    this.projectsService.update2(current.id, body).subscribe({
      next: (updated) => {
        this.project.set(updated);
        this.saving.set(false);
        this.mode.set('view');
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.status === 422) {
          this.errorMessage.set('This project can no longer be edited — it has been completed or cancelled.');
          this.mode.set('view');
          this.loadProject(current.id!);
        } else {
          this.errorMessage.set('Could not save changes. Please check the form and try again.');
        }
      },
    });
  }

  // ---- Add expense ----
  openExpenseDialog(): void {
    this.expenseCategory.set(ProjectExpenseResponse.CategoryEnum.Material);
    this.expenseDescription.set('');
    this.expenseAmount.set('');
    this.expenseDate.set(new Date().toISOString().slice(0, 10));
    this.expenseError.set(null);
    this.expenseDialogOpen.set(true);
  }

  closeExpenseDialog(): void {
    this.expenseDialogOpen.set(false);
  }

  onExpenseCategoryChange(value: string): void {
    this.expenseCategory.set(value as ProjectExpenseResponse.CategoryEnum);
  }

  onExpenseDescriptionChange(value: string): void {
    this.expenseDescription.set(value);
  }

  onExpenseAmountChange(value: string): void {
    this.expenseAmount.set(value);
  }

  onExpenseDateChange(value: string): void {
    this.expenseDate.set(value);
  }

  submitExpense(): void {
    const current = this.project();
    if (!current || current.id === undefined) return;
    const projectId = current.id;

    const description = this.expenseDescription().trim();
    const amount = Number(this.expenseAmount());
    const expenseDate = this.expenseDate();

    if (!description) {
      this.expenseError.set('Description is required.');
      return;
    }
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      this.expenseError.set('Enter an amount greater than zero.');
      return;
    }
    if (!expenseDate) {
      this.expenseError.set('Expense date is required.');
      return;
    }

    const body: ProjectExpenseCreateRequest = {
      category: this.expenseCategory(),
      description,
      amount,
      expenseDate,
    };

    this.expenseSaving.set(true);
    this.expenseError.set(null);

    this.expensesService.create3(projectId, body).subscribe({
      next: () => {
        this.expenseSaving.set(false);
        this.expenseDialogOpen.set(false);
        this.loadSummary(projectId);
        this.loadExpenses(projectId);
      },
      error: (err) => {
        this.expenseSaving.set(false);
        if (err?.status === 422) {
          this.expenseError.set('This project can no longer accept expenses — it has been completed or cancelled.');
        } else {
          this.expenseError.set('Could not record this expense. Please check the form and try again.');
        }
      },
    });
  }

  private loadProject(id: number): void {
    this.loading.set(true);
    this.projectsService.getById2(id).subscribe({
      next: (project) => {
        this.project.set(project);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Project not found.');
        this.loading.set(false);
      },
    });
  }

  private loadSummary(projectId: number): void {
    this.summaryLoading.set(true);
    this.expensesService.getSummary(projectId).subscribe({
      next: (result) => {
        this.summary.set(result);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
      },
    });
  }

  private loadExpenses(projectId: number): void {
    this.expensesLoading.set(true);
    this.expensesError.set(null);
    this.expensesService.search4(projectId, undefined, 0, EXPENSES_FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allExpenses.set((result.content ?? []) as ProjectExpenseResponse[]);
        this.expensesLoading.set(false);
      },
      error: () => {
        this.expensesError.set('Could not load expenses. Please try again.');
        this.expensesLoading.set(false);
      },
    });
  }

  // ---- Crew ----
  openAddCrewDialog(): void {
    const current = this.project();
    if (!current || current.id === undefined) return;

    this.addCrewWorkerId.set(null);
    this.addCrewError.set(null);
    this.addCrewDialogOpen.set(true);
    this.workersService.search(true, 0, ACTIVE_WORKERS_FETCH_SIZE, undefined).subscribe({
      next: (result) => this.activeWorkers.set((result.content ?? []) as WorkerResponse[]),
      error: () => this.activeWorkers.set([]),
    });
  }

  closeAddCrewDialog(): void {
    this.addCrewDialogOpen.set(false);
  }

  onAddCrewWorkerChange(value: string): void {
    this.addCrewWorkerId.set(value ? Number(value) : null);
  }

  submitAddToCrew(): void {
    const current = this.project();
    const workerId = this.addCrewWorkerId();
    if (!current || current.id === undefined || !workerId) {
      this.addCrewError.set('Select a worker.');
      return;
    }
    const projectId = current.id;

    this.addingToCrew.set(true);
    this.addCrewError.set(null);

    const body: WorkerProjectAssignmentCreateRequest = { workerId, projectId };
    this.workerAssignmentsService.create1(body).subscribe({
      next: () => {
        this.addingToCrew.set(false);
        this.addCrewDialogOpen.set(false);
        this.loadCrew(projectId);
      },
      error: (err) => {
        this.addingToCrew.set(false);
        this.addCrewError.set(
          err?.status === 409
            ? 'This worker already has an active assignment elsewhere — remove them from that crew first.'
            : 'Could not add this worker to the crew. Please try again.',
        );
      },
    });
  }

  openRemoveCrewDialog(assignment: WorkerProjectAssignmentResponse): void {
    this.removeCrewTarget.set(assignment);
  }

  closeRemoveCrewDialog(): void {
    this.removeCrewTarget.set(null);
  }

  removeFromCrew(): void {
    const target = this.removeCrewTarget();
    const current = this.project();
    if (!target || target.id === undefined || !current || current.id === undefined) return;
    const projectId = current.id;

    this.removingFromCrew.set(true);
    this.workerAssignmentsService.deactivate1(target.id).subscribe({
      next: () => {
        this.removingFromCrew.set(false);
        this.removeCrewTarget.set(null);
        this.loadCrew(projectId);
      },
      error: () => {
        this.removingFromCrew.set(false);
        this.removeCrewTarget.set(null);
        this.crewError.set('Could not remove this worker from the crew. Please try again.');
      },
    });
  }

  private loadCrew(projectId: number): void {
    this.crewLoading.set(true);
    this.crewError.set(null);
    this.workerAssignmentsService.search1(projectId, true, 0, ACTIVE_WORKERS_FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.crew.set((result.content ?? []) as WorkerProjectAssignmentResponse[]);
        this.crewLoading.set(false);
      },
      error: () => {
        this.crewError.set('Could not load the crew. Please try again.');
        this.crewLoading.set(false);
      },
    });
  }
}
