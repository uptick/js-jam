# JSON API Models (JAM)

[![npm version](https://badge.fury.io/js/js-jam.svg)](http://badge.fury.io/js/js-jam)
![Downloads](http://img.shields.io/npm/dm/js-jam.svg?style=flat)

JAM is a utility layer for assisting in converting JSON API payloads into a
convenient client side format, and in converting back to server compatible
JSON API payloads.

A schema describing the server side model format (typically automatically
generated) allows:

 * Data type conversions (e.g. incoming timestamps are converted using `moment`).
 * Relationship type checking.
 * Basic validation (e.g. required fields).
 * Prefill with default values.
 * Provision of select field options.

## Installation

```bash
npm install js-jam
```

or

```bash
yarn add js-jam
```

If you happen to be using `js-tinyapi` for your API client, a convenient middleware
is provided to allow automatic JSON API conversions:

```js
import {jamMiddleware} from 'js-jam'

api = new Api()
api.addMiddleware(jamMiddleware)

api.listMovies()  // returns flattened data instead of JSON API
```

See [`js-tinyapi`'s documentation](https://github.com/uptick/js-tinyapi) for more details.

## Defining a Schema

Before data can be manipulated a schema describing the structure of the data
must be defined. There are a number of ways to do it, the two most common are
to define the data manually, or import it automatically using an external
package.

### Manual Definition

Schemas are built using the `Schema` class:

```js
import {Schema} from 'js-jam'

let schema = new Schema()
```

To define models in a schema, use the `merge` method, which accepts an object
argument describing a part of a schema:

```js
schema.merge({})
```

`merge` may be called any number of times. Each subsequent call will overwrite
any overlapping models.

The structure of the schema object is similar in some ways to the structure of
a JSON-API object. Take for example the following definition of a movie:

```js
{
  movie: {
    attributes: {
      name: {
        required: true
      },
      year: {}
    },
    relationships: {
      actors: {
        type: "person",
        many: true
      }
    }
  },
  person: {
    attributes: {
      name: {
        required: true
      }
    }
  }
}
```

This defines two models: `movie` and `person`.

Options for attributes are currently limited to `required`.

Options for relationships:

 * type
 * required
 * many

### Django + DRF

If you're using Django and DRF, your schema can be loaded into JAM
automatically, which is particularly convenient.

Refer to [Django-JAM](https://github.com/ABASystems/django-jam)

## Manipulating Data

Once data has been loaded from your server, conversion to a local format
is achieved via a call to Scema's method `fromJsonApi`:

```js
import schema from 'mySchema'

const jsonApiData = fetch('/movies/?include=actors')

/*
  jsonApiData: {
    data: [
      {
        type: 'movie',
        id: 1,
          attributes: {
            title: 'Rocky'
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
          }
        }
      },
      {
        type: 'movie',
        id: 2,
        attributes: {
          title: 'Rocky 2'
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
      }
    }
  ]
  included: [
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
    }
  ]
*/

const data = schema.fromJsonApi(jsonApiData)

/*
  data: [
    {
      _type: 'movie',
      id: 1,
      title: 'Rocky'
      actors: [
        {
          _type: 'person',
          id: 1,
          name: 'Sylvester Stalone'
        },
        {
          _type: 'person',
          id: 2,
          name: 'Dolf Lundrem'
        }
      ]
    },
    {
      _type: 'movie',
      id: 2,
      title: 'Rocky 2'
      actors: [
        {
          _type: 'person',
          id: 1,
          name: 'Sylvester Stalone'
        }
      ]
    }
  ]
*/

schema.toJsonApi(data)
```

Note that when linking relationships together each instance of a resource is one
and the same. So, in the above example, both instances of the person resource
with ID 1 are actually the same JavaScript object.
