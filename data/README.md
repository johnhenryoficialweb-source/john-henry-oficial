# Carpeta `data/` (solo local)

Esta carpeta **no forma parte del repositorio Git** salvo este README y el marcador `new/.gitkeep`.

## Uso

- **`data/new/`** — Coloca aquí archivos de importación temporal (CSV, XLSX, JSON de migración, etc.) mientras ejecutas scripts de importación o limpieza de datos.
- **`data/backups/`** — Exportes o respaldos locales generados por herramientas del proyecto (nunca subir al repo).

## Qué no commitear

- Datos de clientes, medidas, órdenes o contabilidad.
- Manuales de marca, assets de branding o documentación interna pesada.
- Cualquier binario (`.xlsx`, `.pdf`, `.png`, `.csv`, `.json` de backup).

Los archivos en `data/new/*` y `data/backups/*` están ignorados por `.gitignore`. Mantén copias sensibles solo en tu máquina o en almacenamiento seguro fuera del repo.
