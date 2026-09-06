import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectResponse, ProjectsService } from '../../../generated';
import { formatPeso } from '../../../core/model.currency';
import { CurrentUserService } from '../../../core/services/current-user';
import { Permission } from '../../../core/constants/permissions';

const PAGE_SIZE = 8;
// Same "fetch a large batch, filter/paginate client-side" convention used
// across every list page in this app, for UX consistency even though
// search() supports server-side status filtering.
const FETCH_SIZE = 300;

type StatusFilter = 'all' | ProjectResponse.StatusEnum;

@Component({
  selector: 'app-projects-list',
  imports: [DatePipe],
  templateUrl: './projects-list.html',
  styleUrl: './projects-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsListComponent implements OnInit {
  private readonly projectsService = inject(ProjectsService);
  private readonly router = inject(Router);
  private readonly currentUser = inject(CurrentUserService);

  readonly formatPeso = formatPeso;
  readonly canCreate = this.currentUser.hasPermission(Permission.ProjectCreate);

  private readonly allProjects = signal<ProjectResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly statusFilter = signal<StatusFilter>('all');
  readonly page = signal(1);

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    return this.allProjects().filter((p) => status === 'all' || p.status === status);
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  readonly pageItems = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });
  readonly hasResults = computed(() => this.filtered().length > 0);
  readonly pageSummary = computed(() => {
    const total = this.filtered().length;
    if (total === 0) return '';
    const start = (this.currentPage() - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.currentPage() * PAGE_SIZE, total);
    return `Showing ${start}–${end} of ${total}`;
  });

  ngOnInit(): void {
    this.fetchProjects();
  }

  onStatusFilterChange(value: StatusFilter): void {
    this.statusFilter.set(value);
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  openProject(id: number | undefined): void {
    if (id === undefined) return;
    this.router.navigate(['/projects', id]);
  }

  createNew(): void {
    this.router.navigate(['/projects/new']);
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

  private fetchProjects(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.projectsService.search1(undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allProjects.set((result.content ?? []) as ProjectResponse[]);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load projects. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
