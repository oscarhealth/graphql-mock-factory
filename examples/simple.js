import { mockServer } from '../src'; // Replace with 'graphql-mock-factory'

// Replace with your schema definition
const schemaString = `
  type Query {
    quoteOfTheDay: String
    randomNumber: Float
    viewer: User

  }

  type User {
    name:
    friends: [User]
  }
`;

const mocks = {
  Query: {
    quoteOfTheDay: () =>
      Math.random() < 0.5 ? 'Take it easy' : 'Salvation lies within',
    randomNumber: () => Math.random()
  }
};

const mockedServer = mockServer(schemaString, mocks);

const query = `
  query {
    quoteOfTheDay
    randomNumber
  }
`;

console.log(mockedServer(query));
// Prints
// { data:
//   { quoteOfTheDay: 'Take it easy',
//     randomNumber: 0.06672085791181193 } }

// Specify `quoteOfTheDay`
console.log(
  mockedServer(
    query,
    {},
    {
      quoteOfTheDay: 'Simplicity is the ultimate sophistication'
    }
  )
);
// Prints
// { data:
//   { quoteOfTheDay: 'Simplicity is the ultimate sophistication',
//     randomNumber: 0.36905521158019394 } }

// Specify `randomNumber`
console.log(
  mockedServer(
    query,
    {},
    {
      randomNumber: 0
    }
  )
);
// Prints
// { data:
//   { quoteOfTheDay: 'Salvation lies within',
//     randomNumber: 0 } }
