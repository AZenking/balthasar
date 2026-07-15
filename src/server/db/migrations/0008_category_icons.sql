-- 0008_category_icons.sql
--
-- Feature 028: categories.icon emoji → lucide 图标名
-- 无 schema 变更,只改列内容(text NOT NULL 不变)。
--
-- 迁移后验证:
--   SELECT id, icon FROM categories WHERE icon ~ '[^\x00-\x7F]';  -- 预期 0 行(无 emoji 残留)
--   SELECT id, name FROM categories WHERE icon = 'circle-help';   -- 预期 0 行(所有 emoji 均命中映射)

UPDATE categories SET icon = CASE icon
  -- ── Food ──
  WHEN '🍔' THEN 'utensils' WHEN '🍜' THEN 'soup' WHEN '🍱' THEN 'utensils'
  WHEN '🍣' THEN 'utensils' WHEN '🍕' THEN 'pizza' WHEN '🍝' THEN 'utensils'
  WHEN '🍛' THEN 'utensils' WHEN '🍚' THEN 'utensils' WHEN '🥘' THEN 'utensils'
  WHEN '🍳' THEN 'utensils' WHEN '🥗' THEN 'utensils' WHEN '🍰' THEN 'cake'
  WHEN '🍦' THEN 'ice-cream' WHEN '🥐' THEN 'croissant' WHEN '🍩' THEN 'donut'
  WHEN '🍪' THEN 'cookie' WHEN '🍫' THEN 'cookie' WHEN '🍬' THEN 'candy'
  WHEN '🍓' THEN 'cherry' WHEN '🍎' THEN 'apple' WHEN '🍊' THEN 'citrus'
  WHEN '🥑' THEN 'carrot' WHEN '🍆' THEN 'carrot' WHEN '🥕' THEN 'carrot'
  WHEN '🥦' THEN 'broccoli' WHEN '🥩' THEN 'beef' WHEN '🐟' THEN 'fish'
  WHEN '🍗' THEN 'drumstick' WHEN '☕' THEN 'coffee' WHEN '🍷' THEN 'wine'
  WHEN '🍺' THEN 'beer' WHEN '🍵' THEN 'coffee' WHEN '🥤' THEN 'coffee'
  -- ── Transport ──
  WHEN '🚗' THEN 'car' WHEN '🚕' THEN 'car' WHEN '🚇' THEN 'train-front'
  WHEN '🚌' THEN 'bus' WHEN '🚊' THEN 'train-front' WHEN '🚲' THEN 'bike'
  WHEN '🛵' THEN 'bike' WHEN '✈️' THEN 'plane' WHEN '🚢' THEN 'ship'
  WHEN '🚀' THEN 'rocket' WHEN '🚁' THEN 'rocket' WHEN '🚓' THEN 'car'
  WHEN '🚑' THEN 'ambulance' WHEN '🚒' THEN 'truck' WHEN '🚜' THEN 'tractor'
  WHEN '🚂' THEN 'train-front' WHEN '🚆' THEN 'train-front' WHEN '🛺' THEN 'car'
  WHEN '🚠' THEN 'cable-car' WHEN '🚟' THEN 'train-front'
  -- ── Shopping ──
  WHEN '🛍️' THEN 'shopping-bag' WHEN '🛒' THEN 'shopping-cart'
  WHEN '👕' THEN 'shirt' WHEN '👗' THEN 'shirt' WHEN '👠' THEN 'footprints'
  WHEN '👟' THEN 'footprints' WHEN '👜' THEN 'shopping-bag'
  WHEN '💳' THEN 'credit-card' WHEN '🏷️' THEN 'tag' WHEN '📦' THEN 'package'
  WHEN '🎄' THEN 'gift' WHEN '🎃' THEN 'gift' WHEN '🎈' THEN 'party-popper'
  WHEN '🎊' THEN 'party-popper' WHEN '🎀' THEN 'gift'
  -- ── Home ──
  WHEN '🏠' THEN 'house' WHEN '🏡' THEN 'house' WHEN '🛏️' THEN 'bed-double'
  WHEN '🛋️' THEN 'sofa' WHEN '🚿' THEN 'shower-head' WHEN '🧹' THEN 'wrench'
  WHEN '🧺' THEN 'shopping-cart' WHEN '🔌' THEN 'plug'
  WHEN '🔋' THEN 'battery-charging' WHEN '💡' THEN 'lightbulb'
  WHEN '🔥' THEN 'flame' WHEN '❄️' THEN 'snowflake' WHEN '📺' THEN 'tv'
  WHEN '📻' THEN 'tv' WHEN '🪔' THEN 'lamp'
  -- ── Health ──
  WHEN '💊' THEN 'pill' WHEN '🩺' THEN 'stethoscope' WHEN '🏥' THEN 'cross'
  WHEN '🤒' THEN 'thermometer' WHEN '🤧' THEN 'thermometer' WHEN '😷' THEN 'pill'
  WHEN '💪' THEN 'dumbbell' WHEN '🧘' THEN 'heart-pulse' WHEN '🩹' THEN 'bandage'
  WHEN '💉' THEN 'syringe' WHEN '🦷' THEN 'pill' WHEN '🧴' THEN 'droplet'
  -- ── Entertainment ──
  WHEN '🎮' THEN 'gamepad-2' WHEN '🕹️' THEN 'gamepad-2' WHEN '🎬' THEN 'film'
  WHEN '🎭' THEN 'drama' WHEN '🎵' THEN 'music' WHEN '🎶' THEN 'music'
  WHEN '🎸' THEN 'guitar' WHEN '🎹' THEN 'piano' WHEN '🎺' THEN 'music'
  WHEN '🎻' THEN 'music' WHEN '🎯' THEN 'target' WHEN '🎲' THEN 'dice-5'
  WHEN '🎳' THEN 'dice-5' WHEN '🎰' THEN 'dice-5' WHEN '🃏' THEN 'spade'
  WHEN '🎨' THEN 'palette' WHEN '📷' THEN 'camera' WHEN '🎟️' THEN 'ticket'
  WHEN '🎪' THEN 'party-popper' WHEN '🏟️' THEN 'party-popper'
  -- ── Education & Work ──
  WHEN '📚' THEN 'book-open' WHEN '✏️' THEN 'pencil'
  WHEN '📝' THEN 'clipboard-list' WHEN '📖' THEN 'book-open'
  WHEN '🎓' THEN 'graduation-cap' WHEN '🏫' THEN 'graduation-cap'
  WHEN '💼' THEN 'briefcase' WHEN '💻' THEN 'laptop' WHEN '🖥️' THEN 'monitor'
  WHEN '⌨️' THEN 'keyboard' WHEN '🖱️' THEN 'mouse-pointer-2'
  WHEN '📋' THEN 'clipboard-list' WHEN '📊' THEN 'bar-chart-3'
  WHEN '📈' THEN 'trending-up' WHEN '📉' THEN 'trending-down'
  WHEN '🖊️' THEN 'pen-line' WHEN '📌' THEN 'pin' WHEN '📎' THEN 'paperclip'
  WHEN '📒' THEN 'notebook' WHEN '🗓️' THEN 'calendar-days'
  -- ── Gifts ──
  WHEN '🎁' THEN 'gift' WHEN '🎉' THEN 'party-popper' WHEN '🧧' THEN 'hand-coins'
  WHEN '🎂' THEN 'cake' WHEN '💝' THEN 'heart' WHEN '🌹' THEN 'flower-2'
  WHEN '💐' THEN 'flower-2' WHEN '💌' THEN 'mail'
  -- ── Finance ──
  WHEN '💰' THEN 'wallet' WHEN '💵' THEN 'banknote' WHEN '💴' THEN 'banknote'
  WHEN '💶' THEN 'banknote' WHEN '💷' THEN 'banknote' WHEN '🪙' THEN 'coins'
  WHEN '💸' THEN 'circle-dollar-sign' WHEN '🧾' THEN 'receipt-text'
  WHEN '🏦' THEN 'landmark' WHEN '🏧' THEN 'landmark'
  WHEN '💹' THEN 'trending-up' WHEN '🤑' THEN 'badge-dollar-sign'
  -- ── Pets ──
  WHEN '🐾' THEN 'paw-print' WHEN '🐶' THEN 'dog' WHEN '🐱' THEN 'cat'
  WHEN '🐰' THEN 'rabbit' WHEN '🐹' THEN 'rabbit' WHEN '🐦' THEN 'bird'
  WHEN '🐢' THEN 'turtle' WHEN '🐈' THEN 'cat' WHEN '🐕' THEN 'dog'
  WHEN '🦜' THEN 'bird' WHEN '🐀' THEN 'rabbit' WHEN '🦔' THEN 'paw-print'
  -- ── Travel ──
  WHEN '🏖️' THEN 'palmtree' WHEN '🏝️' THEN 'palmtree' WHEN '🗺️' THEN 'map'
  WHEN '🧳' THEN 'luggage' WHEN '🌅' THEN 'sunrise' WHEN '🌄' THEN 'sunrise'
  WHEN '🗽' THEN 'landmark' WHEN '🏛️' THEN 'landmark'
  WHEN '🎡' THEN 'palmtree' WHEN '🎢' THEN 'palmtree'
  -- ── Family ──
  WHEN '👨‍👩‍👧' THEN 'users' WHEN '👶' THEN 'baby' WHEN '👵' THEN 'users'
  WHEN '👴' THEN 'users' WHEN '💍' THEN 'heart-handshake' WHEN '🤱' THEN 'baby'
  WHEN '🧸' THEN 'baby' WHEN '🪥' THEN 'pill'
  -- ── Misc ──
  WHEN '💬' THEN 'message-circle' WHEN '📱' THEN 'smartphone'
  WHEN '📞' THEN 'phone' WHEN '🌐' THEN 'globe' WHEN '🔧' THEN 'wrench'
  WHEN '🔨' THEN 'hammer' WHEN '⚙️' THEN 'cog' WHEN '🧰' THEN 'wrench'
  WHEN '🪛' THEN 'wrench' WHEN '🪚' THEN 'wrench' WHEN '🧷' THEN 'pin'
  WHEN '🪣' THEN 'wrench' WHEN '🔔' THEN 'bell' WHEN '⭐' THEN 'star'
  WHEN '❤️' THEN 'heart' WHEN '🚫' THEN 'ban' WHEN '❓' THEN 'circle-help'
  WHEN '✨' THEN 'sparkles' WHEN '🌟' THEN 'star' WHEN '↩️' THEN 'undo-2'
  -- ── 兜底 ──
  ELSE 'circle-help'
END;
