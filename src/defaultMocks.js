import casual from 'casual';
import { GraphQLEnumType, GraphQLList, getNullableType } from 'graphql';
import { mockList } from './mockList';

export function getDefaultEnumMock(parentType, field) {
  const nullableType = getNullableType(field.type);
  if (!(nullableType instanceof GraphQLEnumType)) {
    return;
  }

  const values = nullableType.getValues().map(value => value.value);
  return () => values[casual.integer(0, values.length - 1)];
}

// TODO Use `faker` once v5 is released
const defaultScalarMocks = {
  Boolean: () => casual.boolean,
  ID: () => casual.uuid,
  Int: () => casual.integer(-100, 100),
  Float: () => casual.double(-100, 100),
  String: () => casual.string
};

export function getDefaultScalarMock(parentType, field) {
  const nullableType = getNullableType(field.type);

  const scalarMock = defaultScalarMocks[nullableType.name];
  if (scalarMock) {
    return scalarMock;
  }
}

export function getDefaultListMock(parentType, field) {
  const nullableType = getNullableType(field.type);
  if (nullableType instanceof GraphQLList) {
    return mockList(2);
  }
}

export const getDefaultMocks = [
  getDefaultEnumMock,
  getDefaultListMock,
  getDefaultScalarMock
];
