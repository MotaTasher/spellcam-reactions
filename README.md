# SpellCam — реакции

Открытый бесплатный магазин реакций для видеокружков Telegram: салют, «БАХ!», лазеры
из глаз, аура и всё, что придумаете. Реакции включаются **прямо во время записи** кружка.

Здесь только реакции: как они выглядят, как сделать свою и проверить её. Каждая реакция
из этой репы появляется в боте [@spellcambot](https://t.me/spellcambot).

Попробовать без Telegram — песочница: https://motatasher.github.io/spellcam-reactions/ (нужна камера).

## Реакции

| <img src="docs/previews/fireworks.gif" width="160" alt="Салют"> | <img src="docs/previews/confetti.gif" width="160" alt="Конфетти"> | <img src="docs/previews/hearts.gif" width="160" alt="Сердечки"> | <img src="docs/previews/money.gif" width="160" alt="Деньги"> |
|:---:|:---:|:---:|:---:|
| 🎆 **Салют** | 🎉 **Конфетти** | 💖 **Сердечки** | 💸 **Деньги** |
| <img src="docs/previews/bam.gif" width="160" alt="БАХ!"> | <img src="docs/previews/vzhuh.gif" width="160" alt="Вжух"> | <img src="docs/previews/ogo.gif" width="160" alt="ОГО!"> | <img src="docs/previews/haha.gif" width="160" alt="ХА-ХА"> |
| 💥 **БАХ!** | 🪄 **Вжух** | 😍 **ОГО!** | 😂 **ХА-ХА** |
| <img src="docs/previews/lasers.gif" width="160" alt="Лазеры"> | <img src="docs/previews/sad.gif" width="160" alt="Грусть"> | <img src="docs/previews/deal.gif" width="160" alt="Очки"> | <img src="docs/previews/wasted.gif" width="160" alt="Потрачено"> |
| 🔴 **Лазеры** | 🌧️ **Грусть** | 😎 **Очки** | 💀 **Потрачено** |
| <img src="docs/previews/drama.gif" width="160" alt="Драма"> | <img src="docs/previews/aura.gif" width="160" alt="Аура"> | <img src="docs/previews/no.gif" width="160" alt="Нет!"> | <img src="docs/previews/yes.gif" width="160" alt="Да!"> |
| 🎭 **Драма** | ⚡ **Аура** | 🚫 **Нет!** | ✅ **Да!** |
| <img src="docs/previews/drumroll.gif" width="160" alt="Та-дам"> | <img src="docs/previews/crickets.gif" width="160" alt="Сверчки"> | <img src="docs/previews/applause.gif" width="160" alt="Браво"> | <img src="docs/previews/replay.gif" width="160" alt="Повтор"> |
| 🥁 **Та-дам** | 🦗 **Сверчки** | 👏 **Браво** | 🔁 **Повтор** |
| <img src="docs/previews/freeze.gif" width="160" alt="Стоп-кадр"> | <img src="docs/previews/rewind.gif" width="160" alt="Перемотка"> |
| 📸 **Стоп-кадр** | ⏪ **Перемотка** |

У каждой реакции есть звук: он слышен во время записи и попадает в кружок.

**Повтор**, **Стоп-кадр** и **Перемотка** работают со временем: страница помнит последние
секунды камеры, и реакция показывает прошлое: замедленный повтор, застывший кадр,
перемотку назад. Микрофон при этом пишет дальше, так что поверх повтора можно
комментировать.

Каждая реакция — отдельный файл в [`effects/`](effects/). Добавить свою — ниже.

## Песочница у себя

```sh
python3 server.py     # http://127.0.0.1:8765
```

Пробел — запись, 1–0, q–p, a и s — реакции. Реакции рисуются на canvas 2D, лицо и силуэт
находит [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector)
прямо в браузере, сборки нет. `./tools/vendor.sh` один раз скачает MediaPipe локально
(без него он грузится с jsDelivr).

## Сделать свою реакцию

1. Скопируйте [`effects/_template.js`](effects/_template.js) в
   `effects/<id>.js`.
2. Допишите строчку в [`effects/index.js`](effects/index.js):
   импорт и место в массиве `EFFECTS` (порядок = порядок кнопок).
3. Проверьте глазами на http://127.0.0.1:8765 и пришлите PR. Имя файла =
   `id` реакции. В PR сам запустится [GitHub Actions](.github/workflows/reactions.yml):
   прогонит все реакции на мультяшном лице (не падает, заканчивается за 15 секунд,
   держит кадр) и приложит GIF-превью вашей реакции во вложениях к проверке.
   Локально то же самое: `CHROME=… node tools/check.mjs [id]`.

Эффект — объект `{ id, name, emoji, author, face, make }` (`author` — ваш ник на
GitHub, по желанию; `face: true` — эффекту нужно лицо, пока он идёт, лицо
отслеживается чаще). `make(env)` вызывается при каждом
нажатии и возвращает экземпляр эффекта:

| поле | обязательно | что делает |
|---|---|---|
| `update(dt, env)` | да | шаг анимации, `dt` в секундах |
| `draw(ctx, env)` | да | рисует поверх кадра |
| `done` | да | `true`, когда эффект закончился (обычно геттер) |
| `shake()` | нет | `{x, y}` — сдвиг всего кадра (тряска) |
| `filter()` | нет | строка CSS-фильтра для кадра камеры: `grayscale(.8)` |
| `zoom(env)` | нет | `{ s, x, y, tx?, ty?, rot? }` — наезд камеры: масштаб `s` вокруг точки `(x, y)`, которая переезжает в `(tx, ty)`; края кадра не открываются |
| `base(ctx, env)` | нет | рисует сразу после кадра, до остальных эффектов (фон, свечение за человеком) |
| `overlay(ctx, env)` | нет | рисует поверх всего, без тряски (вспышка) |
| `needsMask` | нет | `true` — пока эффект идёт, включается маска человека |
| `sound(audio)` | нет | звук реакции: вызывается один раз при нажатии, `audio = { ac, out }` — `AudioContext` и узел, куда подключать. Звук попадает в кружок вместе с голосом и слышен во время записи |
| `source(env)` | нет | кадр вместо живой камеры на этот кадр: canvas любого размера (растянется на C×C) или `{ canvas, face }`, тогда остальные эффекты видят в `env.face` лицо из показанного кадра (если `face` пустое, остаётся живое). `null` — живая камера. Если кадр подменяют несколько эффектов, побеждает нажатый последним. Фильтры, наезд, тряска, `base`, `draw` и `overlay` работают поверх; маска и `edgePoint` остаются живыми |

`env`:

| поле | что это |
|---|---|
| `C` | сторона кадра в пикселях (640) |
| `face` | `{ eyes: [{x,y},{x,y}], box: {x,y,w,h} }` или `null`, координаты уже в кадре. Пока какой-то эффект подменяет кадр через `source`, здесь лицо из показанного кадра |
| `mask` | canvas C×C, альфа = человек (только при `needsMask`) |
| `frame` | canvas C×C с чистым кадром камеры, всегда живым |
| `history(sec)` | кадр камеры `sec` секунд назад: `{ canvas, face, ago }` — ближайший запомненный кадр, его лицо и точный возраст в секундах, или `null`, если камера ещё ничего не показала. Кадр чистый, без эффектов, уменьшен вдвое (сторона C/2), рисовать растянутым на C×C; `face` в координатах кадра. Помнятся последние ~3,5 секунды, 15 кадров в секунду. Canvas потом перезаписывается, поэтому его запрашивают заново каждый кадр, а не хранят |
| `historySpan` | сколько секунд прошлого уже есть: сразу после включения камеры меньше, чем нужно реакции, и она должна это пережить |
| `layer(i)` | запасной canvas C×C (0 и 1) для своих слоёв |
| `edgePoint()` | случайная точка на контуре человека или `null` |

В [`effects/lib.js`](effects/lib.js) лежат помощники: `rand`, `pick`, `clamp`,
`envelope` (плавное появление и исчезание), `easeOutBack`, `drawGlow` (быстрое
свечение спрайтом, хорошо с `ctx.globalCompositeOperation = 'lighter'`),
`emojiSprite`, `heart`, `faceOrDefault` (лицо или разумное место по центру,
если лица нет).

Звуки синтезируются кодом, файлов нет. В [`effects/sfx.js`](effects/sfx.js):
кирпичики `tone(audio, { type, from, to, curve, dur, gain, filter, vibrato, … })` и
`noise(audio, { dur, gain, filter, … })`, и готовые звуки — `boom`, `hit`, `pop`,
`whoosh`, `sparkle`, `chime`, `tada`, `fireworks`, `cash`, `zap`, `hum`, `boing`,
`laugh`, `sadTrombone`, `dunDunDun`, `riff`, `wasted`, `powerUp`, а для реакций со
временем `sting` (заставка повтора), `slowMo`, `scratch` (пластинка), `whir`, `clunk`
и `tapeStart` (видеомагнитофон). Все принимают
`(audio, at)` — задержку в секундах от нажатия, так что звук можно собрать из
нескольких: `sound(a) { whoosh(a); sparkle(a, 0.22); }`. Послушать все звуки без
камеры: `CHROME=… node tools/sounds.mjs папка` — сложит WAV по одному на реакцию.

Несколько правил, чтобы эффекты уживались:

- всё в координатах кадра `C × C`, размеры от `C`, а не в пикселях: кадр могут
  поменять;
- `ctx.save()` / `ctx.restore()` вокруг своего рисования;
- эффект конечный: 2–6 секунд, потом `done`; звук — до 6 секунд и без клиппинга
  (пик до 1.0), проверка это меряет;
- эффекты можно жать по несколько сразу, поэтому не трогайте общее состояние;
- без внешних картинок и шрифтов из сети: рисуйте кодом или эмодзи;
- держите 60 fps на ноутбуке: сотни частиц нормально, тысячи с `shadowBlur` уже нет.

Превью для README (мультяшное лицо вместо камеры): `CHROME=… node tools/previews.mjs [id …]`.

Скриншоты всех эффектов без камеры (headless Chrome с подставной камерой):

```sh
npm i
python3 server.py &
CHROME="/путь/к/chrome" npm run shots          # или: npm run shots -- bam aura
```

## Лицензия

MIT. Модели в `models/` — [MediaPipe](https://github.com/google-ai-edge/mediapipe) от Google, Apache 2.0.
