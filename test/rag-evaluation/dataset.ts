import type { RagEvaluationDataset } from './types';

export const RAG_EVALUATION_DATASET: RagEvaluationDataset = {
  version: '1.3.0',
  products: [
    {
      key: 'auricular-conference-pro',
      name: 'Auricular Conference Pro',
      slug: 'rag-eval-auricular-conference-pro',
      documents: [
        {
          key: 'auricular-manual',
          name: 'Manual del Auricular Conference Pro',
          chunks: [
            {
              evidenceKey: 'auricular-mute',
              content:
                'El auricular tiene un botón físico dedicado para silenciar y reactivar el micrófono durante una llamada.',
              page: 14,
              section: 'Controles de llamada',
            },
            {
              evidenceKey: 'auricular-bateria',
              content:
                'La batería ofrece hasta 38 horas de autonomía. Una carga completa mediante USB-C tarda aproximadamente 2 horas.',
              page: 21,
              section: 'Batería y carga',
            },
            {
              evidenceKey: 'auricular-anc',
              content:
                'La cancelación activa de ruido se puede activar para llamadas y reproducción de música.',
              page: 8,
              section: 'Audio',
            },
            {
              evidenceKey: 'auricular-multipunto',
              content:
                'La conexión Bluetooth multipunto permite mantener enlazados dos dispositivos al mismo tiempo.',
              page: 11,
              section: 'Conectividad',
            },
          ],
        },
        {
          key: 'auricular-soporte',
          name: 'Garantía y compatibilidad del Auricular Conference Pro',
          chunks: [
            {
              evidenceKey: 'auricular-garantia',
              content:
                'La garantía limitada tiene una duración de 2 años desde la fecha de compra y no cubre daños accidentales.',
              page: 2,
              section: 'Garantía',
            },
            {
              evidenceKey: 'auricular-compatibilidad',
              content:
                'El auricular es compatible con Windows 11, macOS 14, Android 13 o posterior e iOS 17 o posterior.',
              page: 4,
              section: 'Sistemas compatibles',
            },
          ],
        },
      ],
    },
    {
      key: 'cafetera-barista-home',
      name: 'Cafetera Barista Home',
      slug: 'rag-eval-cafetera-barista-home',
      documents: [
        {
          key: 'cafetera-manual',
          name: 'Manual de la Cafetera Barista Home',
          chunks: [
            {
              evidenceKey: 'cafetera-deposito',
              content:
                'El depósito de agua extraíble tiene una capacidad de 1,8 litros.',
              page: 6,
              section: 'Depósito de agua',
            },
            {
              evidenceKey: 'cafetera-presion',
              content:
                'La bomba trabaja a una presión máxima de 15 bares para preparar espresso.',
              page: 9,
              section: 'Preparación',
            },
            {
              evidenceKey: 'cafetera-molinillo',
              content:
                'El molinillo cónico integrado ofrece 12 niveles de molienda ajustables.',
              page: 12,
              section: 'Molinillo',
            },
            {
              evidenceKey: 'cafetera-limpieza',
              content:
                'El ciclo automático de limpieza debe ejecutarse cuando se encienda el indicador CLEAN y requiere una pastilla de limpieza.',
              page: 24,
              section: 'Limpieza',
            },
            {
              evidenceKey: 'cafetera-leche',
              content:
                'La varilla de vapor permite espumar leche. Se debe purgar y limpiar con un paño húmedo después de cada uso.',
              page: 18,
              section: 'Vaporizador',
            },
          ],
        },
        {
          key: 'cafetera-garantia',
          name: 'Garantía de la Cafetera Barista Home',
          chunks: [
            {
              evidenceKey: 'cafetera-cobertura',
              content:
                'La cafetera cuenta con 24 meses de garantía para defectos de fabricación. La acumulación de sarro queda excluida.',
              page: 2,
              section: 'Cobertura',
            },
          ],
        },
      ],
    },
    {
      key: 'airpods-pro-2',
      name: 'AirPods Pro 2',
      slug: 'rag-eval-airpods-pro-2',
      documents: [
        {
          key: 'airpods-pro-2-especificaciones',
          name: 'Especificaciones técnicas de los AirPods Pro 2',
          chunks: [
            {
              evidenceKey: 'airpods-conectividad',
              content:
                'Los AirPods Pro 2 incorporan el chip H2, cancelación activa de ruido, audio adaptativo, modo de sonido ambiente y detección de conversación. Los auriculares y el estuche de carga son resistentes al polvo, al agua y al sudor. Ofrecen hasta 6 horas de reproducción de audio con una sola carga y hasta 30 horas con el estuche. La conectividad utiliza tecnología inalámbrica Bluetooth 5.3. Se pueden usar con dispositivos Apple actualizados y como auriculares Bluetooth con otros dispositivos, aunque algunas funciones pueden estar limitadas.',
              page: 1,
              section: 'Especificaciones técnicas',
            },
          ],
        },
      ],
    },
    {
      key: 'auriculares-travel-mini',
      name: 'Auriculares Travel Mini',
      slug: 'rag-eval-auriculares-travel-mini',
      documents: [
        {
          key: 'auriculares-travel-mini-ficha',
          name: 'Ficha técnica de Auriculares Travel Mini',
          chunks: [
            {
              evidenceKey: 'travel-mini-peso',
              content: 'Peso: 384,8 g.',
              page: 1,
              section: 'Especificaciones físicas',
            },
          ],
        },
      ],
    },
  ],
  cases: [
    {
      id: 'answer-01',
      productKey: 'auricular-conference-pro',
      question: '¿Puedo silenciar el micrófono con un control físico?',
      expectedEvidenceKeys: ['auricular-mute'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [
        ['boton', 'control fisico'],
        ['silenciar', 'mute'],
      ],
      forbiddenTerms: ['control tactil'],
    },
    {
      id: 'answer-02',
      productKey: 'auricular-conference-pro',
      question: '¿Cuántas horas dura la batería?',
      expectedEvidenceKeys: ['auricular-bateria'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [['38 horas']],
      forbiddenTerms: ['40 horas'],
    },
    {
      id: 'answer-03',
      productKey: 'auricular-conference-pro',
      question: '¿Cuánto tarda en cargarse por completo?',
      expectedEvidenceKeys: ['auricular-bateria'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [
        ['2 horas', 'dos horas'],
        ['usb-c', 'usb c'],
      ],
      forbiddenTerms: ['carga inalambrica'],
    },
    {
      id: 'answer-04',
      productKey: 'auricular-conference-pro',
      question: '¿Incluye reducción electrónica del ruido exterior?',
      expectedEvidenceKeys: ['auricular-anc'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [['cancelacion activa', 'anc']],
      forbiddenTerms: ['solo pasiva'],
    },
    {
      id: 'answer-05',
      productKey: 'auricular-conference-pro',
      question: '¿Se puede conectar a más de un equipo simultáneamente?',
      expectedEvidenceKeys: ['auricular-multipunto'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [
        ['dos dispositivos', '2 dispositivos'],
        ['multipunto'],
      ],
      forbiddenTerms: ['tres dispositivos'],
    },
    {
      id: 'answer-06',
      productKey: 'auricular-conference-pro',
      question: '¿Qué plazo de garantía tiene el auricular?',
      expectedEvidenceKeys: ['auricular-garantia'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [['2 anos', 'dos anos']],
      forbiddenTerms: ['de por vida'],
    },
    {
      id: 'answer-07',
      productKey: 'cafetera-barista-home',
      question: '¿Qué capacidad tiene el tanque de agua?',
      expectedEvidenceKeys: ['cafetera-deposito'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [['1,8 litros', '1.8 litros']],
      forbiddenTerms: ['2 litros'],
    },
    {
      id: 'answer-08',
      productKey: 'cafetera-barista-home',
      question: '¿Cuál es la presión máxima de la bomba?',
      expectedEvidenceKeys: ['cafetera-presion'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [['15 bares', '15 bar']],
      forbiddenTerms: ['19 bares'],
    },
    {
      id: 'answer-09',
      productKey: 'cafetera-barista-home',
      question: '¿Cuántos ajustes ofrece el molino integrado?',
      expectedEvidenceKeys: ['cafetera-molinillo'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [['12 niveles', '12 ajustes']],
      forbiddenTerms: ['20 niveles'],
    },
    {
      id: 'answer-10',
      productKey: 'cafetera-barista-home',
      question: '¿Cuándo debo iniciar el programa de limpieza?',
      expectedEvidenceKeys: ['cafetera-limpieza'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [
        ['indicador clean', 'luz clean'],
        ['pastilla'],
      ],
      forbiddenTerms: ['vinagre'],
    },
    {
      id: 'answer-11',
      productKey: 'cafetera-barista-home',
      question: '¿Cómo se cuida el vaporizador después de usarlo?',
      expectedEvidenceKeys: ['cafetera-leche'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [
        ['purgar', 'purga'],
        ['pano humedo', 'paño húmedo'],
      ],
      forbiddenTerms: ['lavavajillas'],
    },
    {
      id: 'answer-12',
      productKey: 'cafetera-barista-home',
      question: '¿La garantía cubre problemas provocados por sarro?',
      expectedEvidenceKeys: ['cafetera-cobertura'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [
        ['no cubre', 'excluida', 'excluye'],
        ['sarro'],
      ],
      forbiddenTerms: ['si cubre'],
    },
    {
      id: 'unsupported-01',
      productKey: 'auricular-conference-pro',
      question: '¿En qué colores se vende el auricular?',
      expectedEvidenceKeys: [],
      expectedBehavior: 'ABSTAIN',
      requiredAnswerTermGroups: [],
      forbiddenTerms: ['negro', 'blanco', 'azul'],
    },
    {
      id: 'unsupported-02',
      productKey: 'cafetera-barista-home',
      question: '¿Cuál es el precio de la cafetera?',
      expectedEvidenceKeys: [],
      expectedBehavior: 'ABSTAIN',
      requiredAnswerTermGroups: [],
      forbiddenTerms: ['$', 'euros', 'dolares'],
    },
    {
      id: 'unsupported-03',
      question: '¿Cuál de los dos productos tiene mejores reseñas de clientes?',
      expectedEvidenceKeys: [],
      expectedBehavior: 'ABSTAIN',
      requiredAnswerTermGroups: [],
      forbiddenTerms: ['estrellas', 'mejores resenas'],
    },
    {
      id: 'unsupported-04',
      productKey: 'cafetera-barista-home',
      question: '¿La cafetera se puede controlar desde una aplicación móvil?',
      expectedEvidenceKeys: [],
      expectedBehavior: 'ABSTAIN',
      requiredAnswerTermGroups: [],
      forbiddenTerms: ['wifi', 'bluetooth', 'aplicacion compatible'],
    },
    {
      id: 'partial-01',
      productKey: 'auricular-conference-pro',
      question: '¿Cuánto dura la batería y cuánto pesa el auricular?',
      expectedEvidenceKeys: ['auricular-bateria'],
      expectedBehavior: 'PARTIAL_ANSWER',
      requiredAnswerTermGroups: [['38 horas']],
      requiredLimitationTermGroups: [
        ['peso'],
        [
          'no dispongo de informacion suficiente',
          'no hay suficiente informacion',
          'no se indica',
          'no se especifica',
        ],
      ],
      forbiddenTerms: ['gramos', 'pesa'],
    },
    {
      id: 'partial-02',
      productKey: 'auricular-conference-pro',
      question: '¿Es compatible con Windows 11 y con Linux?',
      expectedEvidenceKeys: ['auricular-compatibilidad'],
      expectedBehavior: 'PARTIAL_ANSWER',
      requiredAnswerTermGroups: [['windows 11']],
      requiredLimitationTermGroups: [
        ['linux'],
        [
          'no dispongo de informacion suficiente',
          'no hay suficiente informacion',
          'no se indica',
          'no se especifica',
        ],
      ],
      forbiddenTerms: ['compatible con linux'],
    },
    {
      id: 'partial-03',
      productKey: 'cafetera-barista-home',
      question: '¿Qué presión alcanza y qué consumo eléctrico tiene?',
      expectedEvidenceKeys: ['cafetera-presion'],
      expectedBehavior: 'PARTIAL_ANSWER',
      requiredAnswerTermGroups: [['15 bares', '15 bar']],
      requiredLimitationTermGroups: [
        ['consumo electrico'],
        [
          'no dispongo de informacion suficiente',
          'no hay suficiente informacion',
          'no se indica',
          'no se especifica',
        ],
      ],
      forbiddenTerms: ['vatios', 'watts'],
    },
    {
      id: 'partial-04',
      productKey: 'cafetera-barista-home',
      question: '¿La garantía dura 24 meses e incluye la acumulación de sarro?',
      expectedEvidenceKeys: ['cafetera-cobertura'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [
        ['24 meses'],
        ['no incluye', 'no cubre', 'excluida', 'excluye'],
        ['sarro'],
      ],
      forbiddenTerms: ['incluye el sarro', 'cubre el sarro'],
    },
    {
      id: 'lexical-01',
      productKey: 'airpods-pro-2',
      question: '¿Tiene Bluetooth?',
      expectedEvidenceKeys: ['airpods-conectividad'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [['bluetooth']],
      forbiddenTerms: [],
    },
    {
      id: 'lexical-weight-01',
      productKey: 'auriculares-travel-mini',
      question: '¿Cuánto pesan?',
      expectedEvidenceKeys: ['travel-mini-peso'],
      expectedBehavior: 'FULL_ANSWER',
      requiredAnswerTermGroups: [['384,8 g', '384.8 g']],
      forbiddenTerms: [],
    },
    {
      id: 'lexical-unsupported-01',
      productKey: 'airpods-pro-2',
      question: '¿Qué alcance tiene Bluetooth?',
      expectedEvidenceKeys: [],
      expectedBehavior: 'ABSTAIN',
      requiredAnswerTermGroups: [],
      forbiddenTerms: ['metros', 'pies'],
    },
    {
      id: 'lexical-unsupported-02',
      productKey: 'airpods-pro-2',
      question: '¿Qué códecs Bluetooth admite?',
      expectedEvidenceKeys: [],
      expectedBehavior: 'ABSTAIN',
      requiredAnswerTermGroups: [],
      forbiddenTerms: ['aac', 'sbc', 'aptx', 'ldac'],
    },
  ],
};
