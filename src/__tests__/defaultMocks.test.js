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
      listOfScalars: [String]
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
        listOfScalars
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
    expect(data.listOfScalars).toBeInstanceOf(Array);
    expect(data.listOfScalars).toHaveLength(2);
    //$FlowFixMe
    expect(typeof data.listOfScalars[0]).toBe('string');
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
        listOfScalars: mockList(1)
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
        listOfScalars
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
    expect(data.listOfScalars).toHaveLength(1);
  });
});
