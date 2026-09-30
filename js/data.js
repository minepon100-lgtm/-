// ゲームデータ定義
window.DATA = (() => {
  const STATS = ['str', 'iq', 'pie', 'vit', 'agi', 'luk'];
  const STAT_NAMES = { str: '力', iq: '知恵', pie: '信仰心', vit: '生命力', agi: '素早さ', luk: '運' };

  const RACES = {
    human: { name: '人間', base: { str: 8, iq: 8, pie: 8, vit: 9, agi: 8, luk: 9 }, desc: '平均的な能力を持つ。どの職業にも就きやすい。' },
    elf: { name: 'エルフ', base: { str: 7, iq: 10, pie: 10, vit: 6, agi: 9, luk: 6 }, desc: '知恵と信仰心に優れるが、体は脆い。' },
    dwarf: { name: 'ドワーフ', base: { str: 10, iq: 7, pie: 10, vit: 10, agi: 5, luk: 6 }, desc: '頑強で力強い。素早さに欠ける。' },
    gnome: { name: 'ノーム', base: { str: 7, iq: 7, pie: 10, vit: 8, agi: 10, luk: 7 }, desc: '信仰心と素早さに優れた小柄な種族。' },
    hobbit: { name: 'ホビット', base: { str: 5, iq: 7, pie: 7, vit: 6, agi: 10, luk: 15 }, desc: '非力だが、類まれな幸運と身軽さを持つ。' },
  };

  const ALIGNS = { good: { name: '善', color: '#7fb3ff' }, neutral: { name: '中立', color: '#cfcfcf' }, evil: { name: '悪', color: '#ff7f7f' } };

  // weapons: 装備可能な武器種 / armors: 装備可能な防具種
  const CLASSES = {
    fighter: { name: '戦士', req: { str: 11 }, aligns: ['good', 'neutral', 'evil'], hpDie: 10, mpStat: 'vit', caster: false,
      weapons: ['sword', 'axe', 'mace', 'spear', 'dagger'], armors: ['robe', 'light', 'heavy'], desc: '前衛の要。高い体力と攻撃力を誇る。' },
    thief: { name: '盗賊', req: { agi: 11 }, aligns: ['neutral', 'evil'], hpDie: 6, mpStat: 'agi', caster: false,
      weapons: ['dagger', 'sword', 'bow'], armors: ['robe', 'light'], desc: '宝箱の罠を見抜き、急所を突く技に長ける。' },
    mage: { name: '魔術師', req: { iq: 11 }, aligns: ['good', 'neutral', 'evil'], hpDie: 4, mpStat: 'iq', caster: true,
      weapons: ['staff', 'dagger'], armors: ['robe'], desc: '強力な攻撃魔法を操る。打たれ弱い。' },
    priest: { name: '僧侶', req: { pie: 11 }, aligns: ['good', 'evil'], hpDie: 8, mpStat: 'pie', caster: true,
      weapons: ['mace', 'staff'], armors: ['robe', 'light'], desc: '回復と守護の祈りで仲間を支える。' },
  };

  // スキル: type phys/magic/heal/buff/cure/revive/debuff
  // target: enemy / enemies / ally / allies / self / deadAlly
  const SKILLS = {
    // 戦士
    power_strike: { name: '強打', mp: 3, type: 'phys', target: 'enemy', power: 1.6, desc: '渾身の力で敵1体を攻撃' },
    sweep: { name: '薙ぎ払い', mp: 6, type: 'phys', target: 'enemies', power: 0.75, desc: '敵全体を攻撃' },
    warcry: { name: '鼓舞', mp: 8, type: 'buff', target: 'allies', buff: 'atk', turns: 3, desc: '味方全体の攻撃力を上げる(3ターン)' },
    crush: { name: '渾身の一撃', mp: 12, type: 'phys', target: 'enemy', power: 2.6, desc: '敵1体に大ダメージ' },
    // 盗賊
    vital_strike: { name: '急所狙い', mp: 3, type: 'phys', target: 'enemy', power: 1.3, crit: 50, desc: '会心率の高い一撃' },
    venom_blade: { name: '毒刃', mp: 5, type: 'phys', target: 'enemy', power: 1.0, inflict: 'poison', chance: 65, desc: '攻撃し、毒を与える' },
    double_hit: { name: '二連撃', mp: 7, type: 'phys', target: 'enemy', power: 0.9, hits: 2, desc: '敵1体に2回攻撃' },
    shadow_strike: { name: '影討ち', mp: 12, type: 'phys', target: 'enemy', power: 2.2, crit: 60, desc: '影から放つ必殺の一撃' },
    // 魔術師
    fire_bolt: { name: '火炎弾', mp: 3, type: 'magic', target: 'enemy', power: 1.4, desc: '炎の弾で敵1体を攻撃' },
    sleep_mist: { name: '眠りの霧', mp: 5, type: 'debuff', target: 'enemies', inflict: 'sleep', chance: 55, desc: '敵全体を眠らせる' },
    explosion: { name: '爆炎', mp: 8, type: 'magic', target: 'enemies', power: 1.0, desc: '爆炎で敵全体を攻撃' },
    ice_lance: { name: '氷槍', mp: 10, type: 'magic', target: 'enemy', power: 2.4, desc: '氷の槍で敵1体に大ダメージ' },
    thunderstorm: { name: '雷嵐', mp: 18, type: 'magic', target: 'enemies', power: 1.8, desc: '雷の嵐で敵全体に大ダメージ' },
    // 僧侶
    heal_s: { name: '小治癒', mp: 3, type: 'heal', target: 'ally', power: 1.5, field: true, desc: '味方1人のHPを回復' },
    cure: { name: '解毒', mp: 3, type: 'cure', target: 'ally', field: true, desc: '味方1人の毒と眠りを治す' },
    holy_shield: { name: '聖なる盾', mp: 5, type: 'buff', target: 'allies', buff: 'def', turns: 3, desc: '味方全体の防御力を上げる(3ターン)' },
    heal_m: { name: '治癒', mp: 7, type: 'heal', target: 'ally', power: 3.2, field: true, desc: '味方1人のHPを大きく回復' },
    holy_light: { name: '聖光', mp: 8, type: 'magic', target: 'enemies', power: 1.0, holy: true, desc: '聖なる光で敵全体を攻撃(不死に特効)' },
    heal_all: { name: '全体治癒', mp: 14, type: 'heal', target: 'allies', power: 2.0, field: true, desc: '味方全体のHPを回復' },
    revive: { name: '蘇生', mp: 20, type: 'revive', target: 'deadAlly', field: true, desc: '戦闘不能の味方をHP30%で復活' },
    // 固有スキル（招来キャラクター）
    sig_holy_blade: { name: '聖剣閃', mp: 10, type: 'phys', target: 'enemies', power: 1.3, holy: true, desc: '【固有】聖なる剣閃で敵全体を斬る(不死に特効)' },
    sig_starfall: { name: '星墜', mp: 16, type: 'magic', target: 'enemies', power: 2.2, desc: '【固有】星を墜とし敵全体に大ダメージ' },
    sig_shadow_bind: { name: '影縫い', mp: 9, type: 'phys', target: 'enemy', power: 1.9, crit: 50, inflict: 'sleep', chance: 60, desc: '【固有】影を縫い止め、眠らせる' },
    sig_benediction: { name: '大祝福', mp: 16, type: 'heal', target: 'allies', power: 3.0, cureAll: true, field: true, desc: '【固有】味方全体を大回復し状態異常を治す' },
    sig_iron_wall: { name: '鉄壁の構え', mp: 8, type: 'buff', target: 'allies', buff: 'def', turns: 4, desc: '【固有】味方全体の防御を上げる(4ターン)' },
    sig_crimson: { name: '紅蓮', mp: 11, type: 'magic', target: 'enemies', power: 1.5, desc: '【固有】紅蓮の炎で敵全体を焼く' },
    sig_gale: { name: '疾風突き', mp: 8, type: 'phys', target: 'enemy', power: 0.7, hits: 3, desc: '【固有】目にも止まらぬ3連撃' },
    sig_judgement: { name: '裁きの鎚', mp: 9, type: 'phys', target: 'enemy', power: 1.8, drain: 0.5, desc: '【固有】与ダメージの半分HPを回復' },
    sig_pierce: { name: '貫通突き', mp: 8, type: 'phys', target: 'enemy', power: 1.7, pierce: true, desc: '【固有】防御を無視して貫く' },
    sig_ice_coffin: { name: '氷棺', mp: 12, type: 'magic', target: 'enemies', power: 1.2, inflict: 'sleep', chance: 40, desc: '【固有】氷で敵全体を攻撃し、凍てつかせる' },
    sig_hero: { name: '奈落穿ち', mp: 10, type: 'phys', target: 'enemy', power: 2.0, pierce: true, desc: '【主人公】奈落を穿つ一撃。防御を無視する' },
  };

  // 職業ごとの習得スキル [習得Lv, スキルID]
  const CLASS_SKILLS = {
    fighter: [[1, 'power_strike'], [4, 'sweep'], [7, 'warcry'], [10, 'crush']],
    thief: [[1, 'vital_strike'], [3, 'venom_blade'], [6, 'double_hit'], [10, 'shadow_strike']],
    mage: [[1, 'fire_bolt'], [2, 'sleep_mist'], [5, 'explosion'], [8, 'ice_lance'], [11, 'thunderstorm']],
    priest: [[1, 'heal_s'], [2, 'cure'], [3, 'holy_shield'], [5, 'heal_m'], [6, 'holy_light'], [9, 'heal_all'], [12, 'revive']],
  };

  // アイテム
  // kind: consumable / weapon種 / armor種 / acc
  const ITEMS = {
    potion: { name: '回復薬', kind: 'consumable', price: 50, tier: 1, heal: 40, desc: 'HPを40回復' },
    hi_potion: { name: '上回復薬', kind: 'consumable', price: 200, tier: 2, heal: 130, desc: 'HPを130回復' },
    ether: { name: '魔力の水', kind: 'consumable', price: 150, tier: 1, mp: 20, desc: 'MPを20回復' },
    antidote: { name: '解毒草', kind: 'consumable', price: 30, tier: 1, cure: true, desc: '毒と眠りを治す' },
    return_scroll: { name: '帰還の巻物', kind: 'consumable', price: 300, tier: 1, escape: true, field: true, battle: false, desc: '奈落から町へ帰還する(戦闘中不可)' },
    phoenix_ash: { name: '蘇生の灰', kind: 'consumable', price: 1000, tier: 2, revive: true, desc: '戦闘不能の仲間をHP30%で復活' },
    abyss_key: { name: '奈落の鍵', kind: 'key', price: 0, tier: 9, desc: '地下3階の施錠扉を開く鍵' },

    // 武器
    short_sword: { name: 'ショートソード', kind: 'sword', slot: 'weapon', atk: 6, price: 100, tier: 1 },
    dagger: { name: 'ダガー', kind: 'dagger', slot: 'weapon', atk: 4, crit: 5, price: 60, tier: 1 },
    mace: { name: 'メイス', kind: 'mace', slot: 'weapon', atk: 5, mat: 1, price: 90, tier: 1 },
    oak_staff: { name: '樫の杖', kind: 'staff', slot: 'weapon', atk: 2, mat: 4, price: 80, tier: 1 },
    short_bow: { name: 'ショートボウ', kind: 'bow', slot: 'weapon', atk: 4, ranged: true, price: 120, tier: 1 },
    hand_axe: { name: 'ハンドアクス', kind: 'axe', slot: 'weapon', atk: 8, price: 160, tier: 1 },
    long_sword: { name: 'ロングソード', kind: 'sword', slot: 'weapon', atk: 11, price: 500, tier: 2 },
    steel_dagger: { name: '鋼のダガー', kind: 'dagger', slot: 'weapon', atk: 8, crit: 8, price: 350, tier: 2 },
    war_hammer: { name: '戦鎚', kind: 'mace', slot: 'weapon', atk: 10, mat: 2, price: 480, tier: 2 },
    magic_staff: { name: '魔導の杖', kind: 'staff', slot: 'weapon', atk: 4, mat: 10, price: 600, tier: 2 },
    long_bow: { name: 'ロングボウ', kind: 'bow', slot: 'weapon', atk: 9, ranged: true, price: 550, tier: 2 },
    spear: { name: 'スピア', kind: 'spear', slot: 'weapon', atk: 10, ranged: true, price: 520, tier: 2 },
    bastard_sword: { name: 'バスタードソード', kind: 'sword', slot: 'weapon', atk: 17, price: 1500, tier: 3 },
    holy_mace: { name: '聖なるメイス', kind: 'mace', slot: 'weapon', atk: 15, mat: 6, price: 1600, tier: 3 },
    sage_staff: { name: '賢者の杖', kind: 'staff', slot: 'weapon', atk: 6, mat: 18, price: 1800, tier: 3 },
    assassin_dagger: { name: '暗殺者の短剣', kind: 'dagger', slot: 'weapon', atk: 13, crit: 12, price: 1400, tier: 3 },
    halberd: { name: 'ハルバード', kind: 'spear', slot: 'weapon', atk: 16, ranged: true, price: 1700, tier: 3 },
    great_axe: { name: 'グレートアクス', kind: 'axe', slot: 'weapon', atk: 20, price: 1900, tier: 3 },
    abyss_blade: { name: '奈落の剣', kind: 'sword', slot: 'weapon', atk: 26, crit: 6, price: 6000, tier: 9, desc: '奈落の主が携えていた魔剣' },

    // 防具
    cloth: { name: '布の服', kind: 'robe', slot: 'armor', def: 2, price: 30, tier: 1 },
    robe: { name: 'ローブ', kind: 'robe', slot: 'armor', def: 4, mat: 2, price: 120, tier: 1 },
    leather: { name: '革鎧', kind: 'light', slot: 'armor', def: 6, price: 150, tier: 1 },
    chain_mail: { name: '鎖帷子', kind: 'heavy', slot: 'armor', def: 10, price: 400, tier: 1 },
    mage_robe: { name: '魔術師のローブ', kind: 'robe', slot: 'armor', def: 7, mat: 5, price: 700, tier: 2 },
    hard_leather: { name: '硬革鎧', kind: 'light', slot: 'armor', def: 11, price: 650, tier: 2 },
    plate_mail: { name: '板金鎧', kind: 'heavy', slot: 'armor', def: 17, price: 1200, tier: 2 },
    sage_robe: { name: '賢者の衣', kind: 'robe', slot: 'armor', def: 11, mat: 8, price: 2000, tier: 3 },
    shadow_garb: { name: '影の装束', kind: 'light', slot: 'armor', def: 16, agi: 3, price: 1900, tier: 3 },
    mithril_mail: { name: 'ミスリルの鎧', kind: 'heavy', slot: 'armor', def: 25, price: 2800, tier: 3 },

    // 装飾品
    guard_ring: { name: '守りの指輪', kind: 'acc', slot: 'acc', def: 3, price: 400, tier: 1 },
    power_band: { name: '力の腕輪', kind: 'acc', slot: 'acc', atk: 4, price: 800, tier: 2 },
    lucky_charm: { name: '幸運のお守り', kind: 'acc', slot: 'acc', luk: 4, price: 600, tier: 2 },
    swift_boots: { name: '疾風の靴', kind: 'acc', slot: 'acc', agi: 4, price: 900, tier: 2 },
    sage_pendant: { name: '賢者の首飾り', kind: 'acc', slot: 'acc', mat: 6, price: 1500, tier: 3 },
    abyss_amulet: { name: '奈落の護符', kind: 'acc', slot: 'acc', atk: 5, def: 5, mat: 5, agi: 3, price: 5000, tier: 9, desc: '奈落の深部で見つかる護符' },
  };

  // 敵
  const ENEMIES = {
    slime: { name: 'スライム', hp: 14, atk: 7, def: 1, mat: 0, agi: 4, exp: 8, gold: 6, color: '#6fcf6f', shape: 'blob' },
    rat: { name: '大ネズミ', hp: 10, atk: 6, def: 1, mat: 0, agi: 10, exp: 7, gold: 4, color: '#a08060', shape: 'beast' },
    kobold: { name: 'コボルド', hp: 20, atk: 9, def: 3, mat: 0, agi: 7, exp: 12, gold: 12, color: '#b07040', shape: 'humanoid', drops: [['potion', 10], ['dagger', 4]] },
    skeleton: { name: '骸骨兵', hp: 24, atk: 10, def: 4, mat: 0, agi: 6, exp: 15, gold: 10, undead: true, color: '#e0e0d0', shape: 'humanoid', drops: [['short_sword', 5]] },
    bat: { name: '吸血コウモリ', hp: 12, atk: 7, def: 1, mat: 0, agi: 14, exp: 10, gold: 5, color: '#806090', shape: 'flyer' },

    goblin: { name: 'ゴブリン戦士', hp: 38, atk: 15, def: 6, mat: 0, agi: 9, exp: 30, gold: 25, color: '#70a050', shape: 'humanoid', drops: [['potion', 10], ['hand_axe', 4]] },
    snake: { name: '毒大蛇', hp: 34, atk: 14, def: 5, mat: 0, agi: 12, exp: 32, gold: 15, color: '#50a080', shape: 'serpent',
      skills: [{ name: '毒牙', type: 'phys', power: 1.0, inflict: 'poison', chance: 60, rate: 35 }], drops: [['antidote', 20]] },
    rogue_mage: { name: 'はぐれ魔術師', hp: 28, atk: 8, def: 3, mat: 14, agi: 10, exp: 36, gold: 40, color: '#8070d0', shape: 'caster',
      skills: [{ name: '火炎弾', type: 'magic', power: 1.4, target: 'one', rate: 45 }, { name: '眠りの霧', type: 'debuff', inflict: 'sleep', chance: 35, target: 'all', rate: 20 }], drops: [['ether', 12], ['oak_staff', 5]] },
    orc: { name: 'オーク', hp: 50, atk: 18, def: 8, mat: 0, agi: 7, exp: 40, gold: 30, color: '#608040', shape: 'brute', drops: [['leather', 5]] },
    ghoul: { name: 'グール', hp: 44, atk: 16, def: 6, mat: 0, agi: 8, exp: 38, gold: 20, undead: true, color: '#8a9a70', shape: 'humanoid',
      skills: [{ name: '腐爪', type: 'phys', power: 1.1, inflict: 'poison', chance: 40, rate: 30 }] },
    orcboss: { name: 'オークの頭目', hp: 260, atk: 24, def: 10, mat: 0, agi: 10, exp: 350, gold: 600, boss: true, color: '#a05030', shape: 'brute', scale: 1.3,
      skills: [{ name: '薙ぎ払い', type: 'phys', power: 0.8, target: 'front', rate: 35 }], drops: [['long_sword', 100], ['chain_mail', 50]] },

    zombie: { name: 'ゾンビ戦士', hp: 80, atk: 24, def: 10, mat: 0, agi: 6, exp: 70, gold: 40, undead: true, color: '#7a8a60', shape: 'humanoid', drops: [['hi_potion', 6]] },
    gargoyle: { name: 'ガーゴイル', hp: 70, atk: 26, def: 16, mat: 0, agi: 15, exp: 85, gold: 60, color: '#8090a0', shape: 'flyer' },
    dark_elf: { name: 'ダークエルフ', hp: 60, atk: 20, def: 10, mat: 26, agi: 18, exp: 90, gold: 80, color: '#6050a0', shape: 'caster',
      skills: [{ name: '眠りの霧', type: 'debuff', inflict: 'sleep', chance: 40, target: 'all', rate: 20 }, { name: '氷槍', type: 'magic', power: 1.6, target: 'one', rate: 35 }], drops: [['mage_robe', 4], ['ether', 12]] },
    spider: { name: '巨大蜘蛛', hp: 72, atk: 25, def: 9, mat: 0, agi: 16, exp: 80, gold: 30, color: '#504040', shape: 'beast',
      skills: [{ name: '毒糸', type: 'debuff', inflict: 'poison', chance: 50, target: 'all', rate: 25 }] },
    wraith: { name: '亡霊', hp: 50, atk: 22, def: 22, mat: 24, agi: 14, exp: 90, gold: 50, undead: true, color: '#a0c0e0', shape: 'ghost',
      skills: [{ name: '呪いの声', type: 'magic', power: 1.0, target: 'all', rate: 25 }] },
    bone_knight: { name: '骸の騎士', hp: 560, atk: 34, def: 18, mat: 10, agi: 14, exp: 900, gold: 1200, boss: true, undead: true, color: '#c8c0a0', shape: 'humanoid', scale: 1.3,
      skills: [{ name: '亡者の剣', type: 'phys', power: 1.6, target: 'one', rate: 30 }, { name: '死者の呼び声', type: 'debuff', inflict: 'sleep', chance: 30, target: 'all', rate: 15 }], drops: [['plate_mail', 60], ['hi_potion', 100]] },

    lizardman: { name: 'リザードマン', hp: 120, atk: 34, def: 16, mat: 0, agi: 18, exp: 140, gold: 90, color: '#509060', shape: 'humanoid', drops: [['hi_potion', 10], ['halberd', 3]] },
    hellhound: { name: 'ヘルハウンド', hp: 100, atk: 32, def: 12, mat: 28, agi: 24, exp: 150, gold: 70, color: '#c05030', shape: 'beast',
      skills: [{ name: '炎の息', type: 'breath', power: 0.8, target: 'all', rate: 30 }] },
    wight: { name: 'ワイト', hp: 110, atk: 30, def: 18, mat: 30, agi: 16, exp: 160, gold: 80, undead: true, color: '#90a0b0', shape: 'ghost',
      skills: [{ name: '生命吸収', type: 'magic', power: 1.3, target: 'one', drain: true, rate: 35 }], drops: [['guard_ring', 6]] },
    ogre: { name: 'オーガ', hp: 180, atk: 42, def: 14, mat: 0, agi: 10, exp: 190, gold: 120, color: '#a07050', shape: 'brute', scale: 1.15,
      skills: [{ name: '叩き潰し', type: 'phys', power: 1.6, target: 'one', rate: 25 }], drops: [['great_axe', 4]] },
    abyss_mage: { name: '奈落の魔術師', hp: 90, atk: 20, def: 12, mat: 38, agi: 20, exp: 170, gold: 150, color: '#a040c0', shape: 'caster',
      skills: [{ name: '爆炎', type: 'magic', power: 0.9, target: 'all', rate: 35 }, { name: '氷槍', type: 'magic', power: 1.5, target: 'one', rate: 25 }], drops: [['sage_pendant', 3], ['ether', 15]] },
    abyss_lord: { name: '深淵の番人 ヴォルガス', hp: 2200, atk: 52, def: 22, mat: 44, agi: 22, exp: 3500, gold: 8000, boss: true, final: true, actions: 2, color: '#d04070', shape: 'lord', scale: 1.6,
      skills: [{ name: '深淵の炎', type: 'magic', power: 0.9, target: 'all', rate: 25 }, { name: '叩き潰し', type: 'phys', power: 1.7, target: 'one', rate: 25 },
        { name: '魂砕きの咆哮', type: 'debuff', inflict: 'sleep', chance: 30, target: 'all', rate: 10 }], drops: [['abyss_blade', 100], ['abyss_amulet', 100]] },
  };

  // 招来キャラクター（オリジナル）
  // rarity: 5=★5, 4=★4, 3=★3
  const CHARACTERS = {
    seraphina: { name: 'セラフィナ', title: '白銀の聖騎士', rarity: 5, race: 'human', cls: 'fighter', align: 'good', color: '#f0e0a0',
      base: { str: 16, iq: 9, pie: 13, vit: 15, agi: 11, luk: 11 }, sig: 'sig_holy_blade', equip: { weapon: 'long_sword', armor: 'chain_mail' },
      bio: '聖堂騎士団の元団長。奈落に消えた弟を捜している。' },
    valgan: { name: 'ヴァルガン', title: '星詠みの大魔導', rarity: 5, race: 'elf', cls: 'mage', align: 'neutral', color: '#a0b0ff',
      base: { str: 7, iq: 18, pie: 12, vit: 9, agi: 12, luk: 9 }, sig: 'sig_starfall', equip: { weapon: 'magic_staff', armor: 'robe' },
      bio: '三百年を生きるエルフの賢者。星の運行から奈落の異変を読んだ。' },
    crow: { name: 'クロウ', title: '影刃', rarity: 5, race: 'hobbit', cls: 'thief', align: 'evil', color: '#707090',
      base: { str: 11, iq: 10, pie: 7, vit: 10, agi: 18, luk: 17 }, sig: 'sig_shadow_bind', equip: { weapon: 'steel_dagger', armor: 'leather' },
      bio: '報酬次第で何でも盗む凄腕。奈落の秘宝を狙っているらしい。' },
    elmina: { name: 'エルミナ', title: '慈愛の大司祭', rarity: 5, race: 'elf', cls: 'priest', align: 'good', color: '#ffe0f0',
      base: { str: 8, iq: 13, pie: 18, vit: 11, agi: 10, luk: 11 }, sig: 'sig_benediction', equip: { weapon: 'war_hammer', armor: 'robe' },
      bio: '辺境の孤児院を営む司祭。奈落の瘴気に苦しむ人々を救うため旅立った。' },
    gard: { name: 'ガルド', title: '鉄壁', rarity: 4, race: 'dwarf', cls: 'fighter', align: 'neutral', color: '#c09060',
      base: { str: 14, iq: 7, pie: 11, vit: 16, agi: 6, luk: 8 }, sig: 'sig_iron_wall', equip: { weapon: 'hand_axe', armor: 'chain_mail' },
      bio: '鉱山崩落から仲間を守り抜いたドワーフの戦士。' },
    lila: { name: 'リラ', title: '紅蓮の術士', rarity: 4, race: 'gnome', cls: 'mage', align: 'evil', color: '#ff8060',
      base: { str: 6, iq: 16, pie: 11, vit: 9, agi: 12, luk: 8 }, sig: 'sig_crimson', equip: { weapon: 'oak_staff', armor: 'robe' },
      bio: '炎の魔術にしか興味がない気まぐれな天才。' },
    mio: { name: 'ミオ', title: '疾風', rarity: 4, race: 'human', cls: 'thief', align: 'neutral', color: '#80e0c0',
      base: { str: 10, iq: 9, pie: 8, vit: 10, agi: 16, luk: 12 }, sig: 'sig_gale', equip: { weapon: 'dagger', armor: 'leather' },
      bio: '港町育ちの少女。誰よりも速く走ることが自慢。' },
    borg: { name: 'ボルグ', title: '戦司祭', rarity: 4, race: 'dwarf', cls: 'priest', align: 'evil', color: '#b08080',
      base: { str: 13, iq: 8, pie: 15, vit: 14, agi: 6, luk: 7 }, sig: 'sig_judgement', equip: { weapon: 'mace', armor: 'leather' },
      bio: '「祈りも鎚も、強く振るうほど神に届く」が口癖。' },
    leon: { name: 'レオン', title: '若き槍兵', rarity: 4, race: 'human', cls: 'fighter', align: 'good', color: '#80a0e0',
      base: { str: 14, iq: 9, pie: 9, vit: 13, agi: 12, luk: 10 }, sig: 'sig_pierce', equip: { weapon: 'spear', armor: 'leather' },
      bio: '王国騎士見習い。故郷を守るため奈落の調査に志願した。' },
    noa: { name: 'ノア', title: '氷の術士', rarity: 4, race: 'elf', cls: 'mage', align: 'good', color: '#a0e0ff',
      base: { str: 6, iq: 16, pie: 12, vit: 8, agi: 11, luk: 9 }, sig: 'sig_ice_coffin', equip: { weapon: 'oak_staff', armor: 'robe' },
      bio: '北方の氷原から来た寡黙な魔術師。' },
    dan: { name: 'ダン', title: '傭兵', rarity: 3, race: 'human', cls: 'fighter', align: 'neutral', color: '#c0c0c0',
      base: { str: 13, iq: 8, pie: 8, vit: 12, agi: 9, luk: 9 }, equip: { weapon: 'short_sword', armor: 'leather' },
      bio: '金のために剣を振るう、気のいい傭兵。' },
    pico: { name: 'ピコ', title: '見習い魔術師', rarity: 3, race: 'gnome', cls: 'mage', align: 'neutral', color: '#d0a0ff',
      base: { str: 6, iq: 13, pie: 10, vit: 9, agi: 10, luk: 8 }, equip: { weapon: 'oak_staff', armor: 'robe' },
      bio: '魔術学院を飛び出してきた見習い。失敗は多いが根性はある。' },
    anna: { name: 'アンナ', title: '修道女', rarity: 3, race: 'human', cls: 'priest', align: 'good', color: '#f0f0ff',
      base: { str: 8, iq: 9, pie: 13, vit: 10, agi: 8, luk: 9 }, equip: { weapon: 'mace', armor: 'robe' },
      bio: '町の修道院で働く修道女。冒険者たちの無事を祈り続けている。' },
    jill: { name: 'ジル', title: '盗賊', rarity: 3, race: 'hobbit', cls: 'thief', align: 'neutral', color: '#c0e080',
      base: { str: 7, iq: 8, pie: 7, vit: 8, agi: 13, luk: 15 }, equip: { weapon: 'dagger', armor: 'cloth' },
      bio: '手癖は悪いが仲間は裏切らない、が本人の弁。' },
    bram: { name: 'ブラム', title: '斧戦士', rarity: 3, race: 'dwarf', cls: 'fighter', align: 'evil', color: '#a08070',
      base: { str: 14, iq: 6, pie: 10, vit: 13, agi: 5, luk: 6 }, equip: { weapon: 'hand_axe', armor: 'leather' },
      bio: '無口なドワーフ。酒と斧があれば文句は言わない。' },
    kara: { name: 'カーラ', title: '呪術師', rarity: 3, race: 'human', cls: 'mage', align: 'evil', color: '#c080a0',
      base: { str: 7, iq: 13, pie: 9, vit: 9, agi: 9, luk: 8 }, equip: { weapon: 'dagger', armor: 'robe' },
      bio: '怪しげな呪術を研究する女。奈落の瘴気に興味津々。' },
    tobias: { name: 'トビアス', title: '巡礼者', rarity: 3, race: 'dwarf', cls: 'priest', align: 'good', color: '#e0c080',
      base: { str: 10, iq: 7, pie: 13, vit: 12, agi: 5, luk: 7 }, equip: { weapon: 'mace', armor: 'leather' },
      bio: '聖地を巡る旅の途中で、奈落の町に立ち寄った。' },
  };

  const STARTERS = ['dan', 'anna', 'pico'];

  const GACHA = {
    single: 300,
    ten: 3000,
    rates: { 5: 3, 4: 15, 3: 82 },
    pickupShare: 50, // 同レアリティ内でピックアップが選ばれる確率(%)
    exchangePoints: 100, // 交換に必要な招来ポイント
    pity5: 80, // この回数★5が出なければ次は★5確定
    maxDupes: 5,
    dupeRefund: { 5: 3000, 4: 800, 3: 150 },
  };

  const START_GOLD = 5000;

  // 経験値: レベルlv→lv+1に必要な経験値
  const expToNext = (lv) => Math.floor(30 * Math.pow(lv, 1.9));

  return { STATS, STAT_NAMES, RACES, ALIGNS, CLASSES, SKILLS, CLASS_SKILLS, ITEMS, ENEMIES, CHARACTERS, STARTERS, GACHA, START_GOLD, expToNext };
})();
