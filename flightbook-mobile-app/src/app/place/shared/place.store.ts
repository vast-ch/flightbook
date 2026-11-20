import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Place } from './place.model';
import { Pager } from 'src/app/shared/domain/pager.model';
import { FeatureCollection, Position } from 'geojson';

export interface PlaceState {
  places: Place[];
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class PlaceStore {
  // HTTP client
  private http = inject(HttpClient);
  
  // State
  private state = signal<PlaceState>({
    places: [],
    loading: false,
    error: null
  });
  
  /**
   * Bumped whenever a place is created, edited or deleted. The writes do not
   * touch the cached rows: PlaceListPage compares this against the revision its
   * rows were loaded at and reloads on enter, the way the flight list does.
   */
  public revision = signal(0);

  // Default limit for pagination
  public defaultLimit = 25;
  
  // Selectors (computed values)
  public places = computed(() => this.state().places);
  public loading = computed(() => this.state().loading);
  public error = computed(() => this.state().error);
  
  constructor() {}
  
  getPlaces({ limit = null, offset = null, store = true, clearStore = false }: 
    { limit?: number, offset?: number, store?: boolean, clearStore?: boolean } = {}): Observable<Place[]> {
    
    this.state.update(state => ({ ...state, loading: true }));
    
    let params: HttpParams = this.createFilterParams(limit, offset);
    
    return this.http.get<Place[]>(`${environment.baseUrl}/places`, { params }).pipe(
      tap({
        next: (response: Place[]) => {
          if (store) {
            // Update state with new places
            this.state.update(state => {
              let newPlaces: Place[];
              
              if (clearStore) {
                newPlaces = [...response];
              } else {
                newPlaces = [...state.places, ...response];
                // Sort by name
                newPlaces.sort((a, b) => a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1);
              }
              
              return {
                ...state,
                places: newPlaces,
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
            error: error.message || 'An error occurred while fetching places' 
          }));
        }
      }),
      map(response => response)
    );
  }
  
  getPlacesByName(name: string, { limit = null, offset = null }: { limit?: number, offset?: number } = {}): Observable<Place[]> {
    this.state.update(state => ({ ...state, loading: true }));
    
    let params = new HttpParams();
    if (limit) {
      params = params.append('limit', limit.toString());
    }
    if (offset) {
      params = params.append('offset', offset.toString());
    }
    
    return this.http.get<Place[]>(`${environment.baseUrl}/places/${name}`, { params }).pipe(
      tap({
        next: () => this.state.update(state => ({ ...state, loading: false, error: null })),
        error: (error) => this.state.update(state => ({ 
          ...state, 
          loading: false, 
          error: error.message || 'An error occurred while fetching places by name' 
        }))
      })
    );
  }
  
  postPlace(place: Place): Observable<Place> {
    this.state.update(state => ({ ...state, loading: true }));
    
    return this.http.post<Place>(`${environment.baseUrl}/places`, place).pipe(
      tap({
        next: () => {
          this.state.update(state => ({ ...state, loading: false, error: null }));
          this.bumpRevision();
        },
        error: (error) => {
          this.state.update(state => ({
            ...state,
            loading: false,
            error: error.message || 'An error occurred while saving the place'
          }));
        }
      })
    );
  }
  
  putPlace(place: Place): Observable<Place> {
    this.state.update(state => ({ ...state, loading: true }));
    
    return this.http.put<Place>(`${environment.baseUrl}/places/${place.id}`, place).pipe(
      tap({
        next: () => {
          this.state.update(state => ({ ...state, loading: false, error: null }));
          this.bumpRevision();
        },
        error: (error) => {
          this.state.update(state => ({ 
            ...state, 
            loading: false, 
            error: error.message || 'An error occurred while updating the place' 
          }));
        }
      })
    );
  }
  
  deletePlace(place: Place): Observable<Place> {
    this.state.update(state => ({ ...state, loading: true }));
    
    return this.http.delete<Place>(`${environment.baseUrl}/places/${place.id}`).pipe(
      tap({
        next: () => {
          this.state.update(state => ({ ...state, loading: false, error: null }));
          this.bumpRevision();
        },
        error: (error) => {
          this.state.update(state => ({ 
            ...state, 
            loading: false, 
            error: error.message || 'An error occurred while deleting the place' 
          }));
        }
      })
    );
  }
  
  /** A place was created, edited or deleted. */
  private bumpRevision(): void {
    this.revision.update(value => value + 1);
  }

  searchOpenstreetmapPlace(name: string): Observable<FeatureCollection> {
    return this.http.get<FeatureCollection>(`${environment.baseUrl}/places/openstreetmap/${name}`);
  }
  
  getPlaceMetadata(coordinates: Position): Observable<Place> {
    let params = new HttpParams()
      .append('lat', coordinates[1])
      .append('lng', coordinates[0]);
  
    return this.http.get<Place>(`${environment.baseUrl}/places/metadata`, {params});
  }
  
  clearPlaces(): void {
    this.state.update(state => ({ ...state, places: [] }));
  }
  
  private createFilterParams(limit: number, offset: number): HttpParams {
    let params = new HttpParams();
    if (limit) {
      params = params.append('limit', limit.toString());
    }
    if (offset) {
      params = params.append('offset', offset.toString());
    }
    return params;
  }
}
