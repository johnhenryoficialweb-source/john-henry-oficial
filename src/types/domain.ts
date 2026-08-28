import type { GarmentType } from "./database.types";

/** Forma esperada de client_measurements.values (jsonb), por tipo de prenda. */
export type MeasurementValues = Record<string, number>;

export interface GarmentMeasurement {
  garmentType: GarmentType;
  values: MeasurementValues;
}
