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
| <img src="docs/previews/drama.gif" width="160" alt="Драма"> | <img src="docs/previews/aura.gif" width="160" alt="Аура"> |
| 🎭 **Драма** | ⚡ **Аура** |

Каждая реакция — отдельный файл в [`effects/`](effects/). Добавить свою — ниже.

## Песочница у себя

```sh
python3 server.py     # http://127.0.0.1:8765
```

Пробел — запись, 1–0 и q–r — реакции. Реакции рисуются на canvas 2D, лицо и силуэт
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

`env`:

| поле | что это |
|---|---|
| `C` | сторона кадра в пикселях (640) |
| `face` | `{ eyes: [{x,y},{x,y}], box: {x,y,w,h} }` или `null`, координаты уже в кадре |
| `mask` | canvas C×C, альфа = человек (только при `needsMask`) |
| `frame` | canvas C×C с чистым кадром камеры |
| `layer(i)` | запасной canvas C×C (0 и 1) для своих слоёв |
| `edgePoint()` | случайная точка на контуре человека или `null` |

В [`effects/lib.js`](effects/lib.js) лежат помощники: `rand`, `pick`, `clamp`,
`envelope` (плавное появление и исчезание), `easeOutBack`, `drawGlow` (быстрое
свечение спрайтом, хорошо с `ctx.globalCompositeOperation = 'lighter'`),
`emojiSprite`, `heart`, `faceOrDefault` (лицо или разумное место по центру,
если лица нет).

Несколько правил, чтобы эффекты уживались:

- всё в координатах кадра `C × C`, размеры от `C`, а не в пикселях: кадр могут
  поменять;
- `ctx.save()` / `ctx.restore()` вокруг своего рисования;
- эффект конечный: 2–6 секунд, потом `done`;
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
