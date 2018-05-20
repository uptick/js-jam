const movieSchema = {

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
    },
    relationships: {
      owns: {
        type: 'movie',
        many: true
      },
      favorite: {
        type: 'movie'
      }
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

}

const movieJsonApi = {
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
    },
    {
      type: 'movie',
      id: 2,
      attributes: {
        title: 'Rocky 2',
        duration: '40'
      },
      relationships: {
        actors: {
          data: [
            {
              type: 'person',
              id: 1
            }
          ]
        }
      }
    },
    {
      type: 'movie',
      id: 3,
      attributes: {
        title: 'Rocky 3',
        duration: '58'
      },
      relationships: {
        actors: {
          data: [
            {
              type: 'person',
              id: 1
            }
          ]
        }
      }
    },
    {
      type: 'movie',
      id: 4,
      attributes: {
        title: 'Back to the Future',
        duration: '58'
      },
      relationships: {}
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

export {
  movieSchema,
  movieJsonApi
}
