// ─── Weapon Config ───────────────────────────────────────────────────────────

export type WeaponKind = 'LASER' | 'BOMB';

export interface WeaponData {
  name: string;
  kind: WeaponKind;
  damage: number;
  fireRate: number;
  speed: number;
  color: number;
  radius: number;      // visual radius
  length: number;      // visual length (lasers)
}

export const WEAPON_LIST: WeaponData[] = [
  {
    name: 'LASER',
    kind: 'LASER',
    damage: 15,
    fireRate: 0.12,
    speed: 120,
    color: 0x4488ff,
    radius: 0.18,
    length: 3.0,
  },
  {
    name: 'BOMB',
    kind: 'BOMB',
    damage: 200,
    fireRate: 1.2,
    speed: 50,
    color: 0xffffff,
    radius: 0.6,
    length: 0,
  },
];