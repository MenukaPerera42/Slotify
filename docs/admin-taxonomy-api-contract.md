# Stage 7D.1 administrator taxonomy backend

All actions return `{ success: true, data }` or `{ success: false, code, error, fieldErrors? }`. Import department actions from `@/features/departments/actions/department-actions` and category actions from `@/features/resources/actions/category-actions`. All management reads and writes reload the active signed-in user from PostgreSQL and require `ADMIN`. A member receives `FORBIDDEN`; a missing or inactive session receives `UNAUTHENTICATED`. IDs are UUID strings.

## Departments

| Action | Input | Success data |
| --- | --- | --- |
| `listDepartmentsAction(input?)` | `{ search?, status?: "ALL" \| "ACTIVE" \| "INACTIVE", page?, pageSize? }` | `{ items, total, page, pageSize }`; each item includes `_count.users`, `_count.reservations`, `_count.previousCorrections`, `_count.newCorrections` |
| `listActiveDepartmentsAction(input?)` | Same list input; status forced active | Same paginated shape |
| `createDepartmentAction(input)` | `{ name, code, description?, isActive? }` | Department |
| `updateDepartmentAction(id, input)` | UUID, nonempty subset of `{ name?, code?, description? }` | Department |
| `setDepartmentStatusAction({ id, isActive })` | UUID, boolean | Department |
| `deleteDepartmentAction(id)` | UUID | Deleted department |
| `listUsersByDepartmentAction(input)` | `{ departmentId, page?, pageSize? }` | Paginated users |
| `assignUserDepartmentAction({ userId, departmentId })` | UUIDs | Assigned user summary |
| `listSignupDepartmentsAction()` | None; public | Active `{ id, name, code }[]` |
| `getMyDepartmentAction()` | None; signed-in active user | `{ department, assignmentRequired }` |

Names are trimmed, 2–100 characters. Codes are trimmed, uppercased, and 2–12 letters or digits starting with a letter. Descriptions are nullable and at most 500 characters. List search covers name and code, case insensitively. Defaults are page 1, page size 50; maximum page size is 100. `DUPLICATE_NAME` and `DUPLICATE_CODE` cover case variants. Invalid fields/IDs return `INVALID_INPUT`. An absent deletion target returns `NOT_FOUND`; an absent update/status target retains `DEPARTMENT_NOT_FOUND` for existing clients. Other existing errors include `DEPARTMENT_INACTIVE`, `DEPARTMENT_IN_USE`, and `USER_NOT_FOUND`.

Deactivation refuses departments with active users so their membership is not invalidated. It does not rewrite old reservations. Booking and signup paths reject inactive departments; the reservation insert trigger also checks the active department. Deletion locks the department and requires zero linked users, reservations, and both sides of correction history. PostgreSQL `RESTRICT` foreign keys remain the final race protection. There is no cascade deletion.

## Resource categories

| Action | Input | Success data |
| --- | --- | --- |
| `listCategoriesAction(input?)` | `{ search?, status?: "ALL" \| "ACTIVE" \| "INACTIVE", page?, pageSize? }` | `{ items, total, page, pageSize }`; each item includes `_count.resources` |
| `createCategoryAction(input)` | `{ name, description? }` | Category |
| `updateCategoryAction(id, input)` | UUID, nonempty subset of `{ name?, description? }` | Category |
| `setCategoryStatusAction({ id, isActive })` | UUID, boolean | Category |
| `deleteCategoryAction(id)` | UUID | Deleted category |

Category names are trimmed, 2–100 characters, unique without regard to case. Descriptions are nullable and at most 500 characters. Search matches names case insensitively. List pagination matches departments. Errors are `INVALID_INPUT`, `DUPLICATE_NAME`, `NOT_FOUND`, `IN_USE`, `FORBIDDEN`, `UNAUTHENTICATED`, or `DATABASE_ERROR`. Deactivation retains all resource links and old resources remain readable and filterable. Deletion requires zero linked resources; the category foreign key is `RESTRICT`.

## Resource assignment and refresh

`getCategories()` returns every category for historical resource filters. `getActiveResourceCategories()` returns active categories for new resource selectors. The existing resource form omits inactive options for creation but keeps an existing inactive category visible while editing that resource. `createResourceAction(formData)` and `updateResourceAction(id, formData)` validate `categoryId` as a UUID, check the category row under a database lock, and reject an absent category with `NOT_FOUND`. Creation and reassignment reject an inactive category with `INACTIVE_CATEGORY`. Editing a resource that already has an inactive category may retain that association. Resource actions retain the existing `{ success, data?, error?, fieldErrors? }` shape and now include `code?` for assignment and validation errors.

Department mutations revalidate `/administration`, `/signup`, `/reservations`, `/resources`, and `/dashboard`. Category mutations revalidate `/administration`, `/resources`, `/reservations`, and `/dashboard`. Resource mutations revalidate `/resources` and the specific resource path. Clients with local copies should refresh after a successful mutation.

The migration adds `ResourceCategory.isActive` and `updatedAt`, preserving all IDs and associations. It adds case insensitive unique indexes for department name/code and category name. Existing categories default active. The migration requires existing names/codes to have no case variant collisions; review and resolve any such collisions before applying it. No original records are deleted by the migration.
