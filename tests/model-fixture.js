import { Schema } from '../src/schema';

export const schema = new Schema({
  book: {
    attributes: {
      title: {},
      pages: {}
    },
    relationships: {
      author: {
        type: 'author',
        many: true,
        relatedName: 'books'
      }
    },
    create: () => fetch( 'http://create/' )
                    .then( response => response.json() ),
    authorAdd: () => fetch( 'http://authorAdd/' )
                       .then( response => response.json() ),
    authorRemove: () => fetch( 'http://authorRemove/' )
                          .then( response => response.json() )
  },
  author: {
    attributes: {
      name: {}
    }
  }
});

export function getJsonApiData() {
  return {
    data: [{
      id: 1,
      type: 'book',
      attributes: {
        title: 'Raw Shark',
        pages: 100
      },
      relationships: {
        author: {
          data: {
            id: 1,
            type: 'author'
          }
        }
      }
    }, {
      id: 2,
      type: 'book',
      attributes: {
        title: 'Hyperion',
        pages: 300
      },
      relationships: {
        author: {
          data: [{
            id: 2,
            type: 'author'
          }, {
            id: 3,
            type: 'author'
          }]
        }
      }
    }, {
      id: 3,
      type: 'book',
      attributes: {
        title: 'Blah',
        pages: 400
      },
      relationships: {
        author: {
          data: [{
            id: 1,
            type: 'author'
          }]
        }
      }
    }],
    included: [{
      id: 1,
      type: 'author',
      attributes: {
        name: 'Frank'
      },
      relationships: {}
    }, {
      id: 2,
      type: 'author',
      attributes: {
        name: 'Harry'
      },
      relationships: {}
    }, {
      id: 3,
      type: 'author',
      attributes: {
        name: 'Frank'
      },
      relationships: {}
    }]
  };
}
