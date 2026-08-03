// ===== TUTORIAL =====
// Glosario de conceptos + páginas del overlay "¿CÓMO JUGAR?"
// Texto en español. El glosario valida que todo efecto/keyword tenga ayuda.

const TUTORIAL_GLOSSARY = [
  { id: 'mana', title: 'MANÁ', desc: 'Tu recurso por turno. Empieza en 1 y crece hasta 7. Jugar cartas cuesta maná.' },
  { id: 'armor', title: 'ARMADURA', desc: 'Absorbe daño antes que tu vida. Se acumula con cartas y poderes.' },
  { id: 'venom', title: 'VENENO', desc: 'Estado que daña al héroe enemigo al comienzo de su turno y baja de a 1. Apila con el Asesino.' },
  { id: 'inspiration', title: 'INSPIRACIÓN', desc: 'Recurso del Bardo. Se gana con cartas y alimenta efectos de robo o descarte.' },
  { id: 'blood', title: 'SANGRE', desc: 'Costo alternativo del Necromancer: pagas vida (mínimo 1 HP) para lanzar cartas poderosas.' },
  { id: 'guard', title: 'GUARDIA', desc: 'Las criaturas con Guardia protegen a tu héroe: los ataques las golpean a ellas primero.' },
  { id: 'evasive', title: 'EVASIVO', desc: 'No puede ser bloqueado por criaturas enemigas mientras ataca. Ideal para daño directo.' },
  { id: 'celerity', title: 'CELERIDAD', desc: 'La criatura puede atacar el mismo turno en que es invocada.' },
  { id: 'consumable', title: 'CONSUMIBLE', desc: 'Al jugarse no vuelve a tu mazo de descarte. Se pierde para siempre.' },
  { id: 'hero-power', title: 'PODER DE HÉROE', desc: 'Habilidad única de tu clase. Cuesta 1 de maná y solo se usa una vez por turno.' },
  { id: 'timer', title: 'TEMPORIZADOR', desc: 'En el modo VS IA tienes 60 segundos por turno. Al llegar a 0, el turno termina solo.' },
  { id: 'board-slots', title: 'TABLERO', desc: 'Cada lado tiene 4 espacios para criaturas. Si está lleno no puedes invocar más.' },
  { id: 'hand', title: 'MANO', desc: 'Las cartas que tienes disponibles. Robas 2 por turno. Máximo 8 en mano.' },
  { id: 'deck', title: 'MAZO', desc: 'Las cartas que robarás. Cuando se agota, se baraja el descarte y sigue.' },
  { id: 'discard', title: 'DESCARTE', desc: 'Cartas jugadas o descartadas. Se barajan de nuevo cuando el mazo se vacía.' },
  { id: 'freeze', title: 'CONGELAR', desc: 'La criatura no puede atacar en el próximo combate.' },
  { id: 'weaken', title: 'DEBILITAR', desc: 'Reduce el ataque de una criatura enemiga.' },
  { id: 'fortify', title: 'FORTALECER', desc: 'Aumenta el ataque de una criatura aliada.' },
  { id: 'silence', title: 'SILENCIO', desc: 'Impide usar el poder de héroe durante los turnos indicados.' },
  { id: 'sacrifice', title: 'SACRIFICIO', desc: 'Destruye una criatura propia para activar un efecto, como robar cartas.' },
  { id: 'draw', title: 'ROBAR', desc: 'Tomar cartas del mazo a tu mano.' },
  { id: 'cost-reduction', title: 'DESCUENTO', desc: 'Reduce el coste de tu próxima carta este turno.' },
  { id: 'deckbuilder', title: 'DECKBUILDER', desc: 'Construye tu baraja: mínimo 5 cartas, respetando el límite de copias por carta.' }
];

const TUTORIAL_PAGES = [
  {
    id: 'intro',
    title: '¿QUÉ ES DECKSTINY?',
    body: [
      'Un duelo de cartas por turnos contra la IA.',
      'Elige una de 5 clases, arma tu baraja',
      'y reduce la vida del héroe rival a 0.'
    ],
    footer: '1 / 7'
  },
  {
    id: 'objetivo',
    title: 'OBJETIVO',
    body: [
      'Gana quien deje al rival sin vida.',
      'Ataca con cartas de daño directo',
      'o con tus criaturas cada turno.'
    ],
    footer: '2 / 7'
  },
  {
    id: 'turno',
    title: 'ESTRUCTURA DE TURNO',
    body: [
      'Robas 2 cartas. El maná sube 1 (máx 7).',
      'Juega cartas y ataca con criaturas.',
      'Termina con FIN DE TURNO (tecla E).',
      'La IA responde y vuelve tu turno.'
    ],
    footer: '3 / 7'
  },
  {
    id: 'recursos',
    title: 'RECURSOS',
    body: [
      'MANÁ: cuesta jugar cartas.',
      'ARMADURA: absorbe daño antes que la vida.',
      'SANGRE (Necromancer): paga vida por poder.',
      'VENENO (Asesino): daña con el tiempo.',
      'INSPIRACIÓN (Bardo): alimenta combos.'
    ],
    footer: '4 / 7'
  },
  {
    id: 'criaturas',
    title: 'CRIATURAS',
    body: [
      'Se invocan al tablero (4 espacios).',
      'Atacan al héroe enemigo o a criaturas.',
      'GUARDIA: protege tu héroe.',
      'EVASIVO: no puede ser bloqueado.',
      'CELERIDAD: ataca al invocarse.'
    ],
    footer: '5 / 7'
  },
  {
    id: 'heroe',
    title: 'PODER DE HÉROE',
    body: [
      'Cada clase tiene una habilidad única.',
      'Cuesta 1 de maná y se usa 1 vez por turno.',
      'Ej: Mago lanza Bola de Fuego (2 daño).',
      'Úsalo con el botón junto a tu héroe.'
    ],
    footer: '6 / 7'
  },
  {
    id: 'deckbuilder',
    title: 'DECKBUILDER',
    body: [
      'Arma tu baraja con mínimo 5 cartas.',
      'Cada carta tiene un límite de copias.',
      'Guardas la baraja en un espacio (slot)',
      'y la eliges antes de cada combate.'
    ],
    footer: '7 / 7'
  }
];

window.TUTORIAL_GLOSSARY = TUTORIAL_GLOSSARY;
window.TUTORIAL_PAGES = TUTORIAL_PAGES;
