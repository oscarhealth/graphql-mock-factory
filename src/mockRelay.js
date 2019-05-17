// @flow
import { mockList } from './mockServer';

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
// TODO Support startCursor and endCursor
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
        hasPreviousPage: isForwardPagination ? false : hasMorePages
      }
    };
  };
}

function isEmptyString(string: ?string) {
  return !string || string.length === 0;
}

// TODO
// - Add base mock for Node.id
export function getBaseMockForRelayField(parentType, field) {
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
  const fields = graphQLtype.getFields();
  return (
    graphQLtype.name.endsWith('Connection') &&
    graphQLtype.name.length > 10 &&
    fields.edges &&
    fields.pageInfo
  );
}

function isRelayEdgeType(graphQLtype) {
  const fields = graphQLtype.getFields();
  return (
    graphQLtype.name.endsWith('Edge') &&
    graphQLtype.name.length > 4 &&
    fields.node &&
    fields.cursor
  );
}

function isRelayPageInfoType(graphQLtype) {
  const fields = graphQLtype.getFields();
  return (
    graphQLtype.name === 'PageInfo' &&
    fields.hasNextPage &&
    fields.hasPreviousPage
  );
}
