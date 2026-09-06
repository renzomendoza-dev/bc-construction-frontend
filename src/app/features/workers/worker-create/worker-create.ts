import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WorkerCreateRequest, WorkersService } from '../../../generated';

@Component({
  selector: 'app-worker-create',
  imports: [],
  templateUrl: './worker-create.html',
  styleUrl: './worker-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkerCreateComponent {
  private readonly workersService = inject(WorkersService);
  private readonly router = inject(Router);

  readonly name = signal('');
  readonly position = signal('');
  readonly dailyRate = signal('');

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  backToList(): void {
    this.router.navigate(['/workers']);
  }

  onNameChange(value: string): void {
    this.name.set(value);
  }

  onPositionChange(value: string): void {
    this.position.set(value);
  }

  onDailyRateChange(value: string): void {
    this.dailyRate.set(value);
  }

  createWorker(): void {
    const name = this.name().trim();
    const dailyRateInput = this.dailyRate().trim();
    const dailyRate = Number(dailyRateInput);

    if (!name || !dailyRateInput || Number.isNaN(dailyRate) || dailyRate < 0) {
      this.errorMessage.set('Name and a valid daily rate are required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: WorkerCreateRequest = {
      name,
      position: this.position().trim() || undefined,
      dailyRate,
    };

    this.workersService.create(body).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.router.navigate(['/workers', created.id]);
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Could not add this worker. Please check the form and try again.');
      },
    });
  }
}
