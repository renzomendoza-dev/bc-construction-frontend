import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentUserService } from '../services/current-user';

/** Gates admin-only routes behind the ADMIN realm role from the Keycloak JWT. */
export const adminGuard: CanActivateFn = () => {
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);

  if (currentUser.roles.includes('ADMIN')) {
    return true;
  }

  return router.createUrlTree(['/']);
};
