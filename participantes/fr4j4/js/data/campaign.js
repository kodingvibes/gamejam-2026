// ===== CAMPAÑA =====
// Modo campaña: secuencia fija de enemigos con dificultad creciente.
// Cada etapa define la clase enemiga y su HP/armadura base (progresión manual).
// El HP del jugador persiste entre batallas (recompensa de curación entre etapas).

const CAMPAIGN_STAGES = [
  {
    id: 'c1', name: 'Aprendiz', classId: 'mago', hp: 25, armor: 0,
    desc: 'Un mago novato. Tu primera prueba.'
  },
  {
    id: 'c2', name: 'Cazador', classId: 'asesino', hp: 28, armor: 0,
    desc: 'Rápido y letal. No bajes la guardia.'
  },
  {
    id: 'c3', name: 'Centinela', classId: 'guerrero', hp: 32, armor: 4,
    desc: 'Un muro andante. Rompe su armadura.'
  },
  {
    id: 'c4', name: 'Nigromante', classId: 'necromancer', hp: 34, armor: 0,
    desc: 'La muerte lo rodea. Sobrevive a su horda.'
  },
  {
    id: 'c5', name: 'Bardo del Caos', classId: 'bardo', hp: 36, armor: 0,
    desc: 'El último desafío. Vence a la musa de la discordia.'
  }
];

// Curación fija entre etapas ganadas (no escala, simple y predecible)
const CAMPAIGN_HEAL = 5;

window.CAMPAIGN_STAGES = CAMPAIGN_STAGES;
window.CAMPAIGN_HEAL = CAMPAIGN_HEAL;
