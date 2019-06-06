import casual from 'casual';
import { GraphQLEnumType, getNullableType } from 'graphql';
import { automockLists } from './list';
import { automockRelay } from './relay';

export function automockEnums(parentType, field) {
  const nullableType = getNullableType(field.type);
  if (!(nullableType instanceof GraphQLEnumType)) {
    return;
  }

  const values = nullableType.getValues().map(value => value.value);
  return () => values[casual.integer(0, values.length - 1)];
}

// TODO Use `faker` once v5 is released
export const scalarMocks = {
  Boolean: () => casual.boolean,
  ID: () => casual.uuid,
  Int: () => casual.integer(-100, 100),
  Float: () => casual.double(-100, 100),
  String: () => casual.string
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
