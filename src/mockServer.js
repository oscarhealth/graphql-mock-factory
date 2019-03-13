// @flow
import { buildSchemaFromTypeDefinitions } from 'graphql-tools';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLUnionType,
  GraphQLInterfaceType,
  GraphQLList,
  getNullableType,
  getNamedType,
  GraphQLNonNull,
  isLeafType,
  isScalarType
} from 'graphql';

import type {
  GraphQLType,
  GraphQLField,
  GraphQLResolveInfo,
  GraphQLNamedType,
  GraphQLFieldResolver
} from 'graphql';

export type FieldArgs = { [string]: any };

export type MockFunction<T> = FieldArgs => T;

export type MockMap = {
  [string]: { [string]: MockFunction<BaseMockPrimitive> }
};

export type BaseMockPrimitive =
  | boolean
  | number
  | string
  | void
  | null
  | Error
  | { [string]: BaseMock }
  | MockList<BaseMockPrimitive>;

export type BaseMock = BaseMockPrimitive | MockFunction<BaseMockPrimitive>;

export type QueryMockPrimitive =
  | BaseMockPrimitive
  | Array<QueryMockPrimitive>
  | { [string]: QueryMock }
  | MockList<QueryMockPrimitive>;

export type QueryMock = QueryMockPrimitive | MockFunction<QueryMockPrimitive>;

export function mockServer(schemaDefinition: string, baseMocks: MockMap) {
  const schema: GraphQLSchema = buildSchemaFromTypeDefinitions(
    schemaDefinition
  );
  validateBaseMocks(baseMocks, schema);

  forEachField(schema, (type, field) => {
    field.resolve = getFieldResolver(type, field, baseMocks);
  });

  return async (query: string, vars: Object = {}, queryMock: Object = {}) => {
    const result = await graphql(schema, query, queryMock, {}, vars);
    throwUnexpectedErrors(result);
    return result;
  };
}

function getFieldResolver(
  type: GraphQLObjectType,
  field: GraphQLField<{ [string]: QueryMockPrimitive }, mixed>,
  baseMocks: MockMap
): GraphQLFieldResolver<{ [string]: QueryMockPrimitive }, mixed> {
  return markUnexpectedErrors((source, args) => {
    const baseMock = getFieldMock(type, field, baseMocks);
    const mergedValue = mergeMocks(baseMock, source[field.name])(args);

    if (mergedValue === undefined) {
      return {};
    }

    if (mergedValue instanceof MockList) {
      const mergedArray = [];
      for (let index = 0; index < mergedValue.length; index++) {
        mergedArray.push(mergedValue.mockFunction(args, index));
      }
      return mergedArray;
    }

    return mergedValue;
  });
}

function getFieldMock(
  type: GraphQLObjectType,
  field: GraphQLField<any, any, any>,
  baseMocks: MockMap
): MockFunction<BaseMockPrimitive> | void {
  let baseMock;
  if (baseMocks[type.name]) {
    baseMock = baseMocks[type.name][field.name];
  }

  if (baseMock) {
    return baseMock;
  }

  const fieldInterfaces = [];
  type.getInterfaces().forEach(parentInterface => {
    if (parentInterface.getFields()[field.name]) {
      fieldInterfaces.push(parentInterface.name);
    }
  });

  if (fieldInterfaces.length > 1) {
    throw Error(
      'More than 1 interface for this field. Define base mock on the type.'
    );
  }

  if (fieldInterfaces.length === 1) {
    if (
      baseMocks[fieldInterfaces[0]] &&
      baseMocks[fieldInterfaces[0]][field.name]
    ) {
      return baseMocks[fieldInterfaces[0]][field.name];
    }
  }

  if (isLeafType(getNamedType(field.type))) {
    throw Error(
      `There is no base mock for '${type.name}.${field.name}'. ` +
        `All queried fields must have a base mock.`
    );
  }
}

function mergeMocks(baseMock: BaseMock, overrideMock: QueryMock) {
  return function(...args: Array<mixed>) {
    let overrideMockValue =
      typeof overrideMock === 'function'
        ? // $FlowFixMe
          overrideMock(...args)
        : overrideMock;

    if (
      overrideMockValue === null ||
      typeof overrideMockValue === 'string' ||
      typeof overrideMockValue === 'boolean' ||
      typeof overrideMockValue === 'number' ||
      overrideMockValue instanceof Error
    ) {
      return overrideMockValue;
    }

    let baseMockValue =
      typeof baseMock === 'function'
        ? // $FlowFixMe
          baseMock(...args)
        : baseMock;

    if (Array.isArray(baseMockValue)) {
      throw Error('baseMocks must not return arrays or nested arrays.');
    }

    if (baseMockValue === null) {
      return null;
    }

    if (
      overrideMockValue === undefined &&
      (typeof baseMockValue === 'string' ||
        typeof baseMockValue === 'boolean' ||
        typeof baseMockValue === 'number' ||
        baseMockValue instanceof Error)
    ) {
      return baseMockValue;
    }

    if (
      typeof baseMockValue === 'string' ||
      typeof baseMockValue === 'boolean' ||
      typeof baseMockValue === 'number'
    ) {
      // TODO Should never happen
      throw Error('better error 2');
    }

    if (baseMockValue === undefined || baseMockValue === null) {
      return overrideMockValue;
    }

    if (baseMockValue instanceof MockList) {
      // TODO Find a way to fully enforce that only the query override can contain an array
      const baseMockList = baseMockValue;
      let overrideMockList = overrideMockValue;

      if (
        overrideMockList !== undefined &&
        !(overrideMockList instanceof MockList) &&
        !Array.isArray(overrideMockList)
      ) {
        throw Error('better error 1');
      }

      if (Array.isArray(overrideMockList)) {
        const overrideArray = overrideMockList;

        overrideMockList = new MockList(
          overrideArray.length,
          ({}, index) => overrideArray[index]
        );
      }

      if (overrideMockList === undefined) {
        overrideMockList = new MockList(baseMockValue.length);
      }

      const overrideMockListFunction = overrideMockList.mockFunction;
      const baseMockListFunction = baseMockList.mockFunction;

      return new MockList(overrideMockList.length, (args, index) => {
        return mergeMocks(baseMockListFunction, overrideMockListFunction)(
          args,
          index
        );
      });
    }

    if (
      overrideMockValue instanceof MockList ||
      Array.isArray(overrideMockValue)
    ) {
      // TODO Add test and better message
      throw Error('Not the same type');
    }

    if (baseMockValue instanceof Error) {
      if (overrideMockValue === undefined) {
        return baseMockValue;
      } else {
        baseMockValue = {};
      }
    }

    if (!overrideMockValue) {
      overrideMockValue = {};
    }

    const mergedMockObject = {};
    const mergedObjectObjectKeys = Object.keys(overrideMockValue).concat(
      Object.keys(baseMockValue)
    );
    const overrideMockValueCopy = overrideMockValue;
    const baseMockValueCopy = baseMockValue;
    mergedObjectObjectKeys.forEach(key => {
      mergedMockObject[key] = (...mergedMockArgs) => {
        return mergeMocks(baseMockValueCopy[key], overrideMockValueCopy[key])(
          ...mergedMockArgs
        );
      };
    });

    return mergedMockObject;
  };
}

type MockListFunction<T> = ({ [string]: any }, number) => T;

class MockList<T: BaseMockPrimitive | QueryMockPrimitive> {
  length: number;
  mockFunction: MockListFunction<T>;

  constructor(length: number, mockFunction?: MockListFunction<T>): void {
    this.length = length;
    if (!mockFunction) return;

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

// Input Validation

function validateBaseMocks(baseMocks: MockMap, schema: GraphQLSchema) {
  const typeMap = schema.getTypeMap();

  Object.keys(baseMocks).forEach(typeName => {
    if (!typeMap[typeName]) {
      throw Error(`baseMocks['${typeName}'] is not defined in schema.`);
    }

    if (
      !(
        typeMap[typeName] instanceof GraphQLInterfaceType ||
        typeMap[typeName] instanceof GraphQLObjectType
      )
    ) {
      throw Error('baseMock can only define field mocks on Type or Interface.');
    }

    if (typeof baseMocks[typeName] !== 'object') {
      throw Error('baseMocks should be an object of object of functions.');
    }

    const isInterface = typeMap[typeName] instanceof GraphQLInterfaceType;

    const fields = typeMap[typeName].getFields();

    Object.keys(baseMocks[typeName]).forEach(fieldName => {
      if (!fields[fieldName]) {
        throw Error(
          `baseMocks['${typeName}']['${fieldName}'] is not defined in schema.`
        );
      }

      if (typeof baseMocks[typeName][fieldName] !== 'function') {
        throw Error('baseMocks should be an object of object of functions.');
      }

      if (isInterface && !isLeafType(getNullableType(fields[fieldName].type))) {
        throw Error(
          'It is not allowed to define mocks for non-leaf fields on interfaces.'
        );
      }
    });
  });
}

// Error Utils

function markUnexpectedErrors(
  fieldResolver: GraphQLFieldResolver<{ [string]: QueryMockPrimitive }, mixed>
) {
  return function(...args) {
    try {
      return fieldResolver(...args);
    } catch (error) {
      throw new MockError(error);
    }
  };
}

class MockError extends Error {}

function throwUnexpectedErrors(result) {
  if (!result.errors) {
    return;
  }

  result.errors.forEach(error => {
    if (error.originalError instanceof MockError) {
      throw error.originalError;
    }
  });
}

// Relay Utils

type RelayConnactionParams = {
  before: ?string,
  after: ?string,
  first: ?number,
  last: ?number
};

type RelayConnectionMockParams = {
  maxSize?: number,
  nodeMock?: (FieldArgs, number) => {}
};

// TODO Add better types
// https://stackoverflow.com/questions/54873504/how-to-type-a-generic-function-that-returns-subtypes
export function mockRelayConnection(
  params: ?RelayConnectionMockParams
): RelayConnactionParams => mixed {
  return (relayConnectionArgs: RelayConnactionParams) => {
    const { before, after, first, last } = relayConnectionArgs;
    const maxSize = params && params.maxSize;
    const nodeMockFunction = params && params.nodeMock;

    if (!isEmptyString(before) && !isEmptyString(after)) {
      return getRelayConnectionError('Before and after cannot be both set');
    }

    if ((first != null && last != null) || (first == null && last == null)) {
      return getRelayConnectionError('Either first xor last should be set');
    }

    if ((first != null && first < 0) || (last != null && last < 0)) {
      return getRelayConnectionError('First and last cannot be negative');
    }

    const isForwardPagination = first != null;
    // $FlowFixMe
    const requestedPageSize: number = first != null ? first : last;

    const pageSize =
      maxSize && requestedPageSize > maxSize ? maxSize : requestedPageSize;

    const hasMorePages = maxSize != null ? pageSize < maxSize : true;

    return {
      edges: new MockList(pageSize, ({}, index) => ({
        node: nodeMockFunction
          ? nodeMockFunction(relayConnectionArgs, index)
          : undefined,
        cursor: `cursor_${index}`
      })),
      pageInfo: {
        hasNextPage: isForwardPagination ? hasMorePages : false,
        hasPreviousPage: isForwardPagination ? false : hasMorePages
      }
    };
  };
}

const getRelayConnectionError = (errorMessage: string): BaseMockPrimitive => ({
  edges: new MockList(1, () => ({
    node: Error(errorMessage),
    cursor: Error(errorMessage)
  })),
  pageInfo: {
    hasNextPage: Error(errorMessage),
    hasPreviousPage: Error(errorMessage)
  }
});

function isEmptyString(string: ?string) {
  return !string || string.length === 0;
}

// Schema utils

function forEachField(schema: GraphQLSchema, callback) {
  const typeMap = schema.getTypeMap();
  Object.keys(typeMap).forEach(typeName => {
    const type = typeMap[typeName];

    if (
      getNamedType(type).name.startsWith('__') ||
      !(type instanceof GraphQLObjectType)
    ) {
      return;
    }

    const fields = type.getFields();
    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName];
      callback(type, field);
    });
  });
}
