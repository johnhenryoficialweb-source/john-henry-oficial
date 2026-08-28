# John Henry Oficial — guía para agentes

## 1. Flujo de trabajo obligatorio (GitHub + Pime Git + Vercel)

Todo el código y la documentación del proyecto viven en GitHub. Los despliegues de **producción** son automáticos cuando se hace push a `main`; no hay deploy manual con la CLI de Vercel.

| Concepto | Valor |
|----------|--------|
| Repositorio (web) | https://github.com/johnhenryoficialweb-source/john-henry-oficial |
| Remote Git | `git@github.com-johnhenryoficialweb:johnhenryoficialweb-source/john-henry-oficial.git` |
| Perfil Pime Git | `johnhenryoficialweb` |
| Producción Vercel | https://john-henry-oficial.vercel.app |
| Dominio | https://www.johnhenryoficial.com |

El proyecto de Vercel está conectado al repositorio de GitHub: cada push a `main` dispara un build y deploy en producción.

### Comandos permitidos para Git

Usar **solo** Pime Git (nunca `git commit`, `git push` ni `git pull` directos):

```bash
pime-git verify
pime-git commit --m "mensaje descriptivo"
pime-git push
pime-git pull
```

Antes de commitear, ejecutar `pime-git verify` y corregir lo que falle.

### Prohibido

- **No** usar `git commit`, `git push` o `git pull` sin el wrapper Pime Git.
- **No** usar `npx vercel deploy` (ni `--prod`) para producción: el deploy es vía integración GitHub → Vercel.
- **No** subir datos sensibles ni archivos de importación en `data/` (ver `data/README.md`).

Variables de entorno: la plantilla versionada es `.env.example`; los secretos van en `.env.local` (ignorado).

---

## 2. Reglas UX del producto

Las reglas obligatorias de experiencia de usuario (smart defaults, progressive disclosure, una acción principal por pantalla, etc.) están definidas en:

**`.cursor/rules/ux-system-rules.mdc`**

Consulta ese archivo antes de dar por terminada cualquier pantalla, formulario o flujo del CMS o del sitio público. No dupliques aquí el texto completo: es la fuente de verdad para UX.
