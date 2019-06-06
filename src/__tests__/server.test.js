// @flow
import { getNullableType } from 'graphql';
import _ from 'lodash';
import { mockServer, mockList } from '../index';

describe('server', () => {
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

      const server = mockServer(schemaDefinition, mocks, null);

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

      const server = mockServer(schemaDefinition, mocks, null);

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

      const server = mockServer(schemaDefinition, mocks, null);

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

      const server = mockServer(schemaDefinition, mocks, null);

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

      const server = mockServer(schemaDefinition, mocks, null);

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

      const server = mockServer(schemaDefinition, mocks, null);

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

      const server = mockServer(schemaDefinition, mocks, null);

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

      const server = mockServer(schemaDefinition, mocks, null);

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

    describe('mockOverride parameter', () => {
      it('Returns null when a value is set to null', () => {
        const mocks = {
          Object: {
            property: () => 'Object.property',
            property2: () => 'Object.property2'
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        const result = server(
          `
          query test {
            object {
              property
              property2
            }
          }
        `,
          {},
          {
            object: {
              property: null
            }
          }
        );

        expect(result).toEqual({
          data: {
            object: {
              property: null,
              property2: 'Object.property2'
            }
          }
        });
      });

      it('Returns an error payload when mocks return an error', () => {
        const mocks = {
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        const result = server(
          `
          query test {
            object {
              property
            }
          }
        `,
          {},
          {
            object: {
              property: Error('querMock.object.property.Error')
            }
          }
        );

        expect(result.data).toEqual({
          object: {
            property: null
          }
        });
        expect(result.errors).toHaveLength(1);
        expect(result.errors && result.errors[0].message).toBe(
          'querMock.object.property.Error'
        );
      });

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

        const server = mockServer(schemaDefinition, mocks, null);

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
              property: 'mockOverride.object.property',
              object: ({ argument }) => ({
                property: `mockOverride.object.object.property:${argument}`
              })
            }
          }
        );

        expect(result).toEqual({
          data: {
            object: {
              object: {
                property: 'mockOverride.object.object.property:ARGUMENT',
                property2: 'Object.property2'
              },
              property: 'mockOverride.object.property',
              property2: 'Query.object.property2'
            }
          }
        });
      });

      it('Allows arrays as overrides', () => {
        const mocks = {
          Query: {
            listOfObjects: mockList(2)
          },
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

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
              { property: 'mockOverride.listOfObject.0.property' },
              {},
              null,
              undefined
            ]
          }
        );

        expect(result).toEqual({
          data: {
            listOfObjects: [
              { property: 'mockOverride.listOfObject.0.property' },
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

        const server = mockServer(schemaDefinition, mocks, null);

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
                property: `mockOverride.listOfObjects.0.property:${argument}`
              },
              {
                property2: `mockOverride.listOfObjects.0.property2`
              },
              {}
            ]
          }
        );

        expect(result).toEqual({
          data: {
            listOfObjects: [
              {
                property: 'mockOverride.listOfObjects.0.property:ARGUMENT',
                property2: 'Object.property2'
              },
              {
                property: 'Query.listOfObjects.1:ARGUMENT',
                property2: 'mockOverride.listOfObjects.0.property2'
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

        const server = mockServer(schemaDefinition, mocks, null);

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
              aliasedPropety: 'mockOverride.object.property'
            }
          }
        );

        expect(result).toEqual({
          data: {
            object: {
              aliasedPropety: 'mockOverride.object.property',
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

        const server = mockServer(schemaDefinition, mocks, null);

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
              aliasedProperty: 'mockOverride.aliasedObject.aliasedProperty',
              aliasedObject: {
                aliasedProperty:
                  'mockOverride.aliasedObject.aliasedProperty.aliasedProperty'
              }
            }
          }
        );

        expect(result).toEqual({
          data: {
            aliasedObject: {
              property: 'Object.property',
              aliasedProperty: 'mockOverride.aliasedObject.aliasedProperty',
              aliasedObject: {
                property: 'Object.property',
                aliasedProperty:
                  'mockOverride.aliasedObject.aliasedProperty.aliasedProperty'
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

        const server = mockServer(schemaDefinition, mocks, null);

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
              aliasedProperty: 'mockOverride.aliasedObject.aliasedProperty',
              aliasedObject: {
                aliasedProperty:
                  'mockOverride.aliasedObject.aliasedProperty.aliasedProperty'
              }
            }
          }
        );

        expect(result).toEqual({
          data: {
            aliasedObject: {
              property: 'Object.property',
              aliasedProperty: 'mockOverride.aliasedObject.aliasedProperty',
              aliasedObject: {
                property: 'Object.property',
                aliasedProperty:
                  'mockOverride.aliasedObject.aliasedProperty.aliasedProperty'
              }
            }
          }
        });
      });
    });
  });

  describe('Input validation', () => {
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

    describe('mocks object', () => {
      it('Throws an error when there is mock for a type that does not exist', () => {
        expect.assertions(1);
        try {
          mockServer(schemaDefinition, {
            DoesNotExist: {}
          });
        } catch (error) {
          expect(error.message).toBe(
            "mocks['DoesNotExist'] is not defined in schema."
          );
        }
      });

      it('Throws an error when the baseMock is not an object of objects', () => {
        expect.assertions(1);
        try {
          mockServer(schemaDefinition, {
            Object: () => {}
          });
        } catch (error) {
          expect(error.message).toBe(
            'mocks should be an object of object of functions.'
          );
        }
      });

      it('Throws an error when there is a mock for a field that does not exist ', () => {
        expect.assertions(1);
        try {
          mockServer(schemaDefinition, {
            Object: {
              doesNotExist: () => {}
            }
          });
        } catch (error) {
          expect(error.message).toBe(
            "mocks['Object']['doesNotExist'] is not defined in schema."
          );
        }
      });

      it('Throws an error when there is a mock object for a type that that is not a object or interface ', () => {
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

      it('Throws an error when the baseMock is not an object of objects of funtions', () => {
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
            'mocks should be an object of object of functions.'
          );
        }
      });

      it('Does not raise an error when there is no base mock for a field that is an object', () => {
        const mocks = {
          Query: {
            // object is not defined
          },
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

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
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        const result = server(`
          query test {
            nonNullObject {
              property
            }
          }
        `);
      });

      it('Throws an error when there is no base mock for a field that is a list', () => {
        const mocks = {
          Query: {
            // listOfObjects is not defined
          },
          Object: {
            property: () => {}
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

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
            "There is no base mock for 'Query.listOfObjects'. " +
              'All queried list fields must have a base mock defined using mockList.'
          );
        }
      });

      it('Throws an error when there is no base mock for a field that is a scalar', () => {
        const server = mockServer(schemaDefinition, {}, null);

        expect.assertions(1);
        try {
          server(`
            query test {
              scalar
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "There is no base mock for 'Query.scalar'. " +
              'All queried fields must have a base mock.'
          );
        }
      });

      it('Throws an error when there is no base mock for a field that is a non-null scalar', () => {
        const server = mockServer(schemaDefinition, {}, null);

        expect.assertions(1);
        try {
          server(`
            query test {
              nonNullScalar
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "There is no base mock for 'Query.nonNullScalar'. " +
              'All queried fields must have a base mock.'
          );
        }
      });
    });

    describe('mocks functions', () => {
      it('Throws an error when a base mock returns null', () => {
        const mocks = {
          Object: {
            property: () => null
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        expect.assertions(1);
        try {
          server(`
            query test {
              object {
                property
              }
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "Base mock for 'Object.property' returned 'null' for path ''.\n" +
              "Base mocks are not allowed to return 'null'. Use 'mockOverride' to specify 'null' values instead."
          );
        }
      });

      it('Throws a validation error when a base mock throws an error', () => {
        const mocks = {
          Object: {
            property: () => {
              throw Error('Object.property.throw');
            }
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        expect.assertions(1);
        try {
          const data = server(`
            query test {
              object {
                property
              }
            }
          `);
          console.error(data);
        } catch (error) {
          expect(error.message).toEqual(
            expect.stringContaining(
              "Base mock for 'Object.property' threw an error for path ''.\n" +
                'Base mocks are not allowed to throw errors. ' +
                'In the rare case you actually want a base mock to return a GraphQL error, ' +
                'have the base mock return an Error() instead of throwing one.'
            )
          );
        }
      });

      it('Throws an error when a base mock returns a promise', () => {
        const mocks = {
          Object: {
            property: () => new Promise(() => 'Object.property.Promise')
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        expect.assertions(1);
        try {
          const data = server(`
            query test {
              object {
                property
              }
            }
          `);
          console.error(data);
        } catch (error) {
          expect(error.message).toBe(
            "Base mock for 'Object.property' returned a promise for path ''.\n" +
              'Mock functions must be synchronous.'
          );
        }
      });

      it('Throws an error when a base mock returns a non-nested undefined', () => {
        const mocks = {
          Object: {
            property: () => {}
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        expect.assertions(1);
        try {
          server(`
            query test {
              object {
                property
              }
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "Base mock for 'Object.property' returned 'undefined'.\n" +
              "Base mocks are not allowed to return 'undefined'. Return a value compatible with type 'String'."
          );
        }
      });

      it('Throws an error when a base mock for a leaf field returns an invalid value.', () => {
        const mocks = {
          Query: {
            scalar: () => ({})
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        expect.assertions(1);
        try {
          server(`
            query test {
              scalar
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "Base mock for 'Query.scalar' returned an invalid value for path ''.\n" +
              "Value '[object Object]' is incompatible with type 'Int'."
          );
        }
      });

      it('Throws an error when a base mock for an object field returns an invalid value.', () => {
        const mocks = {
          Query: {
            nonNullObject: () => 0
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        expect.assertions(1);
        try {
          server(`
            query test {
              nonNullObject {
                property
              }
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "Base mock for 'Query.nonNullObject' did not return an object for path ''.\n" +
              "Value '0' is incompatible with type 'Object'."
          );
        }
      });

      it('Throws an error when a base mock for a list field returns an invalid value.', () => {
        const mocks = {
          Query: {
            listOfObjects: () => ({})
          },
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

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
            "Base mock for 'Query.listOfObjects' did not return a MockList for path ''.\n" +
              "Use 'mockList' function to mock lists in base mocks."
          );
        }
      });

      it('Throws an error when a base mock returns a nested field that does not exist', () => {
        const mocks = {
          Query: {
            object: () => ({
              doesNotExist: () => {}
            })
          },
          Object: {
            property: () => {}
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        expect.assertions(1);
        try {
          server(`
            query test {
              object {
                property
              }
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "Base mock for 'Query.object' returns a value " +
              "for field path 'doesNotExist' that does not exist. " +
              'Base mocks should return values only for valid fields.'
          );
        }
      });

      it('Validates the object nested values returned by a base mock', () => {
        // We use "Throws an error when a base mock returns null" as an example
        const mocks = {
          Query: {
            object: () => ({
              property: null
            })
          },
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

        expect.assertions(1);
        try {
          server(`
            query test {
              object {
                property
              }
            }
          `);
        } catch (error) {
          expect(error.message).toBe(
            "Base mock for 'Query.object' returned 'null' for path 'property'.\n" +
              "Base mocks are not allowed to return 'null'. Use 'mockOverride' to specify 'null' values instead."
          );
        }
      });

      it('Validates the mock list nested values returned by a base mock', () => {
        // We use "Throws an error when a base mock returns null" as an example
        const mocks = {
          Query: {
            listOfObjects: mockList(2, () => ({
              property: null
            }))
          },
          Object: {
            property: () => 'Object.property'
          }
        };

        const server = mockServer(schemaDefinition, mocks, null);

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
            "Base mock for 'Query.listOfObjects' returned 'null' for path '0.property'.\n" +
              "Base mocks are not allowed to return 'null'. Use 'mockOverride' to specify 'null' values instead."
          );
        }
      });
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

    it('Throws an error when there is a mock defined for the field of an interface that is an object', () => {
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

    it('Throws an error when there is a mock defined for the field of an interface that is a non-null object', () => {
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

    it('Throws an error when there is a mock defined for the field of an interface that is a list of objects', () => {
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

    it('Does not Throws an error when there is a mock defined for the field of an interface that is a scalar', () => {
      mockServer(schemaDefinition, {
        ObjectInterface: {
          scalar: () => {}
        }
      });
    });

    it('Does not Throws an error when there is a mock defined for the field of an interface that is a non-null scalar', () => {
      mockServer(schemaDefinition, {
        ObjectInterface: {
          nonNullScalar: () => {}
        }
      });
    });

    it('Throws an error when there is a mock defined for the field of an interface that is a list of scalars', () => {
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

      const server = mockServer(schemaDefinition, mocks, null);

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

      const server = mockServer(schemaDefinition, mocks, null);

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
          'More than 1 interface for this field. Define base mock on the type.'
        );
      }
    });
  });

  describe('Custom scalars', () => {
    const schemaDefinition = `
      schema {
        query: Query
      }

      type Query {
        customScalar: CustomScalar
        property(customScalar: CustomScalar): CustomScalar
      }
    
      scalar CustomScalar
    `;

    it('Is possible to pass and return any type', () => {
      const mocks = {
        Query: {
          customScalar: () => 'Query.customScalar'
        }
      };

      const server = mockServer(schemaDefinition, mocks, null);

      const mockOverride = {
        bool: true,
        float: 0.1,
        id: 'ID',
        int: 1,
        list: [true, 1, 'string'],
        object: {
          key: 'value'
        },
        string: 'string'
      };

      const result = server(
        `
        query test {
          customScalar
          bool: customScalar
          float: customScalar
          id: customScalar 
          int: customScalar
          list: customScalar
          object: customScalar
          string: customScalar
        }
      `,
        {},
        mockOverride
      );

      expect(result).toEqual({
        data: {
          customScalar: 'Query.customScalar',
          ...mockOverride
        }
      });
    });

    it('Is possible to pass in any type in the query string', () => {
      const mocks = {
        Query: {
          property: ({ customScalar }) => customScalar
        }
      };

      const server = mockServer(schemaDefinition, mocks, null);

      const result = server(`
        query test {
          bool: property(customScalar: true)
          float: property(customScalar: 0.1)
          id: property(customScalar: "ID")
          int: property(customScalar: 1)
          list: property(customScalar: [true, 1, "string"])
          object: property(customScalar: {key: "value"})
          string: property(customScalar: "string")
        }
      `);

      expect(result).toEqual({
        data: {
          bool: true,
          float: 0.1,
          id: 'ID',
          int: 1,
          list: [true, 1, 'string'],
          object: {
            key: 'value'
          },
          string: 'string'
        }
      });
    });

    it('Is possible to pass in any type as a variable', () => {
      const mocks = {
        Query: {
          property: ({ customScalar }) => customScalar
        }
      };

      const server = mockServer(schemaDefinition, mocks, null);

      const variables = {
        bool: true,
        float: 0.1,
        id: 'ID',
        int: 1,
        list: [true, 1, 'string'],
        object: {
          key: 'value'
        },
        string: 'string'
      };

      const result = server(
        `
        query test (
          $bool: CustomScalar
          $float: CustomScalar
          $id: CustomScalar
          $int: CustomScalar
          $list: CustomScalar
          $object: CustomScalar
          $string: CustomScalar
        ) {
          bool: property(customScalar: $bool)
          float: property(customScalar: $float)
          id: property(customScalar: $id)
          int: property(customScalar: $int)
          list: property(customScalar: $list)
          object: property(customScalar: $object)
          string: property(customScalar: $string)
        }
      `,
        variables
      );

      expect(result).toEqual({
        data: {
          ...variables
        }
      });
    });

    it('Can be automatically mocked', () => {
      function getCustomScalarMock(parentType, field) {
        const nullableType = getNullableType(field.type);
        if (nullableType.name === 'CustomScalar') {
          return () => 'getCustomScalarMock';
        }
      }

      const server = mockServer(schemaDefinition, {}, [getCustomScalarMock]);

      const result = server(`
        query test {
          customScalar
        }
      `);

      expect(result).toEqual({
        data: {
          customScalar: 'getCustomScalarMock'
        }
      });
    });
  });
});
