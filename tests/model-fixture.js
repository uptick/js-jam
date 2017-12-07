import Schema from '../src/schema'

export const schema = new Schema({
  book: {
    attributes: {
      title: {
        required: true
      },
      pages: {}
    },
    relationships: {
      author: {
        type: 'author',
        many: true,
        relatedName: 'books'
      },
      next: {
        type: 'book',
        relatedName: 'prev'
      },
      authorFK: {
        type: 'author',
        relatedName: 'booksFK',
        required: true
      }
    },
    indices: ['id', 'next'],
    ops: {
      create: () => fetch( 'http://create/' )
        .then( response => response.json() ),
      authorAdd: () => fetch( 'http://authorAdd/' )
        .then( response => response.json() ),
      authorRemove: () => fetch( 'http://authorRemove/' )
        .then( response => response.json() )
    }
  },
  author: {
    attributes: {
      name: {}
    }
  }
})

export function getJsonApiData( opts = {} ) {
  let results = {
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
        },
        next: {
          data: {
            id: 2,
            type: 'book'
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
  }

  if( opts.pagination ) {
    results.meta = {
      pagination: {
        limit: 50,
        offset: 0,
        count: 100
      }
    }
    results.links = {
      first: 'first',
      last: 'last',
      next: 'next',
      prev: 'prev'
    }
  }

  return results
}
