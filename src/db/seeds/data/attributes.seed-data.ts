import { AttributeDataType } from '../../../attributes/entities/attribute-data-type.enum';

export const attributesSeedData = [
  {
    name: 'Battery life',
    slug: 'battery-life',
    dataType: AttributeDataType.NUMBER,
    unit: 'hours',
  },
  {
    name: 'Weight',
    slug: 'weight',
    dataType: AttributeDataType.NUMBER,
    unit: 'grams',
  },
  {
    name: 'Bluetooth',
    slug: 'bluetooth',
    dataType: AttributeDataType.BOOLEAN,
    unit: null,
  },
  {
    name: 'Connection type',
    slug: 'connection-type',
    dataType: AttributeDataType.STRING,
    unit: null,
  },
  {
    name: 'Noise cancelling',
    slug: 'noise-cancelling',
    dataType: AttributeDataType.BOOLEAN,
    unit: null,
  },
] as const;
