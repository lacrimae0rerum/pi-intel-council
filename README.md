# Council of Intel: Pi package 0.2.0

Una pregunta de inteligencia, una deliberación SATs o Council, un informe Markdown con toda la evidencia. El paquete usa los modelos configurados en Pi y conserva el corpus original de 17 personalidades. McLaughlin sintetiza las opciones, separa hechos, inferencias y supuestos, calibra la confianza y registra el desacuerdo.

## Instalación y uso temporal

Requiere Pi compatible con las API de **0.85.1**, Node.js 22.19+ y modelos ya configurados en Pi. Revisa el código: las extensiones de Pi tienen acceso al sistema. La implementación local/offline de esta versión está aceptada; no está publicada.

Desde este checkout:

```sh
pi install .
pi
```

Para probar el paquete solo durante una ejecución, sin añadirlo a los ajustes:

```sh
pi -e .
```

No hay dependencias de runtime propias, compilación, servidor, base de datos ni configuración de credenciales del paquete. Pi proporciona sus módulos a la extensión.

## Uso

```text
/council sats ¿Qué hipótesis explican estos observables y qué evidencia las discrimina?
/council council ¿Qué indica el silencio de un actor durante 90 días?
/council sats Analiza estos indicadores con ach-analyst, red-team y key-assumptions-checker.
/council-help
```

`/council` es una plantilla: pide al agente activo que invoque **una sola vez** `council_of_intel`, como única herramienta del lote. Los hooks bloquean una segunda invocación con la misma clave de sesión y mensaje de usuario, incluso entre turnos o tras otra herramienta del lote. Un intento que falla la validación de esquema consume la petición al emitirse `tool_execution_end`. Un registro de proceso en `globalThis` con `Symbol.for` conserva las claves al recargar la extensión; una nueva sesión o un nuevo mensaje permite otra deliberación. El registro crece una clave por petición intentada y se pierde al reiniciar el proceso. El resultado solicita terminar el lote, pero Pi solo evita otro turno si todos los resultados del lote son terminantes. No se activa por iniciativa propia. Si falta la pregunta, el agente debe solicitarla antes de llamar. `/council-help` muestra ayuda sin invocar ningún modelo.

Cada petición puede realizar varias llamadas de pago: con N seats y A seats que requieren una repetición anti-recursión, hasta `2N + A + 2` llamadas del protocolo (como máximo 23 en SATs y 29 en Council). La expansión de la plantilla también necesita un turno del agente activo. La extensión no presupone que tu suscripción incluya esos modelos ni calcula una factura: suma el uso y los costes estimados en USD que comunica Pi.

La pregunta y las respuestas se envían a los proveedores elegidos: Round 1 recibe la pregunta; Round 2, las respuestas anonimizadas; el contrafactual y la síntesis, la evidencia pertinente. No incluyas información que no estés autorizado a compartir con esos proveedores. `cacheRetention: none` solicita no retener caché; no cambia sus políticas de retención. El informe completo también queda en la sesión de Pi y en sus exportaciones.

## Modelos y alcance

Usa `/scoped-models` o `--models` de Pi para limitar el catálogo, por ejemplo:

```sh
pi -e . --models 'anthropic/*,openai/*'
```

Si hay modelos acotados, todos los seats, el chairman y el contrafactual se resuelven exclusivamente dentro de ese conjunto. Un scope vacío es ambiguo en Pi 0.85.1: también puede indicar que un patrón no coincidió. Con UI, se exige confirmación explícita antes de usar todos los modelos configurados disponibles como candidatos; sin UI, se bloquea la llamada y se pide configurar `--models` o `/scoped-models`. La confirmación recibe el `AbortSignal`: rechazarla o abortar cierra el diálogo y cancela sin seleccionar modelos ni realizar completions. Bloquear o cancelar también consume la petición; necesitas un nuevo mensaje de usuario para volver a intentarlo. Una preferencia de la personalidad se usa si está disponible; después se elige el modelo activo permitido y, por último, los modelos permitidos en orden estable. Council evita reutilizar los modelos de seats ya asignados. Las elecciones explícitas fuera del conjunto o ambiguas fallan antes de realizar llamadas. No se leen claves, archivos de autenticación ni variables de credenciales.

| Modo | Seats | Familias | Defaults | Modelos |
|---|---|---|---|---|
| `sats` | 3–7 | A | `ach-analyst`, `red-team`, `devils-advocate` | Se pueden repetir |
| `council` | 3–9 | B/C | `kent`, `heuer`, `feynman` | Únicos entre seats |

El chairman siempre es `mclaughlin` (familia D), con una llamada independiente. El contrafactual usa otra llamada sin historial y un rol neutral; puede emplear el mismo modelo. Repetir personalidad con otro modelo genera un aviso; repetir personalidad y modelo se rechaza. También se avisa si un proveedor supera el 50% de los seats.

## Parámetros de la herramienta

| Parámetro | Tipo | Significado |
|---|---|---|
| `query` | string, obligatorio | Pregunta y evidencia aportada por el usuario |
| `mode` | `sats` o `council` | Por defecto `sats` |
| `seats` | array opcional | Objetos con `personality` y, opcionalmente, `provider` y `model` |
| `chairman` | objeto opcional | `provider` y `model` para la síntesis de McLaughlin |
| `counterfactual` | objeto opcional | `provider` y `model` para la voz adversarial externa |

`model` admite un ID inequívoco o `provider/model`; si incluyes `provider`, debes indicar también el ID en `model`. Puedes expresar estas elecciones en `/council` para que el agente construya los parámetros. Ejemplo estructurado, utilizando IDs que existan en tu catálogo:

```json
{
  "mode": "sats",
  "query": "¿Qué explica estos observables?",
  "seats": [
    { "personality": "ach-analyst", "provider": "openai", "model": "gpt-5.5" },
    { "personality": "red-team" },
    { "personality": "devils-advocate" }
  ]
}
```

## Personalidades

Los archivos `personalities/<id>/{agent,skill,knowledge}.md` son la única fuente de prompts y metadatos. El catálogo valida 17 tripletas y familias 7/5/4/1 al cargar.

- **A: SATs:** `ach-analyst`, `attribution-skeptic`, `devils-advocate`, `indicators-of-change`, `key-assumptions-checker`, `quality-of-info-auditor`, `red-team`.
- **B: Doctrinarios IC:** `clark`, `grabo`, `heuer`, `kent`, `lowenthal`.
- **C: Cognitivos/estratégicos:** `feynman`, `lao-tzu`, `socrates`, `sun-tzu`.
- **D: Chairman:** `mclaughlin`.

## Rondas, resultados y persistencia

1. **Round 0:** valida familia, número de seats, modelos, autenticación configurada y duplicados antes de llamar.
2. **Round 1:** análisis independientes en paralelo; con menos de tres supervivientes termina con `aborted_insufficient_seats`.
3. **Round 2:** mezcla las respuestas y elimina autorreferencias textuales de modelos/proveedores. Los evaluadores reciben `Response A/B/…`, sin correspondencia con los seats. Deben declarar un ganador y discutir al menos dos respuestas; Sócrates/KAC pueden repetir una vez si solo preguntan. Se requieren tres evaluaciones válidas.
4. **Round 3:** el máximo de votos válidos dividido por todos los evaluadores intentados en Round 2 (incluidos los fallidos) determina el acuerdo; solo un valor estrictamente mayor de 0,7 activa un contrafactual externo limitado a 200 palabras.
5. **Round 4:** McLaughlin produce `# Stage Final: Council Answer` con las seis secciones canónicas; se añaden anexos SAT ordenados, metadatos y anexos de las rondas 1/2/3.

Pi muestra el progreso por fases. **Esc** solicita cancelación de las llamadas; si Pi permite finalizar la herramienta, devuelve `cancelled`, evidencia parcial y uso acumulado. Los fallos operativos conocidos devuelven un recibo `failed`, marcado como error y con terminación. Los parámetros inválidos y errores de programación inesperados se lanzan como errores; Pi puede perder el recibo/uso de estos últimos. No se reintenta una deliberación automáticamente.

Una ejecución del protocolo devuelve el Markdown íntegro y el recibo estructurado versionado en `details`. La cancelación previa por scope vacío devuelve un resultado nativo terminante con `details.status = cancelled` y uso cero, sin recibo de rondas porque todavía no existe un plan. El bloqueo del hook usa el resultado nativo de Pi. Pi los guarda en su JSONL, los conserva al bifurcar la sesión y los incluye en `/export`. No se crean archivos de sesiones propios, logs o índices. Las salidas parciales se conservan solo si el runtime puede registrar el resultado: matar el proceso o agotar abruptamente la sesión puede impedirlo.

La anonimización textual no impide inferir estilos o relacionar citas del informe con las respuestas originales. Nunca se entrega una tabla privada de etiquetas y autores. Las comprobaciones de formato no certifican que el razonamiento, la calibración o el desacuerdo sean correctos; esa evaluación necesita revisión humana.

## Comprobación offline

El distribuible contiene solo los archivos de ejecución y el README obligatorio de npm; las pruebas (`bun test`) y la documentación de desarrollo permanecen en el checkout fuente.

```sh
pi -e . --offline --no-session -p "/council-help"
```

El smoke de ayuda solo carga la extensión y muestra texto. Para aislarlo de tu configuración, usa `PI_CODING_AGENT_DIR` con un directorio temporal vacío. La implementación local/offline está aceptada; siguen pendientes las llamadas reales a proveedores, UI humana/cancelación, exportación/bifurcación de sesiones reales y calidad analítica humana. La instalación y la aprobación de release/publicación/tag/despliegue requieren autorización independiente.

## Desinstalación

Ejecuta `pi list` para localizar la referencia local y elimínala con `pi remove /ruta/absoluta/al/paquete`. Si instalaste con `-l`, añade `-l` al quitarlo. Reinicia Pi o recarga sus recursos. El uso temporal con `-e` no necesita desinstalación. Las sesiones históricas de Pi se conservan; el paquete no las borra.
