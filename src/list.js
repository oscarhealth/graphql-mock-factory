// @flow
import { GraphQLList, getNullableType } from 'graphql';

export type MockListFunction<T> = ({ [string]: any }, number) => T;

export class MockList<T: BaseMockPrimitive | QueryMockPrimitive> {
  length: number;
  mockFunction: MockListFunction<T>;

  constructor(length: number, mockFunction?: MockListFunction<T>): void {
    this.length = length;
    // https://stackoverflow.com/questions/54873504/how-to-type-a-generic-function-that-returns-subtypes
    // $FlowFixMe Figure out to parameterize this generic class and default to () => ({})
    this.mockFunction = mockFunction ? mockFunction : () => ({});
  }
}

export function mockList<T: BaseMockPrimitive | QueryMockPrimitive>(
  size: number,
  itemMock?: MockListFunction<T>
) {
  return function() {
    return new MockList<T>(size, itemMock);
  };
}

export function automockLists(parentType, field) {
  const nullableType = getNullableType(field.type);
  if (nullableType instanceof GraphQLList) {
    return mockList(2);
  }
}
