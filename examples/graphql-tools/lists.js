import {
  makeExecutableSchema,
  addMockFunctionsToSchema,
  MockList
} from 'graphql-tools';
import { graphql } from 'graphql';

const schemaString = `
  type Query {
    userById(id: String): User
    userByName(name: String): User
  }

  type User {
    name: String
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
    User: (_root, { id, name }) => ({
      name: () => (!!id ? `User ${id}` : `User ${name}`)
    })
  }
});

graphql(
  schema,
  `
    query {
      userById(id: "ID") {
        name
      }
      userByName(name: "Name") {
        name
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
