import { getBaseMockForRelayField, mockRelayConnection } from '../mockRelay';
import { mockServer, mockList } from '../mockServer';
import _ from 'lodash';

describe('mockRelayConnection', () => {
  const schemaDefinition = `
    schema {
      query: Query
    }

    type Query {
      objectConnection(argument: String, before: String, after: String, first: Int, last: Int): ObjectConnection
    }

    type ObjectConnection {
      pageInfo: PageInfo!
      edges: [ObjectEdge]
    }

    type ObjectEdge {
      node: Object
      cursor: String!
    }

    type Object implements Node {
      property: String
      id: ID!
    }

    interface Node {
      id: ID!
    }

    type PageInfo {
      hasNextPage: Boolean!
      hasPreviousPage: Boolean!
      startCursor: String
      endCursor: String
    }
  `;

  it('Returns an error when both first and last are set', () => {
    const mocks = {
      Query: {
        objectConnection: mockRelayConnection()
      },
      Object: {
        property: () => 'Object.property'
      }
    };

    // $FlowFixMe It seems to happen because it is the first test of this `describe` block...
    const server = mockServer(
      schemaDefinition,
      mocks,
      getBaseMockForRelayField
    );
    const result = server(`
      query test {
        objectConnection(last: 1, first: 3) {
          edges {
            node {
              property
            }
          }
        }
      }
    `);

    expect(result.errors).toHaveLength(1);
    expect(result.errors && result.errors[0].message).toEqual(
      'Either first xor last should be set.'
    );
    expect(result.errors && result.errors[0].path).toEqual([
      'objectConnection'
    ]);
  });

  it('Returns an error if first or last are negative', () => {
    const mocks = {
      Query: {
        objectConnection: mockRelayConnection()
      },
      Object: {
        property: () => 'Object.property'
      }
    };

    // $FlowFixMe It seems to happen because it is the first test of this `describe` block...
    const server = mockServer(
      schemaDefinition,
      mocks,
      getBaseMockForRelayField
    );
    const result = server(`
      query test {
        objectConnection(first: -2) {
          edges {
            node {
              property
            }
          }
        }
      }
    `);

    expect(result.errors).toHaveLength(1);
    expect(result.errors && result.errors[0].message).toEqual(
      'First and last cannot be negative.'
    );
    expect(result.errors && result.errors[0].path).toEqual([
      'objectConnection'
    ]);
  });

  it('Returns an error when both before and after are set', () => {
    const mocks = {
      Query: {
        objectConnection: mockRelayConnection()
      },
      Object: {
        property: () => 'Object.property'
      }
    };

    // $FlowFixMe It seems to happen because it is the first test of this `describe` block...
    const server = mockServer(
      schemaDefinition,
      mocks,
      getBaseMockForRelayField
    );
    const result = server(`
      query test {
        objectConnection(before: "before", after: "after", first: 1) {
          edges {
            node {
              property
            }
          }
        }
      }
    `);

    expect(result.errors).toHaveLength(1);
    expect(result.errors && result.errors[0].message).toEqual(
      'Before and after cannot be both set.'
    );
    expect(result.errors && result.errors[0].path).toEqual([
      'objectConnection'
    ]);
  });

  it('Returns the right number of items when first or last are set', () => {
    const mocks = {
      Query: {
        objectConnection: mockRelayConnection()
      },
      Object: {
        property: () => 'Object.property'
      }
    };

    const server = mockServer(
      schemaDefinition,
      mocks,
      getBaseMockForRelayField
    );
    const query = `
      query test ($first: Int, $last: Int) {
        objectConnection(first: $first, last: $last) {
          edges {
            node {
              property
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `;

    let result = server(query, { first: 3 });
    expect(_.at(result, 'data.objectConnection.edges')[0]).toHaveLength(3);
    expect(_.at(result, 'data.objectConnection.pageInfo')[0]).toEqual({
      hasNextPage: true,
      hasPreviousPage: false
    });

    result = server(query, { last: 1 });
    expect(_.at(result, 'data.objectConnection.edges')[0]).toHaveLength(1);
    expect(_.at(result, 'data.objectConnection.pageInfo')[0]).toEqual({
      hasNextPage: false,
      hasPreviousPage: true
    });
  });

  it('Returns no more than the maxSize of items', () => {
    const mocks = {
      Query: {
        objectConnection: mockRelayConnection({ maxSize: 2 })
      },
      Object: {
        property: () => 'Object.property'
      }
    };

    const server = mockServer(
      schemaDefinition,
      mocks,
      getBaseMockForRelayField
    );
    const query = `
      query test ($first: Int, $last: Int) {
        objectConnection(first: $first, last: $last) {
          edges {
            node {
              property
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `;

    let result = server(query, { first: 3 });
    expect(result.errors).toBeUndefined();
    expect(_.at(result, 'data.objectConnection.edges')[0]).toHaveLength(2);
    expect(_.at(result, 'data.objectConnection.pageInfo')[0]).toEqual({
      hasNextPage: false,
      hasPreviousPage: false
    });

    result = server(query, { last: 3 });
    expect(result.errors).toBeUndefined();
    expect(_.at(result, 'data.objectConnection.edges')[0]).toHaveLength(2);
    expect(_.at(result, 'data.objectConnection.pageInfo')[0]).toEqual({
      hasNextPage: false,
      hasPreviousPage: false
    });
  });

  it('Allows to specify mocks for the nodes', () => {
    const mocks = {
      Query: {
        objectConnection: mockRelayConnection({
          nodeMock: ({ argument }, index) => ({
            property: `Query.objectConnection.nodeMock.${index}:${argument}`
          })
        })
      },
      Object: {
        property: () => 'Object.property'
      }
    };

    const server = mockServer(
      schemaDefinition,
      mocks,
      getBaseMockForRelayField
    );

    const result = server(`
      query test {
        objectConnection(first: 2, argument: "ARGUMENT") {
          edges {
            node {
              property
            }
          }
        }
      }
    `);

    expect(result).toEqual({
      data: {
        objectConnection: {
          edges: [
            {
              node: { property: 'Query.objectConnection.nodeMock.0:ARGUMENT' }
            },
            {
              node: { property: 'Query.objectConnection.nodeMock.1:ARGUMENT' }
            }
          ]
        }
      }
    });
  });

  it('Is not required to use getBaseMockForRelayField', () => {
    const mocks = {
      Query: {
        objectConnection: mockRelayConnection()
      },
      Object: {
        property: () => 'Object.property'
      },
      // Relay types have to be mocked
      ObjectConnection: {
        edges: mockList(0)
      },
      ObjectEdge: {
        cursor: () => ''
      },
      PageInfo: {
        hasNextPage: () => false,
        endCursor: () => ''
      }
    };

    // $FlowFixMe It seems to happen because it is the first test of this `describe` block...
    const server = mockServer(schemaDefinition, mocks);
    const result = server(`
      query test {
        objectConnection(first: 1) {
          edges {
            node {
              property
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `);

    expect(result.data).toEqual({
      objectConnection: {
        edges: [
          {
            cursor: 'cursor_0',
            node: {
              property: 'Object.property'
            }
          }
        ],
        pageInfo: {
          endCursor: '',
          hasNextPage: true
        }
      }
    });
  });
});
