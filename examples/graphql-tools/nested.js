import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import { graphql } from 'graphql';

const schemaString = `
  type Query {
    viewer: User
  }

  type User {
    home: Address
  }

  type Address {
    address1: String
    address2: String
  }
`;

function getSchema() {
  return makeExecutableSchema({ typeDefs: schemaString });
}

function log(object) {
  console.dir(object, { depth: null });
}

// Example with nested mocks

let schema = getSchema();

addMockFunctionsToSchema({
  schema,
  mocks: {
    Query: () => ({
      viewer: () => ({
        name: 'Query.user.name',
        home: {
          address1: 'Query.user.home.address1'
        }
      })
    }),
    User: () => ({
      home: {
        address2: 'User.home.address2'
      }
    })
  }
});

graphql(
  schema,
  `
    query {
      viewer {
        home {
          address1
          address2
        }
      }
    }
  `
).then(result => log(result));
// ->
// { data:
//   { viewer:
//      { home:
//         { address1: 'Query.user.home.address1',
//           address2: 'Hello World' } } } }
