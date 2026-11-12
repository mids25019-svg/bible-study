# Bible study

Chat local en español: escribe una cita como `Éxodo 2:20`, selecciona las perspectivas y genera un estudio visual con los 12 comandos del reel adjunto.

## PWA e identidad

La aplicación se llama **Bible study**. El logo original combina una Biblia abierta y una cruz dorada sobre fondo vino. El SVG editable está en `public/icons/logo.svg`, acompañado de PNG de 192 y 512 píxeles, un icono maskable y el icono para iOS. No se necesita ninguna dependencia adicional para usarlos. Para regenerar los PNG con Sharp instalado, ejecuta `node scripts/generate-icons.mjs <directorio-de-sharp>`.

Abre la aplicación con conexión una vez y espera al estado **Lista para consultar sin conexión**. Después, el service worker conserva la interfaz y los módulos necesarios; la biblioteca sigue usando sus datos locales existentes. Puedes abrir, descargar y eliminar láminas guardadas incluso si el servidor deja de responder. La generación de nuevas explicaciones o ilustraciones requiere el servidor y acceso a Internet.

Pulsa **Instalar app** en un navegador compatible. En Chrome/Edge también puedes usar la opción de instalación del menú del navegador; en iPhone/iPad, usa Safari → Compartir → Añadir a pantalla de inicio. En el PC funciona desde `http://localhost:3000`; para instalar en otros dispositivos, publica primero en una dirección HTTPS. Una PWA instalada no ejecuta el servidor Node: la generación de contenido necesita que el servidor esté funcionando localmente o alojado en Internet.

La caché offline incluye solo archivos públicos de la aplicación. No almacena respuestas de `/api/`, claves ni solicitudes de IA. Las láminas siguen en localStorage e IndexedDB, manteniendo los nombres internos de las bases anteriores para conservar tu biblioteca. Cuando haya una nueva versión, el botón **Actualizar app** la activa después de terminar cualquier generación. La primera instalación y cada dominio/dispositivo necesitan su propia preparación offline.

## Iniciar

Requiere Node.js 22 o superior. Desde esta carpeta:

```powershell
node --env-file-if-exists=.env server.mjs
```

Abre http://localhost:3000. En **Conexión de IA**, introduce tu API key y pulsa **Guardar y detectar modelos**. La URL inicial es `https://freellmapi-hrfi.onrender.com/v1`. Puedes seleccionar cualquier modelo publicado o dejar ambos en automático. La configuración introducida en la pantalla vive en memoria hasta reiniciar el servidor; la clave no se guarda en localStorage ni se devuelve al navegador.

Para configuración persistente, copia `.env.example` a `.env` y añade la clave localmente. No compartas ese archivo. En uso local el servidor escucha en 127.0.0.1. En Render usa 0.0.0.0 y requiere contraseña; consulta la sección de despliegue.

## Flujo

1. Escribe una referencia: `Éxodo 2:20`, `Juan 3:16` o `Salmos 23`.
2. El modelo de texto prepara el resumen y un prompt por comando seleccionado. Se solicita JSON cuando el proveedor lo admite; se corrigen comas finales y se vuelve a pedir el estudio si la respuesta llega mal formada, truncada o incompleta. En modo automático, los fallos repetidos permiten probar otro modelo.
3. Cada perspectiva debe incluir una explicación sustancial, entre tres y cinco secciones con títulos y contenido, y una reflexión final. La aplicación valida estos campos y pide corregir respuestas incompletas. La ilustración se solicita sin letras y se integra en una **lámina vertical explicada**, con la cita y todos los textos legibles añadidos por la aplicación.
4. Cada ilustración se genera por separado, con progreso y opción de detener o reintentar. Si el proveedor falla, se detienen los intentos de imágenes y se prepara el estudio profundo con conexiones bíblicas. Las láminas escritas siguen disponibles con la ilustración marcada como pendiente.
5. **Descargar estudio profundo** genera un único documento Word (.docx) del estudio abierto, o del más reciente si no hay uno abierto. Incluye el texto bíblico consultado, síntesis, perspectivas, contexto, ideas clave, rutas de lectura, conexiones justificadas, aplicaciones y preguntas. La descarga no depende de que haya ilustraciones. El historial conserva tus estudios sin un límite artificial de cantidad, sujeto al espacio disponible en el navegador; las ilustraciones nuevas se guardan en IndexedDB y los textos en localStorage. Borrar los datos del navegador elimina esta copia local.
6. Para estudios anteriores, usa **Completar explicaciones**; se consulta solo el modelo de texto. Si la ilustración antigua ya no está disponible, **Generar ilustración** la vuelve a solicitar después de completar las explicaciones.
7. Abre **Biblioteca** (también disponible en celular) para ver estudios anteriores. **Eliminar lámina** borra esa perspectiva y su ilustración guardada. La cruz de cada estudio elimina el estudio completo y todas sus ilustraciones. Ambas acciones piden confirmación, afectan solo este navegador y no borran los documentos Word que hayas descargado. Si eliminas la última lámina, el estudio desaparece de la biblioteca.

## Alojamiento y almacenamiento local

`localhost:3000` corresponde a esta computadora. Una publicación en Internet tendrá otra dirección. Los estudios y las ilustraciones se guardan en el navegador de cada dispositivo y dirección (localStorage e IndexedDB), no en el disco del servidor Node. No se sincronizan entre dispositivos, entre navegadores ni entre `localhost` y un dominio publicado. Conserva copias descargadas de las láminas que necesites guardar fuera del navegador.

Render ofrece un plan gratuito para servicios Node.js, con suspensión por inactividad y límites de uso. Esta versión está preparada para un espacio personal con contraseña: en Render escucha en 0.0.0.0, valida el dominio del servicio y protege todas las operaciones de IA y configuración con una sesión firmada HttpOnly. `/health` permite verificar que el servidor está disponible sin llamar a la IA. La biblioteca local puede consultarse sin iniciar sesión y sin conexión en el navegador que ya la tiene guardada; la contraseña protege el acceso al servidor, no cifra los datos del dispositivo.

## Exportación profunda y conexiones

Puedes elegir dos o tres niveles de conexiones, con un máximo de siete pasajes por estudio. El modelo propone cadenas del tipo pasaje original → referencia relacionada → otra referencia, justificando cada relación dentro del contexto. No pretende enumerar todas las interpretaciones posibles. Distingue conexiones temáticas y referencias explícitas propuestas, rechaza ciclos y referencias duplicadas y exige explicaciones en todos los nodos.

Se consulta el texto de Reina Valera 1909 mediante la API pública de bible-api.com, sin compartir tu clave de IA con esa fuente. Si la fuente no responde o no encuentra un versículo, se marca como no consultado o no encontrado; nunca se inventa una cita literal para suplirla. Que un texto esté consultado no verifica la interpretación del modelo. Las conexiones y textos consultados se guardan junto al estudio para lecturas y exportaciones posteriores sin conexión. Crear o ampliar un estudio profundo requiere tu conexión de IA y puede consumir su cuota.

## Publicar en Render

El repositorio contiene `render.yaml` para un único servicio web en el plan **free**, sin bases de datos ni discos de pago. Render ejecuta `node --test` como comprobación y `node server.mjs` para iniciar. La biblioteca sigue guardándose exclusivamente en el navegador del usuario.

1. Conecta el repositorio en Render mediante **New → Blueprint**, usando `render.yaml` de la rama `main`.
2. Introduce la clave unificada de FreeLLMAPI en `AI_API_KEY` cuando Render la solicite. No la guardes en GitHub ni en el chat.
3. El Blueprint genera `APP_PASSWORD` y `SESSION_SECRET` de forma segura. Tu contraseña de acceso se consulta en **Environment → APP_PASSWORD** del servicio desde tu cuenta de Render. Puedes sustituirla por una propia de al menos doce caracteres y desplegar ese cambio.
4. Aplica el Blueprint y espera a que el despliegue esté **Live**. Abre su URL HTTPS, inicia sesión y pulsa **Instalar app** para usar la PWA.

También puedes crear un Web Service directamente con plan Free, build `node --test`, start `node server.mjs` y health check `/health`. Configura `AI_BASE_URL`, `AI_API_KEY`, una `APP_PASSWORD` de al menos doce caracteres y `SESSION_SECRET`; Render proporciona automáticamente `RENDER_EXTERNAL_URL`. Si alojas la app en otra plataforma, define `HOST=0.0.0.0` y `PUBLIC_ORIGIN=https://tu-dominio`.

La clave de IA configurada en Environment sobrevive a los reinicios del servicio. La introducida solo en la pantalla de la aplicación vive en memoria y se pierde al reiniciar. La cookie de sesión dura siete días y requiere que `SESSION_SECRET` sea estable. No publiques este servicio como una plataforma multiusuario: es un espacio personal y su configuración de IA es compartida tras autenticarse con la contraseña.

Comandos transcritos del video: `/devotional`, `/scene`, `/people`, `/place`, `/map`, `/timeline`, `/chapter`, `/verse`, `/symbolism`, `/cinematic`, `/context`, `/meaning`.

## Compatibilidad

**Cloudflare conectado en FreeLLMAPI:** conserva la URL `https://freellmapi-hrfi.onrender.com/v1` y usa la **clave unificada de FreeLLMAPI** en Biblia Visual. Deja vacíos la URL y la clave independientes de imágenes. El modo automático de imágenes envía `model: "auto"` a `/images/generations`, ya que el catálogo de medios del proxy es independiente de su catálogo de texto. En el panel del proxy, Cloudflare necesita Account ID y token de Workers AI, y un modelo de imágenes habilitado. La app no copia ni solicita el token de Cloudflare en este caso. Para otros proxies con catálogo separado puedes elegir **Automático del proveedor**. La selección queda a cargo del proxy y la aplicación no puede verificar su cuota ni garantizar que el proxy elija un proveedor gratuito.

Usa `GET /models`, `POST /chat/completions` y `POST /images/generations` compatibles con OpenAI. Para imágenes acepta `data[0].url` o `data[0].b64_json`. Los endpoints y capacidades reales requieren validación con tu API key. Solo se ofrecen en el selector de imágenes modelos con nombres o capacidades de salida de imagen; los modelos de visión que solo leen imágenes no cuentan. Si tu servidor solo ofrece texto, configura una **URL base de imágenes** y su **API key de imágenes** en Conexión de IA, o las variables `IMAGE_BASE_URL` y `IMAGE_API_KEY` en `.env`. La clave de texto nunca se reutiliza automáticamente en una URL de imágenes diferente. La selección automática usa metadatos y nombres, con preferencia heurística por capacidad; no mide la calidad real ni conoce la cuota restante. Prueba hasta cuatro alternativas ante HTTP 404, 429 o fallos temporales 5xx; para imágenes también prueba otras alternativas ante 400 o 422. Un proveedor con otro formato de imágenes requiere un adaptador.

Cada perspectiva seleccionada puede consumir una generación de imagen. Por defecto están seleccionadas las doce. Los pasajes son paráfrasis del modelo, no una consulta a una edición bíblica verificada; revisa el contenido con tu Biblia. Mapas, cronologías y reconstrucciones son interpretaciones artísticas.

## Verificación

```powershell
node --test
```

Las pruebas cubren referencias, clasificación de modelos, validación del plan y conexión completa a un proveedor simulado. No consumen cuota de IA.
