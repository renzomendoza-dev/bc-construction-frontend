import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectCreateRequest, ProjectsService } from '../../../generated';
import { localDateString } from '../../../core/utils/local-date';

@Component({
  selector: 'app-project-create',
  imports: [],
  templateUrl: './project-create.html',
  styleUrl: './project-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCreateComponent {
  private readonly projectsService = inject(ProjectsService);
  private readonly router = inject(Router);

  readonly code = signal('');
  readonly name = signal('');
  readonly description = signal('');
  readonly budget = signal('');
  readonly startDate = signal(localDateString(new Date()));
  readonly endDate = signal('');

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  backToList(): void {
    this.router.navigate(['/projects']);
  }

  onCodeChange(value: string): void {
    this.code.set(value);
  }

  onNameChange(value: string): void {
    this.name.set(value);
  }

  onDescriptionChange(value: string): void {
    this.description.set(value);
  }

  onBudgetChange(value: string): void {
    this.budget.set(value);
  }

  onStartDateChange(value: string): void {
    this.startDate.set(value);
  }

  onEndDateChange(value: string): void {
    this.endDate.set(value);
  }

  createProject(): void {
    const code = this.code().trim();
    const name = this.name().trim();
    const startDate = this.startDate();

    if (!code || !name || !startDate) {
      this.errorMessage.set('Code, name, and start date are required.');
      return;
    }

    const budgetInput = this.budget().trim();
    const budget = budgetInput ? Number(budgetInput) : undefined;
    if (budget !== undefined && Number.isNaN(budget)) {
      this.errorMessage.set('Budget must be a number.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: ProjectCreateRequest = {
      code,
      name,
      description: this.description().trim() || undefined,
      budget,
      startDate,
      endDate: this.endDate() || undefined,
    };

    this.projectsService.create2(body).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.router.navigate(['/projects', created.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(
          err?.status === 409
            ? 'A project with this code already exists.'
            : err?.error?.message || 'Could not create project. Please check the form and try again.',
        );
      },
    });
  }
}
