// ===== CARTAS =====
// Efectos estructurados — cada carta define sus efectos como objetos
// Tipos de efecto: damage, heal, draw, armor, venom, inspiration, summon,
//                  sacrifice, silence, freeze, weaken, fortify, conditional,
//                  damage_all_enemies, board_buff, cost_reduction, copy_card,
//                  swap_hands, discard_random, consumable

const ALL_CARDS = {
  mago: [
    {
      id: 'm_bola', name: 'Bola de Fuego', cost: 2, type: 'accion', maxCopies: 3,
      desc: '3 de daño directo',
      effects: [{ type: 'damage', target: 'enemy_hero', amount: 3 }]
    },
    {
      id: 'm_escarcha', name: 'Escarcha', cost: 2, type: 'accion', maxCopies: 3,
      desc: '4 de daño a una criatura + Congelar',
      effects: [
        { type: 'damage', target: 'enemy_creature', amount: 4 },
        { type: 'freeze', target: 'enemy_creature' }
      ]
    },
    {
      id: 'm_chispa', name: 'Chispa', cost: 0, type: 'accion', maxCopies: 3,
      desc: '1 de daño directo',
      effects: [{ type: 'damage', target: 'enemy_hero', amount: 1 }]
    },
    {
      id: 'm_escudo', name: 'Escudo Arcano', cost: 2, type: 'accion', maxCopies: 3,
      desc: 'Gana 3 de armadura',
      effects: [{ type: 'armor', target: 'self', amount: 3 }]
    },
    {
      id: 'm_saber', name: 'Saber Antiguo', cost: 3, type: 'accion', maxCopies: 1,
      desc: 'Roba 2 cartas',
      effects: [{ type: 'draw', amount: 2 }]
    },
    {
      id: 'm_rafaga', name: 'Ráfaga de Viento', cost: 4, type: 'accion', maxCopies: 1,
      desc: '6 de daño directo',
      effects: [{ type: 'damage', target: 'enemy_hero', amount: 6 }]
    },
    {
      id: 'm_centella', name: 'Centella', cost: 5, type: 'accion', maxCopies: 1,
      desc: '8 de daño directo. Consumible.',
      effects: [{ type: 'damage', target: 'enemy_hero', amount: 8 }],
      consumable: true
    },
    {
      id: 'm_muro', name: 'Muro de Hielo', cost: 3, type: 'criatura', maxCopies: 2,
      desc: 'Invocar 0/4 con Guardia',
      effects: [{ type: 'summon', atk: 0, hp: 4, guard: true }]
    },
    {
      id: 'm_explosion', name: 'Explosión Arcana', cost: 6, type: 'accion', maxCopies: 1,
      desc: '5 de daño a todas las criaturas enemigas',
      effects: [{ type: 'damage_all_enemies', amount: 5 }]
    },
    {
      id: 'm_teletransporte', name: 'Teletransporte', cost: 2, type: 'accion', maxCopies: 2,
      desc: 'Roba 1 carta. Próxima carta cuesta 1 menos.',
      effects: [
        { type: 'draw', amount: 1 },
        { type: 'cost_reduction', amount: 1 }
      ]
    }
  ],

  necromancer: [
    {
      id: 'n_esqueleto', name: 'Invocar Esqueleto', cost: 1, type: 'criatura', maxCopies: 3,
      desc: 'Invocar 2/1',
      effects: [{ type: 'summon', atk: 2, hp: 1 }]
    },
    {
      id: 'n_drenar', name: 'Drenar Vida', cost: 2, type: 'accion', maxCopies: 3,
      desc: 'Drenar 2',
      effects: [
        { type: 'damage', target: 'enemy_hero', amount: 2 },
        { type: 'heal', target: 'self', amount: 2 }
      ]
    },
    {
      id: 'n_toque', name: 'Toque Mortal', cost: 1, type: 'accion', maxCopies: 3,
      desc: '5 de daño. Sangre 2.',
      effects: [{ type: 'damage', target: 'any', amount: 5 }],
      resourceCost: { type: 'blood', amount: 2 }
    },
    {
      id: 'n_sacrificio', name: 'Sacrificio Oscuro', cost: 2, type: 'accion', maxCopies: 1,
      desc: 'Sacrifica criatura → roba 2 cartas',
      effects: [
        { type: 'sacrifice', target: 'self_creature' },
        { type: 'draw', amount: 2 }
      ]
    },
    {
      id: 'n_huesos', name: 'Huesos Revividos', cost: 3, type: 'criatura', maxCopies: 1,
      desc: 'Invocar 3/3. -1 si murió esqueleto.',
      effects: [{ type: 'summon', atk: 3, hp: 3 }]
    },
    {
      id: 'n_plaga', name: 'Plaga', cost: 3, type: 'accion', maxCopies: 1,
      desc: '2 de daño a todas las criaturas enemigas',
      effects: [{ type: 'damage_all_enemies', amount: 2 }]
    },
    {
      id: 'n_nigromancia', name: 'Nigromancia', cost: 4, type: 'criatura', maxCopies: 1,
      desc: 'Invocar 2 Esqueletos 2/1',
      effects: [
        { type: 'summon', atk: 2, hp: 1 },
        { type: 'summon', atk: 2, hp: 1 }
      ]
    },
    {
      id: 'n_alma', name: 'Alma en pena', cost: 2, type: 'criatura', maxCopies: 2,
      desc: 'Invocar 1/1. Al morir: roba 1 carta.',
      effects: [{ type: 'summon', atk: 1, hp: 1, deathrattle: 'draw' }]
    },
    {
      id: 'n_maldicion', name: 'Maldición', cost: 2, type: 'accion', maxCopies: 2,
      desc: 'Debilidad 2 a una criatura enemiga',
      effects: [{ type: 'weaken', target: 'enemy_creature', amount: 2 }]
    },
    {
      id: 'n_resurreccion', name: 'Resurrección', cost: 5, type: 'accion', maxCopies: 1,
      desc: 'Invocar 4/4 con Celeridad. Sangre 3.',
      effects: [{ type: 'summon', atk: 4, hp: 4, celerity: true }],
      resourceCost: { type: 'blood', amount: 3 }
    }
  ],

  guerrero: [
    {
      id: 'g_golpe', name: 'Golpe de Armadura', cost: 1, type: 'accion', maxCopies: 3,
      desc: '1 daño a criatura + 1 armadura',
      effects: [
        { type: 'damage', target: 'enemy_creature', amount: 1 },
        { type: 'armor', target: 'self', amount: 1 }
      ]
    },
    {
      id: 'g_ataque', name: 'Ataque Poderoso', cost: 3, type: 'accion', maxCopies: 3,
      desc: '5 de daño directo',
      effects: [{ type: 'damage', target: 'enemy_hero', amount: 5 }]
    },
    {
      id: 'g_levantar', name: 'Levantar Armadura', cost: 2, type: 'accion', maxCopies: 3,
      desc: 'Gana 4 de armadura',
      effects: [{ type: 'armor', target: 'self', amount: 4 }]
    },
    {
      id: 'g_tajo', name: 'Tajo', cost: 3, type: 'accion', maxCopies: 1,
      desc: '7 de daño a una criatura',
      effects: [{ type: 'damage', target: 'enemy_creature', amount: 7 }]
    },
    {
      id: 'g_contra', name: 'ContraGolpe', cost: 2, type: 'accion', maxCopies: 1,
      desc: '3+ armadura: 6 daño. Si no: 3.',
      effects: [{
        type: 'conditional',
        condition: { type: 'self_armor_gte', value: 3 },
        trueEffects: [{ type: 'damage', target: 'enemy_hero', amount: 6 }],
        falseEffects: [{ type: 'damage', target: 'enemy_hero', amount: 3 }]
      }]
    },
    {
      id: 'g_postura', name: 'Postura Defensiva', cost: 2, type: 'accion', maxCopies: 1,
      desc: 'Gana 6 armadura. No usas héroe el próximo turno.',
      effects: [
        { type: 'armor', target: 'self', amount: 6 },
        { type: 'silence', target: 'self_hero' }
      ]
    },
    {
      id: 'g_final', name: 'Golpe Final', cost: 5, type: 'accion', maxCopies: 1,
      desc: '10 daño directo. 5+ armadura: -1 coste.',
      effects: [{ type: 'damage', target: 'enemy_hero', amount: 10 }],
      costCondition: { type: 'self_armor_gte', value: 5, discount: 1 }
    },
    {
      id: 'g_escudero', name: 'Escudero', cost: 2, type: 'criatura', maxCopies: 2,
      desc: 'Invocar 2/3 con Guardia',
      effects: [{ type: 'summon', atk: 2, hp: 3, guard: true }]
    },
    {
      id: 'g_grito', name: 'Grito de Guerra', cost: 3, type: 'accion', maxCopies: 1,
      desc: 'Tus criaturas +2 ataque este turno',
      effects: [{ type: 'board_buff', target: 'self_creatures', atk: 2, duration: 'turn' }]
    },
    {
      id: 'g_fortalecer', name: 'Fortalecer', cost: 1, type: 'accion', maxCopies: 2,
      desc: 'Fortalecer 2 a una criatura aliada',
      effects: [{ type: 'fortify', target: 'self_creature', amount: 2 }]
    }
  ],

  asesino: [
    {
      id: 'a_navaja', name: 'Navaja', cost: 1, type: 'accion', maxCopies: 3,
      desc: '2 daño directo (3 si veneno)',
      effects: [{
        type: 'damage_conditional',
        target: 'enemy_hero',
        base: 2,
        bonus: 1,
        condition: 'enemy_venom'
      }]
    },
    {
      id: 'a_cuchillo', name: 'Cuchillo Arrojadizo', cost: 1, type: 'accion', maxCopies: 3,
      desc: '2 de daño directo',
      effects: [{ type: 'damage', target: 'enemy_hero', amount: 2 }]
    },
    {
      id: 'a_veneno', name: 'Veneno', cost: 1, type: 'accion', maxCopies: 3,
      desc: 'Veneno 2 al oponente',
      effects: [{ type: 'venom', target: 'enemy_hero', amount: 2 }]
    },
    {
      id: 'a_sombra', name: 'Golpe Sombra', cost: 2, type: 'accion', maxCopies: 1,
      desc: '4 daño directo. +1 carta si veneno.',
      effects: [
        { type: 'damage', target: 'enemy_hero', amount: 4 },
        { type: 'conditional', condition: { type: 'enemy_venom' }, trueEffects: [{ type: 'draw', amount: 1 }] }
      ]
    },
    {
      id: 'a_emboscada', name: 'Emboscada', cost: 2, type: 'accion', maxCopies: 1,
      desc: '3 daño. 2+ cartas jugadas: 6 daño.',
      effects: [{
        type: 'conditional',
        condition: { type: 'cards_played_gte', value: 2 },
        trueEffects: [{ type: 'damage', target: 'enemy_hero', amount: 6 }],
        falseEffects: [{ type: 'damage', target: 'enemy_hero', amount: 3 }]
      }]
    },
    {
      id: 'a_finta', name: 'Finta', cost: 0, type: 'accion', maxCopies: 1,
      desc: 'Próxima carta cuesta 1 menos.',
      effects: [{ type: 'cost_reduction', amount: 1 }]
    },
    {
      id: 'a_hoja', name: 'Hoja Envenenada', cost: 3, type: 'accion', maxCopies: 1,
      desc: '4 daño directo + Veneno 3',
      effects: [
        { type: 'damage', target: 'enemy_hero', amount: 4 },
        { type: 'venom', target: 'enemy_hero', amount: 3 }
      ]
    },
    {
      id: 'a_acechante', name: 'Acechante', cost: 2, type: 'criatura', maxCopies: 2,
      desc: 'Invocar 3/1 con Evasivo',
      effects: [{ type: 'summon', atk: 3, hp: 1, evasive: true }]
    },
    {
      id: 'a_daga', name: 'Daga Veloz', cost: 1, type: 'accion', maxCopies: 2,
      desc: '1 daño directo. Roba 1 carta.',
      effects: [
        { type: 'damage', target: 'enemy_hero', amount: 1 },
        { type: 'draw', amount: 1 }
      ]
    },
    {
      id: 'a_letal', name: 'Golpe Letal', cost: 4, type: 'accion', maxCopies: 1,
      desc: '6 daño. 3+ veneno: 10 daño.',
      effects: [{
        type: 'conditional',
        condition: { type: 'enemy_venom_gte', value: 3 },
        trueEffects: [{ type: 'damage', target: 'enemy_hero', amount: 10 }],
        falseEffects: [{ type: 'damage', target: 'enemy_hero', amount: 6 }]
      }]
    }
  ],

  bardo: [
    {
      id: 'b_nota', name: 'Nota Molesta', cost: 1, type: 'accion', maxCopies: 3,
      desc: '2 de daño directo',
      effects: [{ type: 'damage', target: 'enemy_hero', amount: 2 }]
    },
    {
      id: 'b_discordante', name: 'Nota Discordante', cost: 2, type: 'accion', maxCopies: 3,
      desc: '3 daño a criatura. Descarta 1 al azar.',
      effects: [
        { type: 'damage', target: 'enemy_creature', amount: 3 },
        { type: 'discard_random', target: 'enemy' }
      ]
    },
    {
      id: 'b_inspirar', name: 'Inspirar', cost: 1, type: 'accion', maxCopies: 3,
      desc: 'Inspiración 2',
      effects: [{ type: 'inspiration', target: 'self', amount: 2 }]
    },
    {
      id: 'b_actuacion', name: 'Actuación Estelar', cost: 2, type: 'accion', maxCopies: 1,
      desc: 'Consume 2 Inspiración → roba 2 cartas',
      effects: [{ type: 'draw', amount: 2 }],
      resourceCost: { type: 'inspiration', amount: 2 }
    },
    {
      id: 'b_cambalache', name: 'Cambalache', cost: 2, type: 'accion', maxCopies: 1,
      desc: 'Intercambia manos. Vuelve al final.',
      effects: [{ type: 'swap_hands' }]
    },
    {
      id: 'b_sonata', name: 'Sonata Confusa', cost: 3, type: 'accion', maxCopies: 1,
      desc: 'Consume toda Inspiración → descarta esa cantidad',
      effects: [{ type: 'discard_random', target: 'enemy', scale: 'inspiration' }],
      resourceCost: { type: 'inspiration', amount: 'all' }
    },
    {
      id: 'b_final', name: 'Final Épico', cost: 4, type: 'accion', maxCopies: 1,
      desc: '6 daño. 3+ Inspiración: Silenciar.',
      effects: [
        { type: 'damage', target: 'enemy_hero', amount: 6 },
        {
          type: 'conditional',
          condition: { type: 'self_inspiration_gte', value: 3 },
          trueEffects: [{ type: 'silence', target: 'enemy_hero' }]
        }
      ]
    },
    {
      id: 'b_murmullo', name: 'Murmullo', cost: 1, type: 'criatura', maxCopies: 2,
      desc: 'Invocar 1/2. Al invocar: Inspiración 1.',
      effects: [
        { type: 'summon', atk: 1, hp: 2 },
        { type: 'inspiration', target: 'self', amount: 1 }
      ]
    },
    {
      id: 'b_obertura', name: 'Obertura', cost: 3, type: 'accion', maxCopies: 1,
      desc: 'Inspiración 3',
      effects: [{ type: 'inspiration', target: 'self', amount: 3 }]
    },
    {
      id: 'b_bis', name: 'Bis', cost: 5, type: 'accion', maxCopies: 1,
      desc: 'Copia la última carta del oponente.',
      effects: [{ type: 'copy_card', target: 'enemy_last_played' }]
    }
  ]
};

window.ALL_CARDS = ALL_CARDS;