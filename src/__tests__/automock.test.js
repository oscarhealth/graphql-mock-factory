// @flow
import { mockServer, mockList } from '../index';

describe('getDefautMock', () => {
  const schemaDefinition = `
    schema {
      query: Query
    }

    type Query {
      boolean: Boolean
      enum: Enum
      id: ID
      int: Int
      float: Float
      string: String
      listOfObjects: [Object]
      listOfStrings: [String!]
      listOfInts: [Int]
    }

    type Object {
      property: String
    }

    enum Enum {
      VALUE_1
      VALUE_2
    }
  `;

  it('Provides default mocks for standard scalar fields and lists', () => {
    const server = mockServer(schemaDefinition, {});
    const result = server(`
      query test {
        boolean
        enum
        id
        int
        float
        string
        listOfObjects {
          property
        }
        listOfStrings
        listOfInts
      }
    `);

    if (!result.data) throw 'No data'; // Flow
    const data = result.data;

    expect(typeof data.boolean).toBe('boolean');
    expect(['VALUE_1', 'VALUE_2']).toContain(data.enum);
    expect(typeof data.id).toBe('string');
    expect(typeof data.float).toBe('number');
    //$FlowFixMe
    expect(data.float).not.toBe(Math.round(data.float));
    expect(typeof data.int).toBe('number');
    expect(typeof data.string).toBe('string');
    expect(data.listOfObjects).toBeInstanceOf(Array);
    expect(data.listOfObjects).toHaveLength(2);
    //$FlowFixMe
    expect(typeof data.listOfObjects[0].property).toBe('string');
    expect(data.listOfObjects).toBeInstanceOf(Array);
    expect(data.listOfStrings).toHaveLength(2);
    //$FlowFixMe
    expect(typeof data.listOfStrings[0]).toBe('string');
    expect(data.listOfInts).toBeInstanceOf(Array);
    expect(data.listOfInts).toHaveLength(2);
    //$FlowFixMe
    expect(typeof data.listOfInts[0]).toBe('number');
  });

  it('Only adds mocks if no mocks were manually defined', () => {
    const mocks = {
      Query: {
        boolean: () => true,
        id: () => 'Query.id',
        int: () => 0,
        float: () => 0.0,
        string: () => 'Query.string',
        listOfObjects: mockList(1),
        listOfStrings: mockList(1),
        listOfInts: mockList(1)
      }
    };

    const server = mockServer(schemaDefinition, mocks);

    const result = server(`
      query test {
        boolean
        id
        int
        float
        string
        listOfObjects {
          property
        }
        listOfInts
        listOfStrings
      }
    `);

    if (!result.data) throw 'No data'; // Flow
    const data = result.data;

    expect(data.boolean).toBe(true);
    expect(data.id).toBe('Query.id');
    expect(data.int).toBe(0);
    expect(data.float).toBe(0.0);
    expect(data.string).toBe('Query.string');
    expect(data.listOfObjects).toHaveLength(1);
    expect(data.listOfInts).toHaveLength(1);
    //$FlowFixMe
    expect(data.listOfInts[0]).toBeNull();
    expect(data.listOfStrings).toBeNull();
  });
});
