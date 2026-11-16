// DATOS DE PRUEBA. Los números son inventados para ejercitar el motor; NO son valores
// nutricionales reales y no deben llegar a la app. Los reales salen de USDA / ICBF.

const r = (id, nombre, tipos, kcal, proteina_g, fibra_g, gramos, ingredientes, extra = {}) =>
  ({ id, nombre, tipos, kcal, proteina_g, fibra_g, gramos, ingredientes: ingredientes.map(([alimentoId, g]) => ({ alimentoId, gramos: g })), nova: 1, ...extra });

export const recetas = [
  // desayunos
  r('huevos-arepa', 'Huevos pericos con arepa', ['desayuno'], 330, 24, 3, 250, [['huevo', 150], ['arepa', 60], ['tomate', 40]]),
  r('avena-banano', 'Avena con banano y proteína', ['desayuno'], 340, 30, 6, 300, [['avena', 40], ['banano', 100], ['proteina-polvo', 30]], { frutas: 1, integral: true, portatil: true }),
  r('sandwich-pavo', 'Sándwich de pavo', ['desayuno', 'snack'], 300, 26, 4, 180, [['pan-integral', 60], ['pavo', 80], ['queso', 20]], { integral: true, portatil: true }),
  r('yogur-granola', 'Yogur griego con fruta', ['desayuno', 'snack'], 220, 20, 3, 250, [['yogur-griego', 170], ['fresa', 80]], { frutas: 1, portatil: true, altaProteina: true }),
  // principales
  r('pollo-arroz', 'Pollo a la plancha con arroz', ['almuerzo', 'cena'], 520, 45, 3, 380, [['pechuga', 160], ['arroz', 70], ['tomate', 80]], { proteinaPrincipal: 'pollo' }),
  r('frijolada', 'Fríjoles con carne', ['almuerzo'], 540, 36, 14, 450, [['frijol', 80], ['res', 90], ['arroz', 40]], { proteinaPrincipal: 'res', legumbre: true }),
  r('lentejas', 'Lentejas guisadas con huevo', ['almuerzo', 'cena'], 480, 30, 13, 420, [['lenteja', 80], ['huevo', 100], ['arroz', 30]], { proteinaPrincipal: 'huevo', legumbre: true }),
  r('trucha-papa', 'Trucha con papa', ['almuerzo', 'cena'], 500, 40, 4, 400, [['trucha', 170], ['papa', 200]], { proteinaPrincipal: 'pescado' }),
  r('carne-papa', 'Carne asada con papa y ensalada', ['almuerzo', 'cena'], 530, 42, 5, 420, [['res', 150], ['papa', 180], ['lechuga', 60]], { proteinaPrincipal: 'res' }),
  r('wrap-pollo', 'Wrap de pollo', ['almuerzo', 'cena'], 450, 38, 5, 300, [['tortilla-integral', 60], ['pechuga', 130], ['lechuga', 40]], { proteinaPrincipal: 'pollo', integral: true, portatil: true }),
  r('atun-pasta', 'Pasta integral con atún', ['almuerzo', 'cena'], 480, 36, 7, 350, [['pasta-integral', 70], ['atun', 120], ['tomate', 80]], { proteinaPrincipal: 'pescado', integral: true }),
  r('cerdo-yuca', 'Lomo de cerdo con yuca', ['almuerzo', 'cena'], 520, 40, 3, 380, [['cerdo', 150], ['yuca', 150]], { proteinaPrincipal: 'cerdo' }),
  r('omelette', 'Omelette con queso y champiñones', ['cena'], 380, 30, 2, 280, [['huevo', 150], ['queso', 40], ['champinon', 80]], { proteinaPrincipal: 'huevo' }),
  // recetas que NO deben salir nunca en las pruebas
  r('crema-ahuyama', 'Crema de ahuyama con pollo', ['almuerzo', 'cena'], 500, 45, 6, 450, [['ahuyama', 250], ['pechuga', 150]], { proteinaPrincipal: 'pollo' }),
  r('pollo-brocoli', 'Pollo con brócoli', ['almuerzo', 'cena'], 500, 48, 7, 400, [['pechuga', 170], ['brocoli', 150], ['arroz', 50]], { proteinaPrincipal: 'pollo' }),
  r('camarones-ajillo', 'Camarones al ajillo', ['cena'], 400, 40, 1, 300, [['camaron', 200], ['arroz', 50]], { proteinaPrincipal: 'mariscos' }),
  // snacks
  r('batido', 'Batido de proteína', ['snack'], 240, 40, 1, 350, [['proteina-polvo', 60]], { portatil: true, altaProteina: true, nova: 3 }),
  r('fruta-mani', 'Manzana con maní', ['snack'], 200, 6, 5, 180, [['manzana', 150], ['mani', 20]], { frutas: 1, portatil: true }),
  r('atun-galletas', 'Atún con galletas integrales', ['snack'], 210, 24, 3, 150, [['atun', 100], ['galleta-integral', 25]], { portatil: true, integral: true }),
];

export const alimentos = {
  brocoli: { loComo: false },
  camaron: { loComo: false },
  ahuyama: { loComo: false },
  pechuga: { loComo: true },
  frijol: { loComo: true },
};

export const perfil = { sexo: 'm', kg: 86, cm: 174, edad: 28 };
