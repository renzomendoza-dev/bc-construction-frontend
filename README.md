# BC Construction Services — Frontend

Angular frontend for BC Construction Services' inventory, equipment, and admin operations, authenticated via Keycloak against the `bc-construction-backend` API. See [CHANGELOG.md](./CHANGELOG.md) for a running history of changes.

## Features

- **Dashboard** — module overview cards with live inventory, equipment, and project stats.
- **Inventory**
  - Items — list, detail (view/edit toggle), create, images, linked suppliers, categories.
  - Suppliers — list with create/edit drawer.
  - Warehouses & Sites — list/create, `MAIN`/`SITE` type, storage locations, a "View Stock" shortcut into Stock Levels pre-filtered to that warehouse.
  - Purchase Receipts — draft → confirm workflow that applies stock on confirmation, optionally linked to a fulfilling Transfer Batch or Purchase Order.
  - Purchase Orders — an earlier ordering-ahead stage, with auto-suggested (freely editable) line items from stock shortfalls/low stock/open material requests, draft → submit → partially received/received workflow, manual close, deletable drafts, and a shortcut to receive against an order.
  - Stock Levels — grouped-by-item view with Low Stock and Movement History tabs, per-row Adjust/Transfer actions, inline reorder-threshold editing, and a clear banner (with a one-click reset) when scoped to a single warehouse.
  - Transfers — batched stock transfers between a warehouse and a site (pull-out or dispatch), draft → submit workflow, with per-line stock availability hints, deletable drafts, an automatic `Awaiting Purchase` block (with a linked Purchase Receipt to resolve it) when submitting hits insufficient stock, and an optional linked Project that auto-records a Material expense (cost on dispatch, credit on pull-out) when submitted.
  - Material Requests — a site's request for materials, with edit-in-place support, deletable drafts, stock availability hints, and a shortcut to create a fulfilling dispatch transfer.
  - Every line-item form above (Material Requests, Transfers, Purchase Receipts, Purchase Orders) prevents picking the same item twice within one document.
- **Equipment** — list, checkout/checkin, create/edit, batch assignment/return/transfer (assign to a site, return to a warehouse, or transfer directly between two sites), all linked to real Warehouse records instead of a free-text site.
- **Projects** — code/name/budget/dates through an Active → On Hold → Completed lifecycle, manual expense entry (Labor/Material/Other), a running expense summary against budget, a filterable expense history, and a Crew section for assigning/removing workers.
- **Workers** — a field-labor roster independent of app-login Users (name/position/daily rate, active/inactive), with a daily Attendance log per worker that auto-records a Labor expense on the chosen project, plus an Attendance Calendar for batch-recording a whole project crew's time in/out for a day in one submission.
- **Admin** — user list with activate/deactivate and Keycloak realm-role assignment.
- **Access control** — mutating UI actions are gated behind fine-grained permissions read from the authenticated user's Keycloak JWT.
- Responsive layout (collapsible/overlay sidebar, scrollable tables, stacked forms on narrow screens).

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.8.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
