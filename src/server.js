// @flow
import {
  addResolveFunctionsToSchema,
  buildSchemaFromTypeDefinitions
} from 'graphql-tools';
import {
  graphqlSync,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLList,
  getNullableType,
  getNamedType,
  isLeafType
} from 'graphql';
import type {
  GraphQLInt,
  GraphQLType,
  GraphQLField,
  GraphQLResolveInfo,
  GraphQLNamedType,
  GraphQLFieldResolver,
  GraphQLOutputType
} from 'graphql';
import { defaultAutomocks } from './automock';
import { MockList } from './list';

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

export function mockServer(
  schemaDefinition: string,
  mocks: MockMap = {},
  automocks = defaultAutomocks
) {
  const schema: GraphQLSchema = buildSchemaFromTypeDefinitions(
    schemaDefinition
  );

  if (automocks) {
    addAutomocks(schema, mocks, automocks);
  }

  validateMocks(mocks, schema);

  forEachField(schema, (type, field) => {
    field.resolve = getFieldResolver(type, field, mocks);
  });

  forEachInterfaceOrUnion(schema, interfaceOrUnionType => {
    interfaceOrUnionType.resolveType = interfaceOrUnionResolveType;
  });

  return (query: string, variables: Object = {}, mockOverride: Object = {}) => {
    const result = graphqlSync(
      schema,
      query,
      // TODO Rename to mockOverride
      { queryMock: mockOverride },
      {},
      variables
    );
    throwUnexpectedErrors(result);
    return result;
  };
}

function addAutomocks(schema, mocks, getMocks) {
  forEachField(schema, (parentType, field) => {
    if (mocks[parentType.name] && mocks[parentType.name][field.name]) {
      return;
    }

    for (let getMock of getMocks) {
      const baseMock = getMock(parentType, field, getMocks);
      if (baseMock) {
        mocks[parentType.name] = mocks[parentType.name] || {};
        mocks[parentType.name][field.name] = baseMock;
        return;
      }
    }
  });
}

/**
 * In order to resolve interface field, we curretly require users
 * to specify the type to resolve to via `__typename` in `queryMock`.
 *
 * Future work:
 * We may want to remove that requirement so queries can always resolve
 * succesfully without having to specify a `queryMock`.
 * Here are some ideas:
 * - Have this function pick randomly a valid type
 * - Have this function look at the query fragment and pick the most likely type
 * - Have this function look at the query fragment, pick its type if there is only one,
 *   otherwise throw a helpful validation error.
 * - Have this function be customizable via MockMap / baseMock
 * - Have this function be customizable via autoMock
 */
const interfaceOrUnionResolveType = markUnexpectedErrors(source => {
  if (!source.queryMock || !source.queryMock.__typename) {
    throw Error('queryMock must specify type for interface or union fields.');
  }
  return source.queryMock.__typename;
});

type Root = {|
  queryMock: any,
  parentMock: any
|};

function getFieldResolver(
  type: GraphQLObjectType,
  field: GraphQLField<mixed, mixed>,
  mocks: MockMap
): GraphQLFieldResolver<{ [string]: QueryMockPrimitive }, mixed> {
  return markUnexpectedErrors((source, args, context, info) => {
    const baseMock = getFieldMock(type, field, mocks);
    const parentMock = source.parentMock && source.parentMock[field.name];

    const mergedBaseMocks = mergeBaseMocks(baseMock, parentMock, field.type, {
      parentType: type,
      field: field,
      path: undefined
    });
    const mergedBaseMocksValue = mergedBaseMocks(args);

    // TODO check this
    const fieldName =
      typeof info.path.key === 'string' ? info.path.key : field.name;
    const queryMockValue = source.queryMock
      ? getMockValue(source.queryMock[fieldName], args)
      : undefined;

    if (!(getNullableType(field.type) instanceof GraphQLList)) {
      // TODO remove args?
      return mergeMockValues(mergedBaseMocksValue, queryMockValue, field);
    }

    if (queryMockValue === null || queryMockValue instanceof Error) {
      return queryMockValue;
    }

    const mergedArray = [];
    let queryMockList = queryMockValue;

    if (Array.isArray(queryMockList)) {
      const queryMockArray = queryMockList;
      queryMockList = new MockList(
        queryMockArray.length,
        ({}, index) => queryMockArray[index]
      );
    }

    if (queryMockValue === undefined) {
      queryMockList = new MockList(mergedBaseMocksValue.length, () => {});
    }

    for (let index = 0; index < queryMockList.length; index++) {
      const mockListItemValue = mergedBaseMocksValue.mockFunction(args, index);
      const queryMockListItemValue = queryMockList.mockFunction(args, index);
      mergedArray.push(
        mergeMockValues(mockListItemValue, queryMockListItemValue, field)
      );
    }
    return mergedArray;
  });
}

function mergeMockValues(baseMockValue, queryMockValue, field) {
  if (queryMockValue === null) {
    return null;
  }

  if (queryMockValue === undefined && baseMockValue instanceof Error) {
    return baseMockValue;
  }

  if (isLeafType(getNamedType(field.type))) {
    if (queryMockValue === undefined) {
      return baseMockValue;
    }

    return queryMockValue;
  }

  return {
    queryMock: queryMockValue,
    parentMock: baseMockValue
  };
}

type FieldPath = {|
  +prev: FieldPath | void,
  +key: string | number
|};

type BaseMockInfo = {|
  +field: GraphQLField<mixed, mixed>,
  +parentType: GraphQLObjectType,
  +path: FieldPath | void
|};

function mergeBaseMocks(
  baseMock: BaseMock,
  overrideMock: QueryMockPrimitive,
  graphQLType: GraphQLOutputType,
  baseMockInfo: BaseMockInfo
) {
  return function(...args: Array<mixed>) {
    let baseMockValue = getBaseMockValue(
      graphQLType,
      baseMockInfo,
      baseMock,
      ...args
    );

    let overrideMockValue = getMockValue(overrideMock, ...args);
    const nullableType = getNullableType(graphQLType);

    if (
      overrideMockValue === null ||
      overrideMockValue instanceof Error ||
      (isLeafType(nullableType) && overrideMockValue !== undefined)
    ) {
      return overrideMockValue;
    }

    if (overrideMockValue === undefined && isLeafType(nullableType)) {
      return baseMockValue;
    }

    if (overrideMockValue === undefined && baseMockValue instanceof Error) {
      return baseMockValue;
    }

    if (baseMockValue === undefined) {
      return overrideMockValue;
    }

    if (nullableType instanceof GraphQLList) {
      if (overrideMockValue === undefined) {
        overrideMockValue = new MockList(baseMockValue.length);
      }

      const baseMockList = baseMockValue;
      let overrideMockList = overrideMockValue;

      const overrideMockListFunction = overrideMockList.mockFunction;
      const baseMockListFunction = baseMockList.mockFunction;

      return new MockList(overrideMockList.length, (args, index) => {
        const graphQLItemType = getNamedType(graphQLType);
        return mergeBaseMocks(
          baseMockListFunction,
          overrideMockListFunction,
          graphQLItemType,
          {
            ...baseMockInfo,
            path: {
              prev: baseMockInfo.path,
              key: `${index}`
            }
          }
        )(args, index);
      });
    }

    // (nullableType instanceof GraphQLObjectType) === true

    if (overrideMockValue === undefined) {
      overrideMockValue = {};
    }
    const mergedMockObject = {};
    const mergedObjectObjectKeys = new Set(
      Object.keys(overrideMockValue).concat(Object.keys(baseMockValue))
    );
    const overrideMockValueCopy = overrideMockValue;
    const baseMockValueCopy = baseMockValue;

    mergedObjectObjectKeys.forEach(nestedFieldName => {
      const nestedField = nullableType.getFields()[nestedFieldName];

      mergedMockObject[nestedFieldName] = (...mergedMockArgs) => {
        return mergeBaseMocks(
          baseMockValueCopy[nestedFieldName],
          overrideMockValueCopy[nestedFieldName],
          nestedField.type,
          {
            ...baseMockInfo,
            path: {
              prev: baseMockInfo.path,
              key: nestedFieldName
            }
          }
        )(...mergedMockArgs);
      };
    });

    return mergedMockObject;
  };
}

// TODO Rename to getMockValue
// TODO Add path to the mock. Currently, we only show the Parent name,
// the field name, and the path inside the merged
function getBaseMockValue(
  graphQLType,
  baseMockInfo: BaseMockInfo,
  baseMock,
  ...baseMockArgs
) {
  const nullableType = getNullableType(graphQLType);
  const path = baseMockInfo.path;

  let baseMockValue;
  try {
    baseMockValue = getMockValue(baseMock, ...baseMockArgs);
  } catch (err) {
    throw Error(
      `Base mock for \'${getFieldName(baseMockInfo)}\' ` +
        `threw an error for path '${getFullPath(path)}'.\n` +
        `Base mocks are not allowed to throw errors. ` +
        `In the rare case you actually want a base mock to return a GraphQL error, ` +
        `have the base mock return an Error() instead of throwing one.\n` +
        `Original error:\n${err}`
    );
  }

  if (
    baseMockValue === undefined &&
    (nullableType instanceof GraphQLObjectType ||
      nullableType instanceof GraphQLInterfaceType ||
      nullableType instanceof GraphQLUnionType)
  ) {
    return baseMockValue;
  }

  if (baseMockValue instanceof Error) {
    return baseMockValue;
  }

  if (baseMockValue instanceof Promise) {
    throw Error(
      `Base mock for \'${getFieldName(baseMockInfo)}\' ` +
        `returned a promise for path '${getFullPath(path)}'.\n` +
        `Mock functions must be synchronous.`
    );
  }

  if (baseMockValue === undefined) {
    if (baseMockInfo.path) {
      return baseMockValue;
    } else {
      throw Error(
        `Base mock for \'${getFieldName(baseMockInfo)}\' ` +
          `returned 'undefined'.\n` +
          `Base mocks are not allowed to return 'undefined'. ` +
          `Return a value compatible with type '${nullableType.name}'.`
      );
    }
  }

  if (baseMockValue === null) {
    throw Error(
      `Base mock for \'${getFieldName(baseMockInfo)}\' ` +
        `returned 'null' for path '${getFullPath(path)}'.\n` +
        `Base mocks are not allowed to return 'null'. ` +
        `Use 'mockOverride' to specify 'null' values instead.`
    );
  }

  if (isLeafType(nullableType)) {
    try {
      nullableType.serialize(baseMockValue);
    } catch (err) {
      throw Error(
        `Base mock for \'${getFieldName(baseMockInfo)}\' ` +
          `returned an invalid value for path '${getFullPath(path)}'.\n` +
          `Value '${baseMockValue}' is incompatible with type '${
            nullableType.name
          }'.`
      );
    }
  }

  if (nullableType instanceof GraphQLObjectType) {
    if (typeof baseMockValue !== 'object') {
      throw Error(
        `Base mock for \'${getFieldName(baseMockInfo)}\' ` +
          `did not return an object for path '${getFullPath(path)}'.\n` +
          `Value '${baseMockValue}' is incompatible with type '${
            nullableType.name
          }'.`
      );
    }

    const fieldNames = nullableType.getFields();
    Object.keys(baseMockValue).forEach(key => {
      if (!fieldNames[key]) {
        const nestedFullPath = getFullPath({ key, prev: baseMockInfo.path });
        throw Error(
          `Base mock for \'${getFieldName(baseMockInfo)}\' ` +
            `returns a value for field path \'${nestedFullPath}\' that does not exist. ` +
            'Base mocks should return values only for valid fields.'
        );
      }
    });
  }

  if (
    nullableType instanceof GraphQLList &&
    !(baseMockValue instanceof MockList) &&
    !baseMockInfo.path
  ) {
    throw Error(
      `Base mock for \'${getFieldName(baseMockInfo)}\' ` +
        `did not return a MockList for path '${getFullPath(path)}'.\n` +
        `Use 'mockList' function to mock lists in base mocks.`
    );
  }

  return baseMockValue;
}

function getFullPath(fieldPath: FieldPath) {
  const allPaths = [];

  let currentPath = fieldPath;
  while (currentPath) {
    allPaths.push(currentPath.key);
    currentPath = currentPath.prev;
  }

  allPaths.reverse();
  return allPaths.join('.');
}

function getFieldName(baseMockInfo) {
  return `${baseMockInfo.parentType.name}.${baseMockInfo.field.name}`;
}

function getMockValue(mock, ...args) {
  return typeof mock === 'function' ? mock(...args) : mock;
}

function getFieldMock(
  type: GraphQLObjectType,
  field: GraphQLField<any, any, any>,
  mocks: MockMap
): MockFunction<BaseMockPrimitive> | void {
  let baseMock;
  if (mocks[type.name]) {
    baseMock = mocks[type.name][field.name];
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
    if (mocks[fieldInterfaces[0]] && mocks[fieldInterfaces[0]][field.name]) {
      return mocks[fieldInterfaces[0]][field.name];
    }
  }

  if (getNullableType(field.type) instanceof GraphQLList) {
    throw Error(
      `There is no base mock for '${type.name}.${field.name}'. ` +
        `All queried list fields must have a base mock defined using mockList.`
    );
  }

  if (isLeafType(getNamedType(field.type))) {
    throw Error(
      `There is no base mock for '${type.name}.${field.name}'. ` +
        `All queried fields must have a base mock.`
    );
  }
}

// Input Validation

function validateMocks(mocks: MockMap, schema: GraphQLSchema) {
  const typeMap = schema.getTypeMap();

  Object.keys(mocks).forEach(typeName => {
    if (!typeMap[typeName]) {
      throw Error(`mocks['${typeName}'] is not defined in schema.`);
    }

    if (
      !(
        typeMap[typeName] instanceof GraphQLInterfaceType ||
        typeMap[typeName] instanceof GraphQLObjectType ||
        typeMap[typeName] instanceof GraphQLUnionType
      )
    ) {
      throw Error(
        'baseMock can only define field mocks on Type or Interface or Union.'
      );
    }

    if (typeof mocks[typeName] !== 'object') {
      throw Error('mocks should be an object of object of functions.');
    }

    const isInterfaceOrUnion =
      typeMap[typeName] instanceof GraphQLInterfaceType ||
      typeMap[typeName] instanceof GraphQLUnionType;

    const fields = typeMap[typeName].getFields();

    Object.keys(mocks[typeName]).forEach(fieldName => {
      if (!fields[fieldName]) {
        throw Error(
          `mocks['${typeName}']['${fieldName}'] is not defined in schema.`
        );
      }

      if (typeof mocks[typeName][fieldName] !== 'function') {
        // TODO Add better validation message
        throw Error('mocks should be an object of object of functions.');
      }

      if (
        isInterfaceOrUnion &&
        !isLeafType(getNullableType(fields[fieldName].type))
      ) {
        // TODO Add better validation message
        throw Error(
          'It is not allowed to define mocks for non-leaf fields on interfaces or unions.'
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
      error.throwError = true;
      throw error;
    }
  };
}

function throwUnexpectedErrors(result) {
  if (!result.errors) {
    return;
  }

  result.errors.forEach(error => {
    if (error.originalError && error.originalError.throwError) {
      throw error.originalError;
    }
  });
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

function forEachInterfaceOrUnion(schema: GraphQLSchema, callback) {
  const typeMap = schema.getTypeMap();
  Object.keys(typeMap).forEach(typeName => {
    const type = typeMap[typeName];

    if (
      getNamedType(type).name.startsWith('__') ||
      !(
        type instanceof GraphQLInterfaceType || type instanceof GraphQLUnionType
      )
    ) {
      return;
    }

    callback(type);
  });
}
