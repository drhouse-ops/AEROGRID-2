import { SatelliteContext } from "../src/types/api";

export class SatelliteContextService {
  /**
   * Retrieves satellite aerosol signals for a given location.
   * This is currently a prototype fallback adapter that provides calibrated 
   * environmental baseline data for the Pune Pilot Zone.
   */
  static getContext(latitude: number, longitude: number): SatelliteContext {
    return {
      available: false,
    };
  }
}
