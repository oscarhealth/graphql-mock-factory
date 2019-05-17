import {
  mockList,
  mockServer,
  mockConnection,
  getBaseMockForRelayField
} from '../src';
import faker from 'faker/locale/en';

const schemaString = `
  type Query {
    viewer: User
  }

  type User implements Node {
    id: ID!
    name: String
    friends(before: String, after: String, first: Int, last: Int): UserConnection
  }

  type UserConnection {
    pageInfo: PageInfo!
    edges: [UserEdge]
  }

  type UserEdge {
    node: User
    cursor: String!
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

const mocks = {
  User: {
    friends: mockConnection(),
    // friends: mockConnection({nodeMock: ({ first, last }, index) => ({
    //   name: `Friend ${index} / ${first || last}`,
    // })}),
    name: () => faker.name.firstName()
  }
};

function log(object) {
  console.dir(object, { depth: null });
}

const mockedServer = mockServer(
  schemaString,
  mocks,
  // Provides dummy mock function for un-essential Relay fields
  getBaseMockForRelayField
);

log(
  mockedServer(
    `
  query {
    viewer {
      friends(first: 5) {
        edges {
          node {
            name
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }
  }`,
    {},
    {
      viewer: {
        friends: {
          edges: [{}, { node: { name: 'Oscar' } }, null],
          pageInfo: {
            hasNextPage: false
          }
        }
      }
    }
  )
);
