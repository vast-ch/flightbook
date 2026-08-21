import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, concatMap, map, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Glider } from './glider.model';
import { Pager } from 'src/app/shared/domain/pager.model';
import { GliderFilter } from './glider-filter.model';

export interface GliderState {
  gliders: Glider[];
  loading: boolean;
  error: string | null;
  filtered: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GliderStore {
  // HTTP client
  private http = inject(HttpClient);
  
  // State
  private state = signal<GliderState>({
    gliders: [],
    loading: false,
    error: null,
    filtered: false
  });
  
  /**
   * A signal, as the flight filter is: the summary chips derive from it, and a
   * plain object cannot tell them a single criterion was dropped - `filtered`
   * stays true when others remain, so nothing downstream would recompute.
   */
  public filter = signal<GliderFilter>(new GliderFilter());
  
  // Default limit for pagination
  public defaultLimit = 40;
  
  // Flag for list completion
  public isGliderlistComplete = false;
  
  // Flag to disable list
  public disableList = false;
  
  // Selectors (computed values)
  public gliders = computed(() => this.state().gliders);
  public loading = computed(() => this.state().loading);
  public error = computed(() => this.state().error);
  public filtered = computed(() => this.state().filtered);
  
  constructor() {}
  
  /**
   * @param archived overrides the filter's own archived value for this request
   * only, without writing to the shared filter and without marking the glider
   * list as filtered. The flight forms need active gliders for their dropdown;
   * they used to get them by assigning the shared filter and restoring it in the
   * response handler, which left the list filtered by "Archived: no" on any
   * error, and - now that the list draws its filter - showed a chip for a filter
   * the pilot never set.
   */
  getGliders({ limit = null, offset = null, store = true, clearStore = false, archived = null }:
    { limit?: number, offset?: number, store?: boolean, clearStore?: boolean, archived?: string } = {}): Observable<Glider[]> {

    this.state.update(state => ({ ...state, loading: true }));

    let params: HttpParams = this.createFilterParams(limit, offset, archived);
    
    return this.http.get<Glider[]>(`${environment.baseUrl}/gliders`, { params }).pipe(
      tap({
        next: (response: Glider[]) => {
          if (store) {
            // Update state with new gliders
            this.state.update(state => {
              let newGliders: Glider[];
              
              if (clearStore) {
                newGliders = [...response];
              } else {
                newGliders = [...state.gliders, ...response];
                // Sort by brand and name
                newGliders.sort((a, b) => {
                  if (a.brand.toUpperCase() === b.brand.toUpperCase()) {
                    return a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1;
                  }
                  return a.brand.toUpperCase() > b.brand.toUpperCase() ? 1 : -1;
                });
              }
              
              return {
                ...state,
                gliders: newGliders,
                loading: false,
                error: null
              };
            });
          } else {
            this.state.update(state => ({ ...state, loading: false, error: null }));
          }
        },
        error: (error) => {
          this.state.update(state => ({ 
            ...state, 
            loading: false, 
            error: error.message || 'An error occurred while fetching gliders' 
          }));
        }
      }),
      map(response => response)
    );
  }
  
  getGliderByName(name: string): Observable<Glider> {
    if (!name) {
      return new Observable<Glider>(observer => {
        observer.error('Name is required');
        observer.complete();
      });
    }
    
    this.state.update(state => ({ ...state, loading: true }));
    
    return this.http.get<Glider>(`${environment.baseUrl}/gliders/name/${name}`).pipe(
      tap({
        next: () => this.state.update(state => ({ ...state, loading: false, error: null })),
        error: (error) => this.state.update(state => ({ 
          ...state, 
          loading: false, 
          error: error.message || 'An error occurred while fetching glider by name' 
        }))
      })
    );
  }
  
  postGlider(glider: Glider): Observable<Glider> {
    this.state.update(state => ({ ...state, loading: true }));
    
    return this.http.post<Glider>(`${environment.baseUrl}/gliders`, glider).pipe(
      tap((response: Glider) => {
        // Mark the post operation as complete
        this.state.update(state => ({
          ...state,
          loading: false,
          error: null
        }));
        this.isGliderlistComplete = false;
      }),
      // After posting the glider, get the updated glider list
      concatMap((response: Glider) => {
        return this.getGliders({ limit: this.defaultLimit, clearStore: true }).pipe(
          map(() => response)
        );
      }),
      tap({
        error: (error) => {
          this.state.update(state => ({ 
            ...state, 
            loading: false, 
            error: error.message || 'An error occurred while saving the glider' 
          }));
        }
      })
    );
  }
  
  putGlider(glider: Glider): Observable<Glider> {
    this.state.update(state => ({ ...state, loading: true }));
    
    return this.http.put<Glider>(`${environment.baseUrl}/gliders/${glider.id}`, glider).pipe(
      tap({
        next: (response: Glider) => {
          this.state.update(state => {
            const updatedGliders = [...state.gliders];
            const index = updatedGliders.findIndex((listGlider: Glider) => listGlider.id === response.id);
            
            if (index !== -1) {
              updatedGliders[index] = glider;
              // Sort by brand and name
              updatedGliders.sort((a, b) => {
                if (a.brand.toUpperCase() === b.brand.toUpperCase()) {
                  return a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1;
                }
                return a.brand.toUpperCase() > b.brand.toUpperCase() ? 1 : -1;
              });
            }
            
            return {
              ...state,
              gliders: updatedGliders,
              loading: false,
              error: null
            };
          });
        },
        error: (error) => {
          this.state.update(state => ({ 
            ...state, 
            loading: false, 
            error: error.message || 'An error occurred while updating the glider' 
          }));
        }
      })
    );
  }
  
  deleteGlider(glider: Glider): Observable<any> {
    this.state.update(state => ({ ...state, loading: true }));
    
    return this.http.delete<any>(`${environment.baseUrl}/gliders/${glider.id}`).pipe(
      tap((response: any) => {
        // Mark the delete operation as complete
        this.state.update(state => ({
          ...state,
          loading: false,
          error: null
        }));
        this.isGliderlistComplete = false;
      }),
      // After deleting the glider, get the updated glider list
      concatMap((response: any) => {
        return this.getGliders({ limit: this.defaultLimit, clearStore: true }).pipe(
          map(() => response)
        );
      }),
      tap({
        error: (error) => {
          this.state.update(state => ({ 
            ...state, 
            loading: false, 
            error: error.message || 'An error occurred while deleting the glider' 
          }));
        }
      })
    );
  }
  
  clearGliders(): void {
    this.state.update(state => ({ ...state, gliders: [] }));
  }
  
  /** Patches the filter in place, the way FlightStore.updateFilter does. */
  updateFilter(patch: Partial<GliderFilter>): void {
    this.filter.update(current => Object.assign(new GliderFilter(), current, patch));
  }

  resetFilter(): void {
    this.filter.set(new GliderFilter());
  }

  private createFilterParams(limit: number, offset: number, archived: string | null = null): HttpParams {
    let params = new HttpParams();
    const stored = this.filter();
    // The override applies to the request, never to what the list reports as
    // filtered - the pilot did not ask for it.
    const effective = archived === null ? stored : Object.assign(new GliderFilter(), stored, { archived });

    if (effective.brand && effective.brand !== "") {
      params = params.append('brand', effective.brand);
    }

    if (effective.name && effective.name !== "") {
      params = params.append('name', effective.name);
    }

    if (effective.type && effective.type !== "") {
      params = params.append('type', effective.type);
    }

    if (effective.archived && effective.archived !== "") {
      params = params.append('archived', effective.archived);
    }

    if (limit) {
      params = params.append('limit', limit.toString());
    }

    if (offset) {
      params = params.append('offset', offset.toString());
    }

    if (archived === null) {
      this.setFilterState(this.isFilterActive(stored));
    }
    return params;
  }

  private isFilterActive(filter: GliderFilter): boolean {
    return !!(filter.brand || filter.name || filter.type || filter.archived);
  }
  
  private setFilterState(nextState: boolean) {
    this.state.update(state => ({ ...state, filtered: nextState }));
  }
}
