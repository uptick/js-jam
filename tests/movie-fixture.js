import Schema from '../src/schema'

/**
 * Requirements:
 *  1. Has a required and optional attribute.
 *  2. Has a required and optional foreign-key.
 *  3. Has a required and optional many-to-many.
 *  4. Has a reversed and non-reversed foreign-key.
 *  5. Has a reversed and non-reversed many-to-many.
 *  6. Has an attribute index.
 *  7. Has a foreign-key index.
 */
export const schema = new Schema({

  movie: {
    attributes: {
      title: {
        required: true
      },
      duration: {}
    },
    relationships: {
      actors: {
        type: 'person',
        many: true,
        relatedName: 'acted_in',
        required: true
      },
      director: {
        type: 'person',
        relatedName: 'directed',
        required: true
      },
      producer: {
        type: 'company'
      },
      tags: {
        type: 'tag',
        many: true
      }
    },
    indices: ['id', 'title', 'director']
  },

  person: {
    attributes: {
      name: {}
    }
  },

  company: {
    attributes: {
      name: {}
    }
  },

  tag: {
    attributes: {
      name: {}
    }
  }

})

/**
 * Return a dataset to cover as many test-cases as possible.
 */
export function getMovieData() {
  return {
    data: [

      // movies
      {
        type: 'movie',
        id: 1,
        attributes: {
          title: 'Rocky',
          duration: '58'
        },
        relationships: {
          actors: {
            data: [
              {
                type: 'person',
                id: 1
              },
              {
                type: 'person',
                id: 2
              }
            ]
          },
          director: {
            data: {
              type: 'person',
              id: 3
            }
          },
          producer: {
            data: {
              type: 'company',
              id: 1
            }
          },
          tags: {
            data: [
              {
                type: 'tag',
                id: 1
              },
              {
                type: 'tag',
                id: 2
              }
            ]
          }
        }
      }
    ],

    included: [

      // actors
      {
        type: 'person',
        id: 1,
        attributes: {
          name: 'Sylvester Stalone'
        }
      },
      {
        type: 'person',
        id: 2,
        attributes: {
          name: 'Dolf Lundrem'
        }
      },

      // directors
      {
        type: 'person',
        id: 3,
        attributes: {
          name: 'Harry Babalooney'
        }
      },

      // companies
      {
        type: 'company',
        id: 1,
        attributes: {
          name: 'MGM'
        }
      },

      // tags
      {
        type: 'tag',
        id: 1,
        attributes: {
          name: 'action'
        }
      },
      {
        type: 'tag',
        id: 1,
        attributes: {
          name: 'boxing'
        }
      }
    ]
  }
}

export function getExtraMovieData() {
  return {
    data: [

      // movies
      {
        type: 'movie',
        id: 2,
        attributes: {
          title: 'Critters',
          duration: '112'
        }
      }
    ]
  }
}
