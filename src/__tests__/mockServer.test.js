// @flow
import _ from 'lodash';
import { mockServer, mockList, mockRelayConnection } from '../mockServer';

/* 
TODO
- Add test for helpful error when using promise
  https://github.com/graphql/graphql-js/pull/1115
*/

describe('mockServer', () => {
  describe('Mock precedence rules', () => {
    const schemaDefinition = `
      schema {
        query: Query
      }
      
      type Query {
        object(argument: String): Object
        listOfObjects(argument: String): [Object]
      }
      
      type Object {
        property: String
        property2: String
        object(argument: String): Object
        listOfObjects(argument: String): [Object]
      }
    `;

    it('Mocks a field', () => {
      const mocks = {
        Query: {
          object: () => {}
        },
        Object: {
          property: () => 'Object.property'
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            property
          }
        }
      `);

      expect(result).toEqual({
        data: {
          object: {
            property: 'Object.property'
          }
        }
      });
    });

    it('Allows overriding a nested field mock with an object', () => {
      const mocks = {
        Query: {
          object: () => ({
            property: 'Query.object.property'
          })
        },
        Object: {
          property: () => 'Object.property'
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            property
          }
        }
      `);

      expect(result).toEqual({
        data: {
          object: {
            property: 'Query.object.property'
          }
        }
      });
    });

    it('Ignores overrides when it is undefined', () => {
      const mocks = {
        Query: {
          object: () => undefined
        },
        Object: {
          property: () => 'Object.property'
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            property
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        object: {
          property: 'Object.property'
        }
      });
    });

    it('Ignores overrides when it is an empty object', () => {
      const mocks = {
        Query: {
          object: () => ({})
        },
        Object: {
          property: () => 'Object.property'
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            property
          }
        }
      `);

      expect(result).toEqual({
        data: {
          object: {
            property: 'Object.property'
          }
        }
      });
    });

    it('Does a deep deep merge of overrides', () => {
      const mocks = {
        Query: {
          object: () => ({
            object: {
              property: 'Query.object.object.property',
              object: {
                object: {
                  property: 'Query.object.object.object.object.property'
                }
              }
            }
          })
        },
        Object: {
          property: () => 'Object.property',
          object: () => ({
            object: {
              property: 'Object.object.object.property'
            }
          })
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            property
            object {
              property
              object {
                property
                object {
                  property
                }
              }
            }
          }
        }
      `);

      expect(result).toEqual({
        data: {
          object: {
            property: 'Object.property',
            object: {
              property: 'Query.object.object.property',
              object: {
                property: 'Object.object.object.property',
                object: {
                  property: 'Query.object.object.object.object.property'
                }
              }
            }
          }
        }
      });
    });

    it('Passes args to a field mock', () => {
      const mocks = {
        Query: {
          object: ({ argument }) => ({
            property: `Query.object.property:${argument}`
          })
        },
        Object: {
          property: () => 'Object.property'
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object(argument: "ARGUMENT") {
            property
          }
        }
      `);

      expect(result).toEqual({
        data: {
          object: {
            property: 'Query.object.property:ARGUMENT'
          }
        }
      });
    });

    it('Mocks aliased field', () => {
      const mocks = {
        Object: {
          property: () => 'Object.property'
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            aliasedProperty: property
          }
        }
      `);

      expect(result).toEqual({
        data: {
          object: {
            aliasedProperty: 'Object.property'
          }
        }
      });
    });

    it('Returns null when mock return null', () => {
      const mocks = {
        Query: {
          object: () => ({
            property: null
          })
        },
        Object: {
          property: () => 'Object.property',
          property2: () => null
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            property
            property2
          }
        }
      `);

      expect(result).toEqual({
        data: {
          object: {
            property: null,
            property2: null
          }
        }
      });
    });

    it('Returns an error payload when mocks return an error', () => {
      const mocks = {
        Query: {
          object: () => ({
            property: Error()
          })
        },
        Object: {
          property: () => 'Object.property',
          property2: () => Error()
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            property
            property2
          }
        }
      `);

      expect(result.data).toEqual({
        object: {
          property: null,
          property2: null
        }
      });
      expect(result.errors).toHaveLength(2);
    });

    it('Does a deep merge mocked lists', () => {
      const mocks = {
        Query: {
          object: () => ({
            listOfObjects: mockList(2, ({ argument }, index) => ({
              property: `Query.listOfObjects.property:${argument}:${index}`
            }))
          })
        },
        Object: {
          property: () => 'Object.property',
          property2: () => 'Object.property2',
          listOfObjects: mockList(1, ({ argument }, index) => ({
            property2: `Object.listOfObjects.property2:${argument}:${index}`
          }))
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            listOfObjects(argument: "ARGUMENT") {
              property
              property2
            }
          }
        }
      `);

      expect(result).toEqual({
        data: {
          object: {
            listOfObjects: [
              {
                property: 'Query.listOfObjects.property:ARGUMENT:0',
                property2: 'Object.listOfObjects.property2:ARGUMENT:0'
              },
              {
                property: 'Query.listOfObjects.property:ARGUMENT:1',
                property2: 'Object.listOfObjects.property2:ARGUMENT:1'
              }
            ]
          }
        }
      });
    });

    describe('queryMock parameter', () => {
      it('Does a deep merge similar to overriding mocks', () => {
        const mocks = {
          Query: {
            object: () => ({
              property2: 'Query.object.property2'
            })
          },
          Object: {
            property: () => 'Object.property',
            property2: () => 'Object.property2'
          }
        };

        const server = mockServer(schemaDefinition, mocks);

        const result = server(
          `
          query test {
            object {
              property
              property2
              object(argument: "ARGUMENT") {
                property
                property2
              }
            }
          }
        `,
          {},
          {
            object: {
              property: 'queryMock.object.property',
              object: ({ argument }) => ({
                property: `queryMock.object.object.property:${argument}`
              })
            }
          }
        );

        expect(result).toEqual({
          data: {
            object: {
              object: {
                property: 'queryMock.object.object.property:ARGUMENT',
                property2: 'Object.property2'
              },
              property: 'queryMock.object.property',
              property2: 'Query.object.property2'
            }
          }
        });
      });

      fit('Allows arrays as overrides', () => {
        const mocks = {
          Query: {
            listOfObjects: mockList(2)
          },
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks);

        const result = server(
          `
          query test {
            listOfObjects {
              property
            }
          }
        `,
          {},
          {
            listOfObjects: [
              { property: 'queryMock.listOfObject.0.property' },
              {},
              null,
              undefined
            ]
          }
        );

        expect(result).toEqual({
          data: {
            listOfObjects: [
              { property: 'queryMock.listOfObject.0.property' },
              { property: 'Object.property' },
              null,
              { property: 'Object.property' }
            ]
          }
        });
      });

      it('Does a deep merge of arrays with mocked lists', () => {
        const mocks = {
          Query: {
            listOfObjects: mockList(1, ({ argument }, index) => ({
              property: `Query.listOfObjects.${index}:${argument}`
            }))
          },
          Object: {
            property: () => 'Object.property',
            property2: () => 'Object.property2'
          }
        };

        const server = mockServer(schemaDefinition, mocks);

        const result = server(
          `
          query test {
            listOfObjects(argument: "ARGUMENT") {
              property
              property2
            }
          }
        `,
          {},
          {
            listOfObjects: ({ argument }) => [
              {
                property: `queryMock.listOfObjects.0.property:${argument}`
              },
              {
                property2: `queryMock.listOfObjects.0.property2`
              },
              {}
            ]
          }
        );

        expect(result).toEqual({
          data: {
            listOfObjects: [
              {
                property: 'queryMock.listOfObjects.0.property:ARGUMENT',
                property2: 'Object.property2'
              },
              {
                property: 'Query.listOfObjects.1:ARGUMENT',
                property2: 'queryMock.listOfObjects.0.property2'
              },
              {
                property: 'Query.listOfObjects.2:ARGUMENT',
                property2: 'Object.property2'
              }
            ]
          }
        });
      });

      it('Allows to specify values for aliased leaf fields', () => {
        const mocks = {
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks);

        const result = server(
          `
          query test {
            object {
              aliasedPropety: property
              property
            }
          }
        `,
          {},
          {
            object: {
              aliasedPropety: 'queryMock.object.property'
            }
          }
        );

        expect(result).toEqual({
          data: {
            object: {
              aliasedPropety: 'queryMock.object.property',
              property: 'Object.property'
            }
          }
        });
      });

      it('Allows to specify values for aliased object fields', () => {
        const mocks = {
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks);

        const result = server(
          `
          query test {
            aliasedObject: object {
              property
              aliasedProperty: property
              aliasedObject: object {
                property
                aliasedProperty: property
              }
            }
          }
        `,
          {},
          {
            aliasedObject: {
              aliasedProperty: 'queryMock.aliasedObject.aliasedProperty',
              aliasedObject: {
                aliasedProperty:
                  'queryMock.aliasedObject.aliasedProperty.aliasedProperty'
              }
            }
          }
        );

        expect(result).toEqual({
          data: {
            aliasedObject: {
              property: 'Object.property',
              aliasedProperty: 'queryMock.aliasedObject.aliasedProperty',
              aliasedObject: {
                property: 'Object.property',
                aliasedProperty:
                  'queryMock.aliasedObject.aliasedProperty.aliasedProperty'
              }
            }
          }
        });
      });

      it('Allows to specify values for aliased list fields', () => {
        const mocks = {
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks);

        const result = server(
          `
          query test {
            aliasedObject: object {
              property
              aliasedProperty: property
              aliasedObject: object {
                property
                aliasedProperty: property
              }
            }
          }
        `,
          {},
          {
            aliasedObject: {
              aliasedProperty: 'queryMock.aliasedObject.aliasedProperty',
              aliasedObject: {
                aliasedProperty:
                  'queryMock.aliasedObject.aliasedProperty.aliasedProperty'
              }
            }
          }
        );

        expect(result).toEqual({
          data: {
            aliasedObject: {
              property: 'Object.property',
              aliasedProperty: 'queryMock.aliasedObject.aliasedProperty',
              aliasedObject: {
                property: 'Object.property',
                aliasedProperty:
                  'queryMock.aliasedObject.aliasedProperty.aliasedProperty'
              }
            }
          }
        });
      });
    });
  });

  describe('Validations', () => {
    const schemaDefinition = `
      schema {
        query: Query
      }

      type Query {
        object: Object
        nonNullObject: Object!
        listOfObjects: [Object]
        scalar: Int
        nonNullScalar: Int!
        listOfScalars: [Int]
      }

      type Object {
        property: String
      }

      enum Enum {
        VALUE
      }
    `;

    describe('Queried fields', () => {
      it('Does not raise an error when there is no base mock for a field that is an object', () => {
        const mocks = {
          Query: {
            // object is not defined
          },
          Object: {
            property: () => {}
          }
        };

        const server = mockServer(schemaDefinition, mocks);

        const result = server(`
          query test {
            object {
              property
            }
          }
        `);
      });

      it('Does not raise an error when there is no base mock for a field that is a non-null object', () => {
        const mocks = {
          Query: {
            // listOfObjects is not defined
          },
          Object: {
            property: () => {}
          }
        };

        const server = mockServer(schemaDefinition, mocks);

        const result = server(`
          query test {
            nonNullObject {
              property
            }
          }
        `);
      });

      it('Raises an error when there is no base mock for a field that is a list', () => {
        const mocks = {
          Query: {
            // listOfObjects is not defined
          },
          Object: {
            property: () => {}
          }
        };

        const server = mockServer(schemaDefinition, mocks);

        expect.assertions(1);
        try {
          server(`
            query test {
              listOfObjects {
                property
              }
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "Error: There is no base mock for 'Query.listOfObjects'. " +
              'All queried list fields must have a base mock defined using mockList.'
          );
        }
      });

      it('Raises an error when there is no base mock for a field that is a scalar', () => {
        const server = mockServer(schemaDefinition, {});

        expect.assertions(1);
        try {
          server(`
            query test {
              scalar
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "Error: There is no base mock for 'Query.scalar'. " +
              'All queried fields must have a base mock.'
          );
        }
      });

      it('Raises an error when there is no base mock for a field that is a non-null scalar', () => {
        const server = mockServer(schemaDefinition, {});

        expect.assertions(1);
        try {
          server(`
            query test {
              nonNullScalar
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "Error: There is no base mock for 'Query.nonNullScalar'. " +
              'All queried fields must have a base mock.'
          );
        }
      });
    });

    it('Raises an error when there is mock for a type that does not exist', () => {
      expect.assertions(1);
      try {
        mockServer(schemaDefinition, {
          DoesNotExist: {}
        });
      } catch (error) {
        expect(error.message).toBe(
          "baseMocks['DoesNotExist'] is not defined in schema."
        );
      }
    });

    it('Raises an error when the baseMock is not an object of objects', () => {
      expect.assertions(1);
      try {
        mockServer(schemaDefinition, {
          Object: () => {}
        });
      } catch (error) {
        expect(error.message).toBe(
          'baseMocks should be an object of object of functions.'
        );
      }
    });

    it('Raises an error when there is a mock for a field that does not exist ', () => {
      expect.assertions(1);
      try {
        mockServer(schemaDefinition, {
          Object: {
            doesNotExist: () => {}
          }
        });
      } catch (error) {
        expect(error.message).toBe(
          "baseMocks['Object']['doesNotExist'] is not defined in schema."
        );
      }
    });

    it('Raises an error when there is a mock for a type that that is not a object or interface ', () => {
      expect.assertions(1);
      try {
        mockServer(schemaDefinition, {
          Enum: {
            VALUE: () => {}
          }
        });
      } catch (error) {
        expect(error.message).toBe(
          'baseMock can only define field mocks on Type or Interface.'
        );
      }
    });

    it('Raises an error when the baseMock is not an object of objects of funtions', () => {
      expect.assertions(1);
      try {
        mockServer(schemaDefinition, {
          Object: {
            // $FlowFixMe This error is expected
            property: {}
          }
        });
      } catch (error) {
        expect(error.message).toBe(
          'baseMocks should be an object of object of functions.'
        );
      }
    });

    it('Raises an error when a base mock returns an array', () => {
      const mocks = {
        Query: {
          listOfObjects: () => []
        },
        Object: {
          property: () => 'Object.property'
        }
      };

      // $FlowFixMe This error is expected
      const server = mockServer(schemaDefinition, mocks);

      expect.assertions(1);
      try {
        server(`
          query test {
            listOfObjects {
              property 
            }
          }
        `);
      } catch (error) {
        expect(error.message).toBe(
          'Error: baseMocks must not return arrays or nested arrays.'
        );
      }
    });
  });

  describe('Interface', () => {
    const schemaDefinition = `
      schema {
        query: Query
      }

      type Query {
        object: Object
        objectWith2Interfaces: ObjectWith2Interfaces
      }
    
      type Object implements ObjectInterface {
        object: Object
        nonNullObject: Object!
        listOfObjects: [Object]
        scalar: String
        nonNullScalar: String!
        listOfScalars: [String]
      }

      interface ObjectInterface {
        object: Object
        nonNullObject: Object!
        listOfObjects: [Object]
        scalar: String
        nonNullScalar: String!
        listOfScalars: [String]
      }

      type ObjectWith2Interfaces implements ObjectInterface2 & ObjectInterface3 {
        scalar: String
      }

      interface ObjectInterface2 {
        scalar: String
      }

      interface ObjectInterface3 {
        scalar: String
      }
    `;

    it('Raises an error when there is a mock defined for the field of an interface that is an object', () => {
      expect.assertions(1);
      try {
        mockServer(schemaDefinition, {
          ObjectInterface: {
            object: () => {}
          }
        });
      } catch (error) {
        expect(error.message).toBe(
          'It is not allowed to define mocks for non-leaf fields on interfaces.'
        );
      }
    });

    it('Raises an error when there is a mock defined for the field of an interface that is a non-null object', () => {
      expect.assertions(1);
      try {
        mockServer(schemaDefinition, {
          ObjectInterface: {
            nonNullObject: () => {}
          }
        });
      } catch (error) {
        expect(error.message).toBe(
          'It is not allowed to define mocks for non-leaf fields on interfaces.'
        );
      }
    });

    it('Raises an error when there is a mock defined for the field of an interface that is a list of objects', () => {
      expect.assertions(1);
      try {
        mockServer(schemaDefinition, {
          ObjectInterface: {
            listOfObjects: () => {}
          }
        });
      } catch (error) {
        expect(error.message).toBe(
          'It is not allowed to define mocks for non-leaf fields on interfaces.'
        );
      }
    });

    it('Does not raises an error when there is a mock defined for the field of an interface that is a scalar', () => {
      mockServer(schemaDefinition, {
        ObjectInterface: {
          scalar: () => {}
        }
      });
    });

    it('Does not raises an error when there is a mock defined for the field of an interface that is a non-null scalar', () => {
      mockServer(schemaDefinition, {
        ObjectInterface: {
          nonNullScalar: () => {}
        }
      });
    });

    it('Raises an error when there is a mock defined for the field of an interface that is a list of scalars', () => {
      expect.assertions(1);
      try {
        mockServer(schemaDefinition, {
          ObjectInterface: {
            listOfScalars: () => {}
          }
        });
      } catch (error) {
        expect(error.message).toBe(
          'It is not allowed to define mocks for non-leaf fields on interfaces.'
        );
      }
    });

    it('Falls back to the interface mock if there is one', () => {
      const mocks = {
        ObjectInterface: {
          scalar: () => 'ObjectInterface.scalar'
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      const result = server(`
        query test {
          object {
            scalar
          }
        }
      `);

      expect(result).toEqual({
        data: {
          object: {
            scalar: 'ObjectInterface.scalar'
          }
        }
      });
    });

    it('Ignores the interface mocks for a field if there more than one interface defining the field', () => {
      const mocks = {
        ObjectInterface: {
          scalar: () => 'ObjectInterface.scalar'
        }
      };

      const server = mockServer(schemaDefinition, mocks);

      expect.assertions(1);
      try {
        server(`
          query test {
            objectWith2Interfaces {
              scalar
            }
          }
        `);
      } catch (error) {
        expect(error.message).toBe(
          'Error: More than 1 interface for this field. Define base mock on the type.'
        );
      }
    });
  });

  // TODO Update strategy for relayConnections
  xdescribe('mockRelayConnection', () => {
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

    it('Returns an obvious error when both first and last are set', () => {
      const mocks = {
        Query: {
          objectConnection: mockRelayConnection()
        },
        Object: {
          property: () => 'Object.property'
        }
      };

      // $FlowFixMe It seems to happen because it is the first test of this `describe` block...
      const server = mockServer(schemaDefinition, mocks);
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

      expect(result.errors && result.errors[0].message).toBe(
        'Either first xor last should be set'
      );
    });

    it('Is possible to override errors by specifying all queried relay fields', () => {
      const mocks = {
        Query: {
          objectConnection: mockRelayConnection()
        },
        Object: {
          property: () => 'Object.property'
        },
        PageInfo: {
          hasNextPage: () => {},
          hasPreviousPage: () => {}
        },
        ObjectEdge: {
          cursor: () => 'ObjectEdge.cursor'
        }
      };

      const server = mockServer(schemaDefinition, mocks);
      const result = server(
        `
        query test {
          objectConnection(last: 1, first: 3) {
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
      `,
        {},
        {
          objectConnection: {
            edges: [
              {
                node: {},
                cursor: ''
              }
            ],
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: false
            }
          }
        }
      );

      expect(result.errors).toBeUndefined();
    });

    it('Returns the right number of items when first or last are set', () => {
      const mocks = {
        Query: {
          objectConnection: mockRelayConnection()
        },
        Object: {
          property: () => 'Object.property'
        },
        PageInfo: {
          hasNextPage: () => {},
          hasPreviousPage: () => {}
        }
      };

      const server = mockServer(schemaDefinition, mocks);
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

    it('Returns no more than the totalSize of items', () => {
      const mocks = {
        Query: {
          objectConnection: mockRelayConnection({ maxSize: 2 })
        },
        Object: {
          property: () => 'Object.property'
        },
        PageInfo: {
          hasNextPage: () => {},
          hasPreviousPage: () => {}
        }
      };

      const server = mockServer(schemaDefinition, mocks);
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

      const server = mockServer(schemaDefinition, mocks);

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
  });
});
