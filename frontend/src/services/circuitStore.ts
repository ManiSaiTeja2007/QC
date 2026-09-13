/**
 * Frontend CircuitStore Singleton.
 *
 * Provides in-memory caching, request coalescing, and pub/sub reactivity
 * across SidebarNav, CircuitHubModal, and LiveSimulationWorkspace.
 *
 * Avoids duplicate concurrent GET requests to /api/circuits and /api/circuits/{id}.
 */

import { CircuitFileSchema, CircuitIndexResponse } from '../types/circuit';
import { fetchCircuits, fetchCircuitDetails } from './api';

type Listener = () => void;

class CircuitStore {
  private catalog: CircuitIndexResponse | null = null;
  private catalogPromise: Promise<CircuitIndexResponse> | null = null;
  private catalogVersion = 0;

  private circuitDetails: Map<string, CircuitFileSchema> = new Map();
  private circuitPromises: Map<string, Promise<CircuitFileSchema>> = new Map();
  private circuitVersions: Map<string, number> = new Map();

  private listeners: Set<Listener> = new Set();

  /**
   * Subscribe to catalog changes (e.g. after upload, update, delete).
   * Returns an unsubscribe function.
   */
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('CircuitStore listener error:', err);
      }
    });
  }

  /**
   * Fetches or returns cached catalog index.
   * Coalesces simultaneous requests into a single in-flight promise.
   * Version guard prevents an in-flight fetch from repopulating stale data.
   */
  public async getCatalog(forceRefresh = false): Promise<CircuitIndexResponse> {
    if (!forceRefresh && this.catalog !== null) {
      return this.catalog;
    }

    if (!forceRefresh && this.catalogPromise !== null) {
      return this.catalogPromise;
    }

    const currentVersion = this.catalogVersion;
    this.catalogPromise = (async () => {
      try {
        const res = await fetchCircuits();
        // Guard: only commit if catalog was not invalidated while fetch was in-flight
        if (this.catalogVersion === currentVersion) {
          this.catalog = res;
        }
        return res;
      } finally {
        if (this.catalogVersion === currentVersion) {
          this.catalogPromise = null;
        }
      }
    })();

    return this.catalogPromise;
  }

  /**
   * Fetches or returns cached circuit specification.
   * Coalesces simultaneous requests for the same circuit ID.
   * Version guard prevents stale in-flight fetches from overwriting updated state.
   */
  public async getCircuit(circuitId: string, forceRefresh = false): Promise<CircuitFileSchema> {
    if (!forceRefresh && this.circuitDetails.has(circuitId)) {
      return this.circuitDetails.get(circuitId)!;
    }

    if (!forceRefresh && this.circuitPromises.has(circuitId)) {
      return this.circuitPromises.get(circuitId)!;
    }

    const currentVersion = this.circuitVersions.get(circuitId) || 0;
    const promise = (async () => {
      try {
        const detail = await fetchCircuitDetails(circuitId);
        // Guard: only commit if circuit was not modified/deleted while in-flight
        if ((this.circuitVersions.get(circuitId) || 0) === currentVersion) {
          this.circuitDetails.set(circuitId, detail);
        }
        return detail;
      } finally {
        this.circuitPromises.delete(circuitId);
      }
    })();

    this.circuitPromises.set(circuitId, promise);
    return promise;
  }

  /**
   * Updates or sets a circuit directly in cache (e.g. after save/update).
   */
  public setCircuit(circuit: CircuitFileSchema): void {
    const cur = this.circuitVersions.get(circuit.id) || 0;
    this.circuitVersions.set(circuit.id, cur + 1);
    this.circuitDetails.set(circuit.id, circuit);
    this.circuitPromises.delete(circuit.id);

    // Invalidate catalog so next getCatalog reloads fresh summary
    this.catalogVersion++;
    this.catalog = null;
    this.catalogPromise = null;
    this.notify();
  }

  /**
   * Invalidates a circuit from cache (e.g. after delete).
   */
  public invalidateCircuit(circuitId: string): void {
    const cur = this.circuitVersions.get(circuitId) || 0;
    this.circuitVersions.set(circuitId, cur + 1);
    this.circuitDetails.delete(circuitId);
    this.circuitPromises.delete(circuitId);

    this.catalogVersion++;
    this.catalog = null;
    this.catalogPromise = null;
    this.notify();
  }

  /**
   * Invalidates the entire catalog cache and notifies subscribers.
   */
  public invalidateCatalog(): void {
    this.catalogVersion++;
    this.catalog = null;
    this.catalogPromise = null;
    this.notify();
  }

  /**
   * Completely clears all store caches.
   */
  public clearAll(): void {
    this.catalogVersion++;
    this.circuitVersions.clear();
    this.catalog = null;
    this.catalogPromise = null;
    this.circuitDetails.clear();
    this.circuitPromises.clear();
    this.notify();
  }
}

export const circuitStore = new CircuitStore();
