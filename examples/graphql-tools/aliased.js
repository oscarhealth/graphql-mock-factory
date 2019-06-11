import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import { graphql } from 'graphql';
import mergeResolvers from './mergeResolvers';

const schemaString = `
  type Query {
    user(id: String): User
  }

  type User {
    name: String
    kname: String
    friends(count: Int): [User]
  }
`;

function getSchema() {
  return makeExecutableSchema({ typeDefs: schemaString });
}

function log(object) {
  console.dir(object, { depth: null });
}

// Simple example with aliased fields in Query mock

let schema = getSchema();

addMockFunctionsToSchema({
  schema,
  mocks: {
    Query: () => ({
      user1: () => ({
        name: 'User 1'
      }),
      user2: () => ({
        name: 'User 2'
      })
    })
  }
});

graphql(
  schema,
  `
    query {
      user1: user(id: "1") {
        name
      }
      user2: user(id: "2") {
        name
      }
    }
  `,
  {}
).then(result => log(result));
// ->
// { data:
//   { user1: { name1: 'Hello World' },
//     user2: { name2: 'Hello World' } } }
