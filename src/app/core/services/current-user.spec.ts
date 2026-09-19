import { TestBed } from '@angular/core/testing';
import Keycloak from 'keycloak-js';
import { CurrentUserService } from './current-user';

function setup(tokenParsed: Record<string, unknown> | undefined): CurrentUserService {
  TestBed.configureTestingModule({
    providers: [{ provide: Keycloak, useValue: { tokenParsed } }],
  });
  return TestBed.inject(CurrentUserService);
}

describe('CurrentUserService', () => {
  it('grants a permission present in realm_access.roles', () => {
    const service = setup({ realm_access: { roles: ['PURCHASE_ORDER_SUBMIT'] } });
    expect(service.hasPermission('PURCHASE_ORDER_SUBMIT')).toBe(true);
  });

  it('denies a permission that is absent, even when a related one is present', () => {
    // Regression: PO Submit was once gated on Edit — holding Edit must not imply Submit.
    const service = setup({ realm_access: { roles: ['PURCHASE_ORDER_EDIT'] } });
    expect(service.hasPermission('PURCHASE_ORDER_SUBMIT')).toBe(false);
  });

  it('denies everything when the token has no realm roles', () => {
    const service = setup({});
    expect(service.roles).toEqual([]);
    expect(service.hasPermission('ITEM_CREATE')).toBe(false);
  });

  it('denies everything when there is no parsed token at all', () => {
    const service = setup(undefined);
    expect(service.hasPermission('ITEM_CREATE')).toBe(false);
  });

  it('falls back from full name to username to a placeholder', () => {
    expect(setup({ name: 'Renzo Mendoza', preferred_username: 'renzo' }).fullName).toBe('Renzo Mendoza');
    TestBed.resetTestingModule();
    expect(setup({ preferred_username: 'renzo' }).fullName).toBe('renzo');
    TestBed.resetTestingModule();
    expect(setup({}).fullName).toBe('Unknown User');
  });
});
