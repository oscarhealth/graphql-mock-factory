// @flow
import { GraphQLList, getNullableType, GraphQLObjectType } from 'graphql';

export type MockListFunction<T> = ({ [string]: any }, number) => T;

export class MockList<T: BaseMockPrimitive | QueryMockPrimitive> {
  length: number;
  mockFunction: MockListFunction<T>;

  constructor(length: number, mockFunction?: MockListFunction<T>): void {
    this.length = length;
    // https://stackoverflow.com/questions/54873504/how-to-type-a-generic-function-that-returns-subtypes
    // $FlowFixMe Figure out to parameterize this generic class and default to () => {}
    this.mockFunction = mockFunction ? mockFunction : () => {};
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

export function automockLists(parentType, field, getMocks) {
  const nullableType = getNullableType(field.type);

  if (!(nullableType instanceof GraphQLList)) {
    return;
  }

  const nullableOfType = getNullableType(nullableType.ofType);

  if (nullableOfType instanceof GraphQLObjectType) {
    return mockList(2);
  }

  // Little hack so we can call the user-provided automocks.
  // It's not worth making the automock interface more complex just so
  // automock recursive list of scalars.
  const wrapperField = Object.assign({}, field);
  wrapperField.name += '_listOf';
  wrapperField.type = nullableOfType;

  let mock;
  for (let getMock of getMocks) {
    mock = getMock(parentType, wrapperField, getMocks);
    if (mock) {
      break;
    }
  }

  return mockList(2, mock);
}
