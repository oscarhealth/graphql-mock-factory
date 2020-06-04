import { GraphQLEnumType, getNullableType } from 'graphql';
import { automockLists } from './list';
import { automockRelay } from './relay';
import * as random from './random';

export function automockEnums(parentType, field) {
  const nullableType = getNullableType(field.type);
  if (!(nullableType instanceof GraphQLEnumType)) {
    return;
  }

  const values = nullableType.getValues().map(value => value.value);
  return () => values[random.getInt(0, values.length - 1)];
}

export const scalarMocks = {
  Boolean: () => random.getBoolean(),
  ID: () => random.getUUID(),
  Int: () => random.getInt(-100, 100),
  Float: () => random.getFloat(-100, 100),
  String: () => random.getString()
};

export function automockScalars(scalarMocks) {
  return (parentType, field) => {
    const nullableType = getNullableType(field.type);

    const scalarMock = scalarMocks[nullableType.name];
    if (scalarMock) {
      return scalarMock;
    }
  };
}

export const defaultAutomocks = [
  automockScalars(scalarMocks),
  automockEnums,
  automockLists,
  automockRelay
];
