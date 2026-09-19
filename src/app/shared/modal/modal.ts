import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

let nextId = 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell: centered dialog or right-hand drawer. The host
 * element is the backdrop itself, so backdrop-click and Escape are handled
 * here rather than by a clickable <div> in every consumer template.
 *
 * Projected content can use the unencapsulated helper classes
 * `app-modal__body`, `app-modal__form`, and `app-modal__actions`.
 */
@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-modal',
    '[class.app-modal--drawer]': "variant() === 'drawer'",
    '[class.app-modal--lightbox]': "variant() === 'lightbox'",
    '[class.app-modal--wide]': 'wide()',
    '(click)': 'onHostClick($event)',
    '(document:keydown.escape)': 'closed.emit()',
  },
})
export class ModalComponent {
  readonly title = input.required<string>();
  // 'lightbox' shows projected media on a dark backdrop with the title
  // visually hidden (still announced by screen readers).
  readonly variant = input<'dialog' | 'drawer' | 'lightbox'>('dialog');
  readonly wide = input(false);
  readonly closed = output<void>();

  readonly titleId = `app-modal-title-${nextId++}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly previouslyFocused = inject(DOCUMENT).activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => this.panel().nativeElement.focus());
    inject(DestroyRef).onDestroy(() => this.previouslyFocused?.focus?.());
  }

  onHostClick(event: MouseEvent): void {
    if (event.target === this.host.nativeElement) this.closed.emit();
  }

  // Keeps Tab/Shift+Tab cycling inside the panel while it's open.
  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(this.panel().nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.host.nativeElement.ownerDocument.activeElement;
    if (event.shiftKey && (active === first || active === this.panel().nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
