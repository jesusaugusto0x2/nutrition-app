/**
 * Spanish UI texts. Every user-facing string lives here, keyed in English.
 * Components read them through `t` (see ./index.ts); never hardcode visible
 * text in components.
 */
export const es = {
  app: {
    name: 'Nutri',
  },
  common: {
    loading: 'Cargando…',
    back: 'Volver',
    retry: 'Reintentar',
    notAvailable: '—',
    errorTitle: 'Algo salió mal',
    errorDescription: 'No pudimos cargar la información. Intenta de nuevo.',
    notFoundTitle: 'Página no encontrada',
    notFoundDescription: 'La página que buscas no existe.',
    goHome: 'Ir al inicio',
    yes: 'Sí',
    no: 'No',
    remove: 'Quitar',
  },
  forms: {
    unanswered: 'Sin responder',
    computedHint: 'se calcula sola',
    showPassword: 'Mostrar',
    hidePassword: 'Ocultar',
    datePlaceholder: 'dd/mm/aaaa',
  },
  nav: {
    patients: 'Pacientes',
  },
  units: {
    kilograms: 'kg',
    meters: 'm',
    centimeters: 'cm',
    bmi: 'kg/m²',
  },
  patients: {
    listTitle: 'Pacientes',
    empty: 'Aún no hay pacientes registrados.',
    age: (years: number) => (years === 1 ? '1 año' : `${years} años`),
    sex: {
      female: 'Femenino',
      male: 'Masculino',
    },
    birthDate: 'Fecha de nacimiento',
    phone: 'Teléfono',
    address: 'Dirección',
    notFound: 'Paciente no encontrado',
    backToList: 'Volver a pacientes',
    lastConsultation: (date: string) => `Última consulta ${date}`,
    noConsultations: 'Sin consultas todavía',
    viewProfile: 'Ver ficha',
    viewProfileOf: (name: string) => `Ver ficha de ${name}`,
    currentBmi: 'IMC actual',
    columns: {
      patient: 'Paciente',
      age: 'Edad',
      lastConsultation: 'Última consulta',
      currentWeight: 'Peso actual',
      trend: 'Tendencia',
    },
  },
  consultations: {
    listTitle: 'Consultas',
    empty: 'Este paciente aún no tiene consultas registradas.',
    newConsultation: 'Nueva consulta',
    date: 'Fecha',
    weight: 'Peso',
    height: 'Talla',
    bmi: 'IMC',
    arm: 'Brazo',
    waist: 'Cintura',
    leg: 'Pierna',
    hip: 'Cadera',
    notes: 'Notas',
    sincePrevious: (days: number) =>
      days === 1 ? 'vs. hace 1 día' : `vs. hace ${days} días`,
    withUnit: (label: string, unit: string) => `${label} (${unit})`,
    inUnit: (label: string, unit: string) => `${label} en ${unit}`,
    previous: (value: string) => `Anterior: ${value}`,
    difference: 'Diferencia',
    noChange: 'Sin cambio',
    noChangeInline: 'sin cambio',
    initial: 'inicial',
    latest: 'Última consulta',
    first: 'Primera consulta',
    totalChange: 'Cambio total',
    totalRange: (from: string, to: string) => `del ${from} al ${to}`,
    edit: 'Editar',
    editOf: (date: string) => `Editar consulta del ${date}`,
    save: 'Guardar',
    cancel: 'Cancelar',
    records: 'Registros',
  },
  trend: {
    down: (amount: string) => `Bajó ${amount}`,
    up: (amount: string) => `Subió ${amount}`,
    none: 'Sin cambio',
  },
  /** Same as `trend`, inside a sentence: «58,4 kg · bajó 1,6 kg». */
  trendInline: {
    down: (amount: string) => `bajó ${amount}`,
    up: (amount: string) => `subió ${amount}`,
    none: 'sin cambio',
  },
  chart: {
    range: (from: string, to: string) => `De ${from} a ${to}`,
    singlePoint: 'Falta una consulta más para ver la evolución.',
  },
  bmi: {
    label: 'IMC',
    prompt: 'Escriba peso y talla para ver el IMC',
    withHeight: (height: string) => `con talla ${height}`,
    categories: {
      underweight: 'Bajo peso',
      normal: 'Peso normal',
      overweight: 'Sobrepeso',
      obesity1: 'Obesidad grado I',
      obesity2: 'Obesidad grado II',
      obesity3: 'Obesidad grado III',
    },
    minor: 'Menor de edad',
    percentileNote:
      'En menores de edad el IMC se interpreta por percentil según edad y sexo.',
  },
  auth: {
    title: 'Iniciar sesión',
    comingSoon: 'El inicio de sesión estará disponible próximamente.',
  },
  portal: {
    title: 'Portal del paciente',
    comingSoon: 'El portal para pacientes estará disponible próximamente.',
  },
};

/** Shape every additional language must implement. */
export type Messages = typeof es;
