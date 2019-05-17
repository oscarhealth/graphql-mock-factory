import { mockList, mockServer } from '../src';
import faker from 'faker/locale/en';

// Replace with your schema definition
const schemaString = `
  type Query {
    viewer: User
  }

  type User {
    name: String
    friends: [User]
  }
`;

const mocks = {
  User: {
    name: () => faker.name.firstName(),
    friends: mockList(2)
  }
};

const mockedServer = mockServer(schemaString, mocks);

const query = `
  query {
    viewer {
      name
      friends {
        name
      }
    }
  }
`;

function log(object) {
  console.dir(object, { depth: null });
}

log(mockedServer(query));
// { data:
//   { viewer:
//      { name: 'Jaron',
//        friends: [ { name: 'Delfina' }, { name: 'Gayle' } ] } } }

// Customize value

log(
  mockedServer(
    query,
    {},
    {
      viewer: {
        name: 'Oscar'
      }
    }
  )
);
// { data:
//   { viewer:
//      { name: 'Oscar',
//        friends: [ { name: 'Ryann' }, { name: 'Molly' } ] } } }

// Customize lists

log(
  mockedServer(
    query,
    {},
    {
      viewer: {
        name: Error('Could not fetch error'),
        friends: [{ name: 'Oscar' }]
      }
    }
  )
);
// { data: { viewer: { name: 'Simon', friends: [ { name: 'Oscar' } ] } } }

log(
  mockedServer(
    query,
    {},
    {
      viewer: {
        friends: [{}, {}, { name: 'Oscar' }]
      }
    }
  )
);
// { data:
//   { viewer:
//      { name: 'Angel',
//        friends: [ { name: 'Derick' }, { name: 'Millie' }, { name: 'Oscar' } ] } } }
