export class PagerEntity<T> {
    itemCount: number | undefined;
    totalItems: number | undefined;
    itemsPerPage: number | undefined;
    totalPages: number | undefined;
    currentPage: number | undefined;
    entity: T | undefined;
}