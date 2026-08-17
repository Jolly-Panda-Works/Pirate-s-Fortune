# MVP Roadmap (Gameplay-First Ordering)

این سند، فازهای GDD (بخش ۲۸) را برای رسیدن به یک **نسخه MVP قابل‌بازی** بازآرایی می‌کند.
اصل حاکم طبق دستور کاربر: «قدم اول گیم‌پلی بازی تکمیل بشه، سپس سراغ بقیه بخش‌ها می‌رویم.»

بنابراین فازهای GDD به ۴ مرحله (Stage) گروه‌بندی شده‌اند. ترتیب فازهای GDD حفظ شده،
فقط UI/localization/audio/animation به بعد از تکمیل کامل موتور گیم‌پلی منتقل شده‌اند.

## خلاصه مراحل

| Stage | محتوا | خروجی قابل تست |
|---|---|---|
| **A — Core Gameplay Engine** | فازهای ۱ تا ۱۰a (+ بخشی از ۱۱) | بازی کامل از طریق کنسول/تست قابل اجراست، بدون هیچ UI |
| **B — Minimal Playable UI** | فازهای ۱۲، ۱۳، ۱۴، ۱۹ | بازی در مرورگر با آیکون/ایموجی قابل‌بازی است (فقط انگلیسی) |
| **C — Bilingual & Responsive** | فازهای ۱۵، ۱۶ | بازی دوزبانه (fa/en)، RTL، ریسپانسیو |
| **D — Feel & Release** | فازهای ۱۷، ۱۸، ۲۰، ۲۱، ۲۲، ۲۳ | نسخه‌ی نهایی MVP آماده‌ی انتشار وب |

**خارج از MVP** (طبق GDD §15، عمداً حذف/به‌تعویق‌افتاده):
- Phase 10b — Post-MVP Abilities (Dagger, Anchor, Sea Serpent, Map, Chest+Key)
- Phase 24 — Unity Port

---

## Stage A — Core Gameplay Engine (اولویت اول)

بدون هیچ DOM/UI. فقط منطق بازی، قابل تست از طریق `tests/` و یک هارنس کنسولی ساده.
خروجی این Stage باید بتواند یک بازی کامل ۲ تا ۴ نفره را از ابتدا تا Scoring،
کاملاً دترمینیستیک و تست‌شده، اجرا کند.

| GDD Phase | نام | Prompt |
|---|---|---|
| 1 | Data Architecture | [001](prompts/stage-a-core-engine.md#prompt-001) |
| 2 | Game State | [002](prompts/stage-a-core-engine.md#prompt-002) |
| 3 | Deck System | [003](prompts/stage-a-core-engine.md#prompt-003) |
| 4 | Turn System | [004](prompts/stage-a-core-engine.md#prompt-004) |
| 5 | Push-Your-Luck Core | [005](prompts/stage-a-core-engine.md#prompt-005) |
| 6 | Duplicate / Shipwreck | [006](prompts/stage-a-core-engine.md#prompt-006) |
| 7 | Collection | [007](prompts/stage-a-core-engine.md#prompt-007) |
| 8 | Scoring | [008](prompts/stage-a-core-engine.md#prompt-008) |
| 9 | Ability Framework | [009](prompts/stage-a-core-engine.md#prompt-009) |
| 10a | MVP Abilities (Compass, Cannon, Captain Shield) | [010](prompts/stage-a-core-engine.md#prompt-010) |
| 11 (light) | Ability chain tests (فقط برای Compass/Cannon/Shield) | [011](prompts/stage-a-core-engine.md#prompt-011) |

## Stage B — Minimal Playable UI

فقط برای اینکه بازی «قابل دیدن/بازی‌کردن با ماوس» شود؛ هنوز تک‌زبانه (انگلیسی)،
هنوز بدون انیمیشن/صدا واقعی، آیکون‌ها از طریق `iconManager.js` با ایموجی.

| GDD Phase | نام | Prompt |
|---|---|---|
| 12 | UI (board rendering) | [012](prompts/stage-b-minimal-ui.md#prompt-012) |
| 13 | Card Interaction | [013](prompts/stage-b-minimal-ui.md#prompt-013) |
| 14 | Modal System (لازم برای Cannon/Compass) | [014](prompts/stage-b-minimal-ui.md#prompt-014) |
| 19 | AI (basic threshold AI طبق GDD §15) | [015](prompts/stage-b-minimal-ui.md#prompt-015) |

## Stage C — Bilingual & Responsive

اینجاست که الزام «بازی دوزبانه است» برآورده می‌شود — بلافاصله بعد از اینکه بازی
از طریق UI قابل‌بازی شد، قبل از پولیش/صدا/انیمیشن.

| GDD Phase | نام | Prompt |
|---|---|---|
| 15 | Localization (EN/FA + RTL) | [016](prompts/stage-c-bilingual.md#prompt-016) |
| 16 | Responsive / Landscape UI | [017](prompts/stage-c-bilingual.md#prompt-017) |

## Stage D — Feel & Release

| GDD Phase | نام | Prompt |
|---|---|---|
| 17 | Animations (حداقل: duplicate-before-shipwreck) | [018](prompts/stage-d-feel-and-release.md#prompt-018) |
| 18 | Audio | [019](prompts/stage-d-feel-and-release.md#prompt-019) |
| 20 | Save System | [020](prompts/stage-d-feel-and-release.md#prompt-020) |
| 21 | Polish | [021](prompts/stage-d-feel-and-release.md#prompt-021) |
| 22 | Testing (regression suite) | [022](prompts/stage-d-feel-and-release.md#prompt-022) |
| 23 | Web Release | [023](prompts/stage-d-feel-and-release.md#prompt-023) |

---

## نحوه‌ی استفاده

هر Prompt یک واحد کاری مستقل و قابل‌تحویل است — دقیقاً مطابق قوانین توسعه‌ی پروژه:
- Phase boundaries رعایت می‌شود (هیچ Prompt‌ای جلوتر از فاز خودش کد نمی‌نویسد).
- هر Prompt به فایل‌های استاب موجود در `js/` اشاره می‌کند و همان فایل را کامل می‌کند —
  فایل جدید خارج از ساختار Phase 0 ساخته نمی‌شود مگر صریحاً لازم باشد.
- هر Prompt معیار خروج (exit criteria) و تست مربوطه در `tests/` را مشخص می‌کند.
- بعد از هر Prompt، طبق استاندارد پروژه: نسخه در `package.json`/`CHANGELOG.md` بالا می‌رود
  و zip به همراه commit header/description تحویل داده می‌شود.
