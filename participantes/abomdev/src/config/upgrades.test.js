// Tests de las tablas de mejoras: es donde vive casi toda la regla de negocio del
// juego (fórmulas, topes, desbloqueos) y donde un error se nota jugando pero no
// rompe nada visiblemente, así que es lo que más vale cubrir.

import { describe, expect, it } from 'vitest';
import { DODGE_CAP } from './constants.js';
import { COOLDOWN_STATS, GROWTH_STATS, STAT_UPGRADES, WEAPON_KEYS, WEAPON_UPGRADES } from './upgrades.js';

// Stats mínimas equivalentes a las de una partida recién empezada.
function baseStats(overrides = {}) {
  return {
    damage: 20, fireRate: 600, moveSpeed: 220, maxHp: 100, hp: 100, magnetRadius: 90,
    hpRegen: 0, lifesteal: 0, dodge: 0, shield: 0, shieldMax: 0,
    hasAura: false, hasOrbit: false, hasPierce: false, hasBurst: false, hasNova: false,
    ...overrides,
  };
}

const byKey = (key) => STAT_UPGRADES.find((u) => u.key === key);

describe('STAT_UPGRADES', () => {
  it('cada mejora tiene key, rarity, describe y apply', () => {
    STAT_UPGRADES.forEach((u) => {
      expect(u.key, 'key').toBeTruthy();
      expect(['common', 'rare', 'epic']).toContain(u.rarity);
      expect(typeof u.describe).toBe('function');
      expect(typeof u.apply).toBe('function');
    });
  });

  it('no hay keys duplicadas entre todas las mejoras', () => {
    const keys = [
      ...STAT_UPGRADES.map((u) => u.key),
      ...WEAPON_KEYS.flatMap((w) => [
        WEAPON_UPGRADES[w].unlock.key,
        ...WEAPON_UPGRADES[w].upgrades.map((u) => u.key),
      ]),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('daño sube la base y también las armas ya desbloqueadas', () => {
    const s = baseStats({ hasAura: true, auraDamage: 10, hasNova: true, novaDamage: 25 });
    byKey('damage').apply(s);
    expect(s.damage).toBe(28);
    expect(s.auraDamage).toBe(18);
    expect(s.novaDamage).toBe(33);
  });

  it('daño no toca las armas que siguen bloqueadas', () => {
    const s = baseStats({ hasOrbit: false, orbitDamage: 10 });
    byKey('damage').apply(s);
    expect(s.orbitDamage).toBe(10);
  });

  it('maxHp sube también la vida actual, para que la mejora se sienta al instante', () => {
    const s = baseStats({ hp: 40 });
    byKey('maxHp').apply(s);
    expect(s.maxHp).toBe(130);
    expect(s.hp).toBe(70);
  });

  it('escudo deja el escudo lleno al aplicarse', () => {
    const s = baseStats();
    byKey('shield').apply(s);
    expect(s.shieldMax).toBe(35);
    expect(s.shield).toBe(s.shieldMax);
  });
});

describe('isMaxed corta las mejoras en su tope', () => {
  // Aplicar muchas veces nunca debe pasarse del tope, e isMaxed debe activarse ahí.
  const cases = [
    { key: 'fireRate', limit: 130, atLimit: (s) => s.fireRate === 130 },
    { key: 'moveSpeed', limit: 480, atLimit: (s) => s.moveSpeed === 480 },
    { key: 'magnet', limit: 550, atLimit: (s) => s.magnetRadius === 550 },
    { key: 'dodge', limit: DODGE_CAP, atLimit: (s) => s.dodge === DODGE_CAP },
  ];

  cases.forEach(({ key, atLimit }) => {
    it(`${key} llega a su tope y deja de ofrecerse`, () => {
      const upgrade = byKey(key);
      const s = baseStats();
      expect(upgrade.isMaxed(s)).toBe(false);

      for (let i = 0; i < 50; i++) upgrade.apply(s);

      expect(atLimit(s), 'quedo exactamente en el tope').toBe(true);
      expect(upgrade.isMaxed(s)).toBe(true);
    });
  });
});

describe('WEAPON_UPGRADES', () => {
  it('WEAPON_KEYS y WEAPON_UPGRADES coinciden', () => {
    expect(Object.keys(WEAPON_UPGRADES).sort()).toEqual([...WEAPON_KEYS].sort());
  });

  it('cada unlock enciende su propio flag y ninguno más', () => {
    const flags = { aura: 'hasAura', orbit: 'hasOrbit', pierce: 'hasPierce', burst: 'hasBurst', nova: 'hasNova' };
    WEAPON_KEYS.forEach((weapon) => {
      const s = baseStats();
      WEAPON_UPGRADES[weapon].unlock.apply(s);

      expect(s[flags[weapon]], `${weapon} deberia desbloquearse`).toBe(true);
      Object.entries(flags)
        .filter(([other]) => other !== weapon)
        .forEach(([, flag]) => expect(s[flag], `${flag} no deberia activarse`).toBe(false));
    });
  });

  it('el unlock deja el arma usable (daño mayor a cero)', () => {
    const damageStat = { aura: 'auraDamage', orbit: 'orbitDamage', pierce: 'pierceDamage', burst: 'burstDamage', nova: 'novaDamage' };
    WEAPON_KEYS.forEach((weapon) => {
      const s = baseStats();
      WEAPON_UPGRADES[weapon].unlock.apply(s);
      expect(s[damageStat[weapon]]).toBeGreaterThan(0);
    });
  });

  it('el orbe arranca con 2 orbes y no pasa de 8', () => {
    const s = baseStats();
    WEAPON_UPGRADES.orbit.unlock.apply(s);
    expect(s.orbitCount).toBe(2);

    const countUpgrade = WEAPON_UPGRADES.orbit.upgrades.find((u) => u.key === 'orbitCount');
    for (let i = 0; i < 20; i++) countUpgrade.apply(s);
    expect(s.orbitCount).toBe(8);
    expect(countUpgrade.isMaxed(s)).toBe(true);
  });
});

describe('tablas de escalado pasivo por nivel', () => {
  it('GROWTH_STATS solo pide flags de armas que existen', () => {
    const validFlags = ['hasAura', 'hasOrbit', 'hasPierce', 'hasBurst', 'hasNova'];
    GROWTH_STATS.forEach(({ key, requires }) => {
      expect(key).toBeTruthy();
      if (requires) expect(validFlags).toContain(requires);
    });
  });

  it('COOLDOWN_STATS tiene un piso positivo en cada entrada', () => {
    // Sin piso, el escalado por nivel llevaría la cadencia a cero y rompería el juego.
    COOLDOWN_STATS.forEach(({ key, floor }) => {
      expect(key).toBeTruthy();
      expect(floor).toBeGreaterThan(0);
    });
  });

  it('los topes de GROWTH_STATS coinciden con los de las mejoras manuales', () => {
    // Si divergen, una stat podría superar por escalado el tope que la mejora respeta.
    const growthCap = (key) => GROWTH_STATS.find((g) => g.key === key)?.cap;
    expect(growthCap('moveSpeed')).toBe(480);
    expect(growthCap('magnetRadius')).toBe(550);
    expect(growthCap('dodge')).toBe(DODGE_CAP);
    expect(COOLDOWN_STATS.find((c) => c.key === 'fireRate').floor).toBe(130);
  });
});
