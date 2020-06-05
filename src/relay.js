// @flow
import { getUUID } from './random';
import { mockList } from './list';
import { GraphQLObjectType } from 'graphql';

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
export function mockConnection(
  params: ?RelayConnectionMockParams
): RelayConnactionParams => mixed {
  return (relayConnectionArgs: RelayConnactionParams) => {
    const { before, after, first, last } = relayConnectionArgs;
    const maxSize = params && params.maxSize;
    const nodeMockFunction = params && params.nodeMock;

    if ((first != null && last != null) || (first == null && last == null)) {
      return Error('Either first xor last should be set.');
    }

    if ((first != null && first < 0) || (last != null && last < 0)) {
      return Error('First and last cannot be negative.');
    }

    if (!isEmptyString(before) && !isEmptyString(after)) {
      return Error('Before and after cannot be both set.');
    }

    const isForwardPagination = first != null;
    // $FlowFixMe
    const requestedPageSize: number = first != null ? first : last;

    const pageSize =
      maxSize && requestedPageSize > maxSize ? maxSize : requestedPageSize;

    const hasMorePages = maxSize != null ? pageSize < maxSize : true;

    return {
      edges: mockList(pageSize, ({}, index) => ({
        node: nodeMockFunction
          ? nodeMockFunction(relayConnectionArgs, index)
          : undefined,
        cursor: `cursor_${index}`
      })),
      pageInfo: {
        hasNextPage: isForwardPagination ? hasMorePages : false,
        hasPreviousPage: isForwardPagination ? false : hasMorePages,
        startCursor: pageSize > 0 ? 'cursor_0' : null,
        endCursor: pageSize > 0 ? `cursor_${pageSize - 1}` : null
      }
    };
  };
}

function isEmptyString(string: ?string) {
  return !string || string.length === 0;
}

export function automockRelay(parentType, field) {
  if (isRelayConnectionType(field.type)) {
    return mockConnection();
  }

  if (isRelayNode(parentType)) {
    if (field.name === 'id') {
      return () => getUUID();
    }
  }

  // Add dummy mocks for Relay all fields even though
  // they are populated by `mockConnection` so there is
  // no dependency on `defaultAutomocks`.

  if (isRelayConnectionType(parentType)) {
    if (field.name === 'edges') {
      return mockList(0);
    }
  }

  if (isRelayEdgeType(parentType)) {
    if (field.name === 'cursor') {
      return () => '';
    }
  }

  if (isRelayPageInfoType(parentType)) {
    if (field.name === 'hasNextPage' || field.name === 'hasPreviousPage') {
      return () => false;
    }

    if (field.name === 'startCursor' || field.name === 'endCursor') {
      return () => '';
    }
  }
}

function isRelayConnectionType(graphQLtype) {
  if (!(graphQLtype instanceof GraphQLObjectType)) {
    return false;
  }

  const fields = graphQLtype.getFields();
  return (
    graphQLtype.name.endsWith('Connection') &&
    graphQLtype.name.length > 10 &&
    fields.edges &&
    fields.pageInfo
  );
}

function isRelayEdgeType(graphQLtype) {
  if (!(graphQLtype instanceof GraphQLObjectType)) {
    return false;
  }

  const fields = graphQLtype.getFields();
  return (
    graphQLtype.name.endsWith('Edge') &&
    graphQLtype.name.length > 4 &&
    fields.node &&
    fields.cursor
  );
}

function isRelayPageInfoType(graphQLtype) {
  if (!(graphQLtype instanceof GraphQLObjectType)) {
    return false;
  }

  const fields = graphQLtype.getFields();
  return (
    graphQLtype.name === 'PageInfo' &&
    fields.hasNextPage &&
    fields.hasPreviousPage
  );
}

function isRelayNode(graphQLtype) {
  if (!(graphQLtype instanceof GraphQLObjectType)) {
    return false;
  }

  return graphQLtype
    .getInterfaces()
    .some(graphQLinterface => graphQLinterface.name === 'Node');
}
