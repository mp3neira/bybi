// Preços aqui são só exemplos — troque pelos valores reais da Bybi.
// Estes são os produtos padrão (usados só se nada tiver sido salvo no painel admin ainda).
const DEFAULT_PRODUCTS = [
  {
    id: 'p1',
    name: 'Bolsa Star',
    category: 'tiracolo',
    price: 189.90,
    badge: 'Feito à mão',
    variants: [
      { color: 'Cinza chumbo', hex: '#7d7d78', img: 'assets/bolsa-cinza.jpg' },
      { color: 'Marrom café', hex: '#4a2c28', img: 'assets/bolsa-marrom.jpg' },
      { color: 'Creme', hex: '#ece3d1', img: 'assets/bolsa-creme.jpg' },
    ],
  },
];

// Categorias padrão (o admin pode adicionar, renomear ou remover no painel).
const DEFAULT_CATEGORIES = ['tiracolo'];

// Depoimentos — exemplos fictícios, troque pelos comentários reais das clientes.
const TESTIMONIALS = [
  { name: 'Cliente Bybi', text: 'A bolsa chegou até mais bonita do que na foto. Dá pra ver o cuidado em cada ponto.' },
  { name: 'Cliente Bybi', text: 'Pedi uma personalizada e ela acertou exatamente a cor que eu queria. Amei o resultado.' },
  { name: 'Cliente Bybi', text: 'Acabamento impecável e um atendimento super atencioso do início ao fim.' },
];
