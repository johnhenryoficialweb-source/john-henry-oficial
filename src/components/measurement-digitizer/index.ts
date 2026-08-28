export { MeasurementMannequin } from "./measurement-mannequin";
export { MeasurementFieldChips } from "./field-chips";
export { ReadonlyMannequinViewer } from "./readonly-mannequin-viewer";
export { useWebglSupport } from "./use-webgl-support";
export { GarmentShell } from "./garments/garment-shell";
export {
  GARMENT_SWATCHES,
  DEFAULT_GARMENT_COLOR,
  fabricColorToHex,
  type GarmentSwatch,
} from "./garment-colors";
export {
  MEASUREMENT_FIELD_CONFIG,
  HEIGHT_FIELD_CONFIG,
  CAPTURE_MIN_CM,
  CAPTURE_MAX_CM,
  clampToCaptureRange,
  isOutsideTypicalRange,
  cmToUnit,
  unitToCm,
  resolveFieldCm,
  estimateMeasurementsFromHeight,
} from "./config";
