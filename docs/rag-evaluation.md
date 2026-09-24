# Evaluación reproducible de RAG

El evaluator de desarrollo mide retrieval y generación sobre un corpus español
versionado. No expone endpoints, no modifica código productivo y no forma parte de
`pnpm test` ni de `pnpm run test:integration`.

## Requisitos

- PostgreSQL 17 con pgvector y una base de test migrada cuyo `TEST_DB_NAME`
  termine en `_test` y sea distinto de `DB_NAME`.
- Ollama accesible mediante `OLLAMA_BASE_URL`.
- El modelo de embeddings configurado (por defecto `embeddinggemma`) y el modelo
  generativo configurado (por defecto `qwen3:8b`).

Preparación local:

```bash
pnpm run docker:db
pnpm run db:test:setup
ollama pull embeddinggemma
ollama pull qwen3:8b
pnpm test:rag-eval
```

El comando valida primero el dataset, inicializa la aplicación con las mismas
protecciones de base de test que E2E, limpia la base segura y siembra sus propios
fixtures. Luego ejecuta los casos secuencialmente con `topK: 5` y registra el
strong threshold, moderate threshold y minimum gap efectivos junto con los
modelos configurados y observados.

## Dataset

`test/rag-evaluation/dataset.ts` contiene cuatro productos, seis documentos y
evidencias con claves estables. Los UUID se resuelven después de persistir los
fixtures y cada chunk conserva `evidenceKey` en `metadata`.

La versión `1.3.0` tiene 24 casos y modela el comportamiento esperado sin un
booleano ambiguo:

- 15 casos `FULL_ANSWER`, donde toda la pregunta tiene respaldo.
- 3 casos `PARTIAL_ANSWER`, donde se debe responder la parte respaldada e
  identificar explícitamente el dato que falta.
- 6 casos `ABSTAIN`, donde se espera la respuesta canónica de insuficiencia sin
  sources.

Los tres casos de la versión 1.2.0 comparten un chunk largo basado en la
[ficha técnica oficial de AirPods Pro 2](https://support.apple.com/es-es/111834):
la pregunta general sobre Bluetooth debe usar el fast path y citarlo; las
preguntas sobre alcance y códecs no pueden pasar el AND léxico porque esos datos
no aparecen en el chunk y deben continuar absteniéndose.

La versión 1.3.0 agrega un producto aislado con la evidencia `Peso: 384,8 g` y
el caso `lexical-weight-01` (`¿Cuánto pesan?`). El interrogativo se elimina antes
de FTS, `pesan` se relaciona con `Peso` mediante el diccionario español y el caso
debe resolverse por el fast path sin invocar embeddings. En misses léxicos con
producto, la consulta vectorial incorpora exclusivamente `product.name` y la
pregunta original; el prompt conserva la pregunta sin enriquecer.

Cada caso declara opcionalmente `productKey`, alternativas válidas en
`expectedEvidenceKeys`, `expectedBehavior`, grupos de términos de respuesta y
términos prohibidos. Los casos parciales también declaran grupos de términos que
deben identificar la parte no respaldada y expresar la limitación. Los checks
normalizan mayúsculas, diacríticos y espacios; no comparan respuestas completas
ni usan snapshots.

La presencia de la frase canónica de insuficiencia dentro de una respuesta
parcial no se considera abstención completa. La abstención completa exige que la
respuesta sea exactamente esa frase. Esto permite responder un dato respaldado y
usar la frase para delimitar otro dato ausente sin penalizar el comportamiento.

## Métricas y diagnóstico

Retrieval reporta Hit@1, Hit@3, Hit@5, primera posición relevante, modo,
candidatos efectivos con score tipado y duración. Un caso léxico registra sólo
su ganador con `lexicalScore`; un caso vectorial registra el top 5 con
`similarity`. Los casos sin evidencia esperada quedan fuera de esos
denominadores; los parcialmente respondibles sí participan.

Generation registra respuesta o abstención, grupos esperados, términos prohibidos,
sources, modelo observado, tiempo real del LLM y duración total. La clasificación
primaria usa esta precedencia:

1. `retrieval failure`: no aparece evidencia esperada en top 5.
2. `abstention/grounding failure`: un caso `ABSTAIN` responde o devuelve sources,
   aparece un término prohibido o falta la source esperada de una respuesta.
3. `generation failure`: retrieval correcto pero no se cumple `FULL_ANSWER` o
   `PARTIAL_ANSWER`; incluye abstención prematura, términos respaldados ausentes o
   falta de identificación explícita de la parte no respaldada.

`falseAbstentions` cuenta casos `FULL_ANSWER` o `PARTIAL_ANSWER` que terminaron en
la abstención canónica completa. `falseAnswers` cuenta casos `ABSTAIN` que no
terminaron en esa abstención. Estas dos métricas aíslan el comportamiento del gate;
no reemplazan los checks de términos, sources y grounding.

Los fallos de calidad se imprimen y se guardan, pero el comando termina con código
cero para servir como baseline diagnóstico. Un dataset inválido, un fallo de
PostgreSQL/Ollama/modelo/setup o la imposibilidad de escribir el reporte hace fallar
la suite; no hay skips silenciosos.

## Contrato del artefacto

Cada ejecución reemplaza `artifacts/rag-evaluation.json`, ignorado por Git. El
schema actual es la versión 4 e incluye:

- `dataset`: versión, SHA-256 y cantidad de casos; sólo se comparan corridas
  apples-to-apples cuando estos tres valores coinciden;
- `configuration`: `topK`, los tres thresholds, modelos configurados y modelos
  realmente observados;
- `metrics`: retrieval, comportamiento por tipo esperado, falsos rechazos,
  falsas respuestas y clasificación primaria;
- `results`: pregunta, comportamiento esperado, `retrievalMode`, candidatos
  efectivos con `score: { type, value }` y `evidenceKey`, rank relevante,
  respuesta, sources, checks y diagnósticos;
- `infrastructureFailure`: `null` en una corrida válida o el error que invalida
  la comparación.

`generationDurationMs=null` y `observedModel=null` indican que el LLM no fue
invocado. Si ambos tienen valor, un eventual `generation failure` ocurrió después
del gate y no debe corregirse ajustando thresholds sin una hipótesis separada.

## Verificación 1.2.0 del fast path léxico

La corrida de aceptación usa dataset `1.2.0`, SHA-256
`14addb68774a215e4e94e659e72ea1c64ccd9b3757ca0ace4cfd3e37b35a891d` y 23
casos. Mantiene Hit@1/3/5 de 100%, cero falsas abstenciones, cero falsas
respuestas, cero fallos de retrieval y cero fallos de grounding. El caso
`lexical-01` registra `retrievalMode=lexical`, un candidato con
`score.type=lexicalScore`, genera una respuesta sobre Bluetooth 5.3 y cita el
chunk de AirPods. Los casos `lexical-unsupported-01` y
`lexical-unsupported-02` registran `retrievalMode=vector` y terminan en la
abstención canónica porque FTS no encontró todos sus términos y el gate vectorial
fue insuficiente.

La corrida produjo 20/23 comportamientos correctos. Los tres fallos restantes
son de generación ya conocidos o equivalentes (`answer-10`, `partial-02` y
`partial-03`); no son falsas respuestas, falsas abstenciones ni regresiones de
retrieval.

## Verificación 1.3.0 del enriquecimiento de recuperación

La corrida de aceptación usa dataset `1.3.0`, SHA-256
`ba33f5c9e5fd067959710d38babb9ad8b0a1f864fffd975c9f55e0ad2310346c` y 24
casos. Mantiene Hit@1/3/5 de 100%, 0 respuestas falsas, 0 fallos de retrieval y
0 fallos de abstención/grounding. `lexical-weight-01` registra
`retrievalMode=lexical`, evidencia `travel-mini-peso` en rank 1 y una respuesta
respaldada por `384,8 g`.

La corrida produjo 21/24 comportamientos correctos: 14/15 `FULL_ANSWER`, 1/3
`PARTIAL_ANSWER` y 6/6 `ABSTAIN`. Quedaron tres fallos de generación
(`answer-10`, `partial-01` y `partial-02`), una falsa abstención y ninguna falsa
respuesta. Los casos existentes no produjeron nuevos fallos de grounding; cuando
el contexto de producto hace que el gate admita evidencia insuficiente, la
abstención canónica del LLM se devuelve sin sources.

## Baseline 1.1.0 y análisis del relevance gate

La corrida BEFORE usa dataset `1.1.0`, SHA-256
`14f1bc5c28a796ade26bf0563b3532d1370b2dc9226df85ae47535ee83bf31c6`,
`embeddinggemma`, `qwen3:8b`, `topK: 5` y el gate histórico
`similarity >= 0.5`. Conserva Hit@1/3/5 de 100% y mean first relevant rank 1.
Produce 14 `passed`, 6 `generation failure`, 0 `retrieval failure` y 0
`abstention/grounding failure`. Los seis fallos son abstenciones previas al LLM:
`answer-03`, `answer-04`, `answer-07`, `answer-10`, `partial-02` y `partial-03`.

El root cause estaba en `RagService`, después de `RetrievalService`: descartaba
cada chunk por debajo de `0.5` y se abstenía cuando ninguno sobrevivía. Los seis
casos tenían evidencia correcta en rank 1, pero top 1 inferior a `0.5`; por eso
`generationDurationMs` y `observedModel` eran `null`.

Los 20 casos muestran que un threshold absoluto no separa las clases:

- entre los 16 casos `FULL_ANSWER`/`PARTIAL_ANSWER`, top 1 mínimo es `0.407` y el
  gap top 1−top 2 mínimo es `0.135`;
- entre los 4 casos `ABSTAIN`, top 1 máximo es `0.432` y el gap máximo es `0.028`;
- bajar el threshold absoluto a `0.4` recupera los 6 falsos negativos, pero deja
  pasar `unsupported-02`;
- la regla escalonada `top1 >= 0.5 OR (top1 >= 0.4 AND gap >= 0.12)` separa los
  20 casos según el comportamiento esperado.

| Caso           | Esperado       | top 1 | top 2 | gap   | Evidencia | Decisión nueva               |
| -------------- | -------------- | ----- | ----- | ----- | --------- | ---------------------------- |
| answer-01      | FULL_ANSWER    | 0.565 | 0.374 | 0.191 | rank 1    | strong_similarity            |
| answer-02      | FULL_ANSWER    | 0.532 | 0.214 | 0.318 | rank 1    | strong_similarity            |
| answer-03      | FULL_ANSWER    | 0.457 | 0.189 | 0.268 | rank 1    | moderate_similarity_with_gap |
| answer-04      | FULL_ANSWER    | 0.416 | 0.281 | 0.135 | rank 1    | moderate_similarity_with_gap |
| answer-05      | FULL_ANSWER    | 0.610 | 0.375 | 0.234 | rank 1    | strong_similarity            |
| answer-06      | FULL_ANSWER    | 0.576 | 0.381 | 0.195 | rank 1    | strong_similarity            |
| answer-07      | FULL_ANSWER    | 0.448 | 0.252 | 0.196 | rank 1    | moderate_similarity_with_gap |
| answer-08      | FULL_ANSWER    | 0.615 | 0.253 | 0.362 | rank 1    | strong_similarity            |
| answer-09      | FULL_ANSWER    | 0.630 | 0.235 | 0.394 | rank 1    | strong_similarity            |
| answer-10      | FULL_ANSWER    | 0.407 | 0.229 | 0.178 | rank 1    | moderate_similarity_with_gap |
| answer-11      | FULL_ANSWER    | 0.523 | 0.281 | 0.242 | rank 1    | strong_similarity            |
| answer-12      | FULL_ANSWER    | 0.529 | 0.205 | 0.324 | rank 1    | strong_similarity            |
| unsupported-01 | ABSTAIN        | 0.364 | 0.340 | 0.024 | n/a       | insufficient_relevance       |
| unsupported-02 | ABSTAIN        | 0.432 | 0.404 | 0.028 | n/a       | insufficient_relevance       |
| unsupported-03 | ABSTAIN        | 0.175 | 0.157 | 0.018 | n/a       | insufficient_relevance       |
| unsupported-04 | ABSTAIN        | 0.378 | 0.367 | 0.010 | n/a       | insufficient_relevance       |
| partial-01     | PARTIAL_ANSWER | 0.503 | 0.311 | 0.192 | rank 1    | strong_similarity            |
| partial-02     | PARTIAL_ANSWER | 0.480 | 0.178 | 0.303 | rank 1    | moderate_similarity_with_gap |
| partial-03     | PARTIAL_ANSWER | 0.447 | 0.268 | 0.178 | rank 1    | moderate_similarity_with_gap |
| partial-04     | FULL_ANSWER    | 0.621 | 0.242 | 0.380 | rank 1    | strong_similarity            |

Los valores elegidos son `0.50`, `0.40` y `0.12`. El strong threshold conserva el
comportamiento anterior para evidencia clara. El moderate threshold queda apenas
`0.0069` por debajo del positivo más cercano (`answer-10`), mientras que el gap
queda `0.0148` por debajo del positivo más cercano (`answer-04`) y `0.0923` por
encima del negativo con mayor gap (`unsupported-02`). Son márgenes útiles para el
experimento, no una validación externa.

## Resultado BEFORE vs AFTER

La corrida AFTER usa exactamente el mismo dataset `1.1.0`, hash, fixtures,
`topK`, modelos, retrieval y prompt.

| Métrica                    | BEFORE | AFTER |
| -------------------------- | ------ | ----- |
| Retrieval Hit@1            | 100%   | 100%  |
| Retrieval Hit@3            | 100%   | 100%  |
| Retrieval Hit@5            | 100%   | 100%  |
| Mean first relevant rank   | 1      | 1     |
| Full answer correct        | 9/13   | 11/13 |
| Partial answer correct     | 1/3    | 1/3   |
| Abstention correct         | 4/4    | 4/4   |
| Total passed               | 14/20  | 16/20 |
| False abstentions          | 6      | 0     |
| False answers              | 0      | 0     |
| Retrieval failures         | 0      | 0     |
| Abstention/grounding fails | 0      | 0     |
| Generation failures        | 6      | 4     |

Los seis casos antes bloqueados ahora ejecutan `qwen3:8b`. `answer-04` y
`answer-07` pasan. `answer-03` responde 2 horas pero omite USB-C; `answer-10`
menciona CLEAN pero omite la pastilla; `partial-02` no usa una formulación de
limitación aceptada por el evaluator; y `partial-03` no identifica explícitamente
el consumo eléctrico como la parte sin respaldo. Estos cuatro son fallos de
generación observados después de superar el gate, no falsas abstenciones.

## Riesgo de calibración

El dataset sólo contiene cuatro negativos y no es un conjunto de validación
independiente. Deben agregarse, en una iteración separada, negativos con top 1
entre `0.40` y `0.50` y gaps cercanos a `0.12`, positivos con top 1 cercano a
`0.40`, retrieval con un único resultado, consultas con dos chunks realmente
relevantes y top 1/top 2 próximos, y negativos con top 1 superior a `0.50`. Hasta
entonces los thresholds son provisionales.
