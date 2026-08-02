// Tests de las funciones puras que arman el contenido de los paneles. No tocan
// Phaser: reciben stats y devuelven datos, por eso se pueden testear directo.

import { describe, expect, it } from 'vitest';
import { buildStatRows, buildWeaponSlots } from './PauseMenu.js';
import { formatTime } from './widgets.js';

function baseStats(overrides = {}) {
  return {
    damage: 20, fireRate: 600, moveSpeed: 220, maxHp: 100, hp: 100, magnetRadius: 90,
    hpRegen: 0, lifesteal: 0, dodge: 0, shield: 0, shieldMax: 0,
    hasAura: false, hasOrbit: false, hasPierce: false, hasBurst: false, hasNova: false,
    ...overrides,
  };
}

describe('formatTime', () => {
  it('formatea mm:ss con cero a la izquierda', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(5000)).toBe('00:05');
    expect(formatTime(65000)).toBe('01:05');
  });

  it('no colapsa al pasar los 10 minutos', () => {
    expect(formatTime(600000)).toBe('10:00');
    expect(formatTime(3599000)).toBe('59:59');
  });

  it('trunca los milisegundos sueltos en vez de redondear hacia arriba', () => {
    // Si redondeara, el cronómetro mostraría un segundo que todavía no pasó.
    expect(formatTime(1999)).toBe('00:01');
  });
});

describe('buildStatRows', () => {
  it('siempre muestra las stats base', () => {
    const labels = buildStatRows(baseStats()).map((r) => r.label);
    expect(labels.some((l) => l.startsWith('Daño:'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Cadencia:'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Velocidad:'))).toBe(true);
    expect(labels.some((l) => l.startsWith('HP máximo:'))).toBe(true);
  });

  it('omite las stats de supervivencia que están en cero', () => {
    // La regla es no llenar el panel de filas que no aportan nada.
    const labels = buildStatRows(baseStats()).map((r) => r.label);
    expect(labels.some((l) => l.includes('Regeneración'))).toBe(false);
    expect(labels.some((l) => l.includes('Robo de vida'))).toBe(false);
    expect(labels.some((l) => l.includes('Esquivar'))).toBe(false);
    expect(labels.some((l) => l.includes('Escudo'))).toBe(false);
  });

  it('muestra las stats de supervivencia una vez activas', () => {
    const rows = buildStatRows(baseStats({ hpRegen: 1.2, lifesteal: 0.05, dodge: 0.07, shieldMax: 35, shield: 35 }));
    const labels = rows.map((r) => r.label);
    expect(labels.some((l) => l.includes('Regeneración: 1.2/s'))).toBe(true);
    expect(labels.some((l) => l.includes('Robo de vida: 5%'))).toBe(true);
    expect(labels.some((l) => l.includes('Esquivar: 7%'))).toBe(true);
    expect(labels.some((l) => l.includes('Escudo: 35/35'))).toBe(true);
  });

  it('la cadencia se muestra en disparos por segundo, no en ms', () => {
    const row = buildStatRows(baseStats({ fireRate: 500 })).find((r) => r.label.startsWith('Cadencia:'));
    expect(row.label).toBe('Cadencia: 2.0/s');
  });

  it('cada fila trae icono y color para poder pintarse', () => {
    buildStatRows(baseStats({ hpRegen: 1 })).forEach((row) => {
      expect(row.icon).toMatch(/^icon-/);
      expect(typeof row.color).toBe('number');
      expect(row.label).toBeTruthy();
    });
  });
});

describe('buildWeaponSlots', () => {
  it('devuelve las 5 armas aunque ninguna esté desbloqueada', () => {
    const slots = buildWeaponSlots(baseStats());
    expect(Object.keys(slots).sort()).toEqual(['aura', 'burst', 'nova', 'orbit', 'pierce']);
    Object.values(slots).forEach((slot) => expect(slot.unlocked).toBe(false));
  });

  it('marca como desbloqueada solo el arma que corresponde', () => {
    const slots = buildWeaponSlots(baseStats({ hasOrbit: true, orbitDamage: 26, orbitCount: 3 }));
    expect(slots.orbit.unlocked).toBe(true);
    expect(slots.aura.unlocked).toBe(false);
    expect(slots.nova.unlocked).toBe(false);
  });

  it('el detalle resume daño y parámetro propio del arma', () => {
    const slots = buildWeaponSlots(baseStats({
      hasOrbit: true, orbitDamage: 26, orbitCount: 3,
      hasNova: true, novaDamage: 40, novaRadius: 180,
    }));
    expect(slots.orbit.detail).toBe('26 dmg · x3');
    expect(slots.nova.detail).toBe('40 dmg · radio 180');
  });

  it('las armas bloqueadas no traen detalle que mostrar', () => {
    expect(buildWeaponSlots(baseStats()).aura.detail).toBe('');
  });
});
