# Stalcraft database merged

Скрипт скачивает базу данных, извлекает JSON, затем объединяет данные базовой версии предмета с его вариантами (`_variants/*`) и сохраняет результаты в папку `./merged`.

---

## Ключевые возможности

-   Всё автоматический.

-   Кэширование скачанного ZIP по SHA256: повторное скачивание выполняется только при изменении архива или если задан `FORCE_PULL`.

-   Слияние числовых полей (`numeric`/`numericVariants`) для оружия и брони: собирает все уникальные числовые значения из базовой версии и её вариантов и записывает их в поле `numericVariants`.

-   Опция `--force-merge` для запуска только процесса слияния, если локальные файлы уже есть.

---

## Требования

-   Node.js 18+/Bun.

---

## Установка

Пропишите в терминал: `git clone https://github.com/oarer/sc-db`

Установите зависимости:

```bash

NodeJS
npm install

Bun
bun install

```

---

## Переменные окружения

-   `GITHUB_TOKEN` — token GitHub (опционально). Используется при скачивании ZIP (чтобы избежать rate-limit)

-   `FORCE_PULL` — если `1`, заставляет скачать и распаковать ZIP даже если SHA не изменился.

-   `CLEAN_ORIG` — если `1`, перед началом удаляет папку `./items`.

Примеры запуска:

```bash

# Обычный запуск

bun run src/index.ts

# Форсированное скачивание

FORCE_PULL=1 bun run src/index.ts

# Только форс-слияние локальных файлов

bun run src/index.ts --force-merge

```

---

## Что делает скрипт

1. Проверяет наличие папки `./items`.

2. Скачивает ZIP-архив выбранной ветки репозитория `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip` (если было обновление).

3. Если архив изменился (или `FORCE_PULL=1`), распаковывает из ZIP только файлы из путей `ru/items/` и `ru/icons/` в `./items`.

4. Обходит все JSON-файлы (рекурсивно), для каждого предмета ищет папку вариантов `_variants/<basename>`.

5. Для предметов из категорий `weapon*` и `armor*` ищет в `infoBlocks` элементы с ключами:

-   Оружие: `core.tooltip.stat_name.damage_type.direct`

-   Броня: `stalker.artefact_properties.factor.bullet_dmg_factor`

и объединяет все найденные числовые значения из базовой версии и вариантов в одно поле `numericVariants` (или преобразует `numeric` → `numericVariants`).

7. Сохраняет объединённые JSON-ы в `./merged` сохраняя структуру папок.

---

## Структура каталогов (по умолчанию)

```

./items/ # базовое бд

├─ <category>/

│ ├─ weapon_xyz.json

│ └─ _variants/

│ └─ weapon_xyz/

│ ├─ variant1.json

│ └─ variant2.json

└─ icons/



./merged/ # результат работы

├─ <category>/

└─ icons/



./items/.last_sha # сохранённый хэш коммита

```

---
